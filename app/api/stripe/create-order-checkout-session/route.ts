import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import { toStripeCurrencyCode } from '@/lib/format-money';
import { getRequestOrigin } from '@/lib/request-origin';
import {
  getRestaurantStripeRuntimeConfigBySlug,
} from '@/lib/restaurant-payment-credentials';
import {
  parseRestaurantRegionalSettings,
  RESTAURANT_REGIONAL_DB_SELECT,
} from '@/lib/restaurant-regional';
import { createRestaurantStripeCheckoutSession } from '@/lib/restaurant-stripe-client';
import { paymentStockBlockError } from '@/lib/inventory/assert-payment-stock';

export const runtime = 'nodejs';

const bodySchema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string().min(3).max(3).optional(),
  source: z.enum(['online', 'kiosk']),
  endpoint: z.enum(['/api/customer/orders', '/api/kiosk/orders']).optional(),
  payload: z.unknown().optional(),
  successPath: z.string().min(1).max(500),
  cancelPath: z.string().min(1).max(500),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const origin = await getRequestOrigin();

  const restaurantSlug = parsed.data.metadata?.restaurantSlug?.trim();
  if (!restaurantSlug) {
    return NextResponse.json(
      { error: 'restaurantSlug is required for customer order payments.' },
      { status: 400 }
    );
  }

  const restaurantRegional = await db.restaurant.findUnique({
    where: { slug: restaurantSlug },
    select: RESTAURANT_REGIONAL_DB_SELECT,
  });
  const regional = parseRestaurantRegionalSettings(restaurantRegional);
  const currency = toStripeCurrencyCode(
    parsed.data.currency ?? regional.currencyCode
  );

  if (parsed.data.amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const row = await getRestaurantStripeRuntimeConfigBySlug(restaurantSlug);
  if (!row) {
    return NextResponse.json(
      {
        error:
          'This restaurant cannot accept Stripe payments yet. The owner must configure Stripe in settings.',
      },
      { status: 403 }
    );
  }

  const stockError = await paymentStockBlockError(
    restaurantSlug,
    parsed.data.payload
  );
  if (stockError) {
    return NextResponse.json({ error: stockError }, { status: 400 });
  }

  const successUrl = new URL(parsed.data.successPath, origin).toString();
  const cancelUrl = new URL(parsed.data.cancelPath, origin).toString();

  try {
    const shouldStoreIntent = !!parsed.data.endpoint && parsed.data.payload != null;
    const intentId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `intent-${Date.now()}`;

    if (shouldStoreIntent) {
      let customerAccountId: string | null = null;
      if (parsed.data.source === 'online') {
        const restaurant = await resolveRestaurantIdBySlug(restaurantSlug);
        if (restaurant) {
          const session = await getCustomerAccountSession(req, {
            restaurantId: restaurant.id,
          });
          customerAccountId = session?.accountId ?? null;
        }
      }

      const intentKey = `stripe_order_intent:${intentId}`;
      const intentValue = JSON.stringify({
        source: parsed.data.source,
        endpoint: parsed.data.endpoint,
        payload: parsed.data.payload,
        metadata: parsed.data.metadata ?? {},
        customerAccountId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      await db.platformSetting.upsert({
        where: { key: intentKey },
        create: {
          key: intentKey,
          value: intentValue,
        },
        update: {
          value: intentValue,
        },
      });
    }

    const checkout = await createRestaurantStripeCheckoutSession(row.config, {
      amount: parsed.data.amount,
      currency,
      title: parsed.data.title ?? 'Order payment',
      successUrl,
      cancelUrl,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        source: parsed.data.source,
        restaurantSlug,
        ...(shouldStoreIntent ? { intentId } : {}),
      },
    });

    await db.platformSetting.upsert({
      where: { key: `stripe_checkout_slug:${checkout.id}` },
      create: {
        key: `stripe_checkout_slug:${checkout.id}`,
        value: restaurantSlug,
      },
      update: { value: restaurantSlug },
    });

    return NextResponse.json({ url: checkout.url, id: checkout.id }, { status: 200 });
  } catch (e) {
    console.error('Create Stripe checkout failed:', e);
    const msg =
      e instanceof Error ? e.message : 'Could not start Stripe checkout';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
