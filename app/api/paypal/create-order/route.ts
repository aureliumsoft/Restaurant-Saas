import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import {
  createPayPalOrder,
  getPayPalConfigError,
  isPayPalConfigured,
  type PayPalOrderMetadata,
} from '@/lib/paypal-server';
import { getRequestOrigin } from '@/lib/request-origin';
import { getRestaurantPayPalRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';
import { createRestaurantPayPalOrder } from '@/lib/restaurant-paypal-client';
import { paymentStockBlockError } from '@/lib/inventory/assert-payment-stock';

export const runtime = 'nodejs';

const bodySchema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string().min(3).max(3).optional(),
  source: z.enum(['online', 'kiosk', 'subscription']).optional(),
  endpoint: z.enum(['/api/customer/orders', '/api/kiosk/orders']).optional(),
  payload: z.unknown().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  /** Used by the native app WebView; must stay on this origin. */
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

function sameOriginUrl(candidate: string | undefined, origin: string): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const base = new URL(origin);
    if (url.origin !== base.origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isMerchantOrderSource(source: string | undefined): boolean {
  return source === 'online' || source === 'kiosk';
}

/**
 * Creates a PayPal order for the inline JS-SDK Buttons flow.
 * Customer orders use each restaurant's own PayPal credentials.
 * SaaS subscription checkout uses the platform account only.
 */
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const origin = await getRequestOrigin();
  const currency = (parsed.data.currency ?? 'EUR').toUpperCase();
  const source = parsed.data.source;
  const restaurantSlug = parsed.data.metadata?.restaurantSlug?.trim();

  const intentId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `intent-${Date.now()}`;

  let restaurantPayPal:
    | Awaited<ReturnType<typeof getRestaurantPayPalRuntimeConfigBySlug>>
    | null = null;

  if (isMerchantOrderSource(source)) {
    if (!restaurantSlug) {
      return NextResponse.json(
        { error: 'restaurantSlug is required for customer order payments.' },
        { status: 400 }
      );
    }
    restaurantPayPal = await getRestaurantPayPalRuntimeConfigBySlug(restaurantSlug);
    if (!restaurantPayPal) {
      return NextResponse.json(
        {
          error:
            'This restaurant cannot accept PayPal payments yet. The owner must configure PayPal in settings.',
        },
        { status: 403 }
      );
    }
  } else if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: getPayPalConfigError() ?? 'PayPal is not configured' },
      { status: 503 }
    );
  }

  if (isMerchantOrderSource(source)) {
    const stockError = await paymentStockBlockError(
      restaurantSlug,
      parsed.data.payload
    );
    if (stockError) {
      return NextResponse.json({ error: stockError }, { status: 400 });
    }
  }

  let customerAccountId: string | null = null;
  if (source === 'online' && restaurantSlug) {
    const restaurant = await resolveRestaurantIdBySlug(restaurantSlug);
    if (restaurant) {
      const session = await getCustomerAccountSession(req, {
        restaurantId: restaurant.id,
      });
      customerAccountId = session?.accountId ?? null;
    }
  }

  const intentValue = JSON.stringify({
    source: parsed.data.source ?? null,
    metadata: parsed.data.metadata ?? {},
    endpoint: parsed.data.endpoint ?? null,
    payload: parsed.data.payload ?? null,
    customerAccountId,
    restaurantId: restaurantPayPal?.restaurantId ?? null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  await db.platformSetting.upsert({
    where: { key: `paypal_order_intent:${intentId}` },
    create: { key: `paypal_order_intent:${intentId}`, value: intentValue },
    update: { value: intentValue },
  });

  const metadata: PayPalOrderMetadata = { intentId };

  const orderParams = {
    amount: parsed.data.amount,
    currency,
    title: parsed.data.title ?? 'Payment',
    returnUrl:
      sameOriginUrl(parsed.data.returnUrl, origin) ?? `${origin}/`,
    cancelUrl:
      sameOriginUrl(parsed.data.cancelUrl, origin) ?? `${origin}/`,
    metadata,
  };

  try {
    if (restaurantPayPal) {
      const order = await createRestaurantPayPalOrder(
        restaurantPayPal.config,
        orderParams
      );
      return NextResponse.json({ id: order.id, url: order.url }, { status: 200 });
    }

    const order = await createPayPalOrder(orderParams);
    return NextResponse.json({ id: order.id, url: order.url }, { status: 200 });
  } catch (e) {
    console.error('PayPal create-order failed:', e);
    return NextResponse.json(
      { error: 'Could not create PayPal order' },
      { status: 502 }
    );
  }
}
