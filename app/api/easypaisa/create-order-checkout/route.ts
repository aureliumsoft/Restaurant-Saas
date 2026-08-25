import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import { getRequestOrigin } from '@/lib/request-origin';
import { getRestaurantEasypaisaRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';
import { buildEasypaisaHostedCheckout } from '@/lib/restaurant-easypaisa-client';
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
  metadata: z.record(z.string(), z.string()).optional(),
});

function makeOrderRefNum(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `EP${stamp}${rand}`.replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

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

  const restaurantSlug = parsed.data.metadata?.restaurantSlug?.trim();
  if (!restaurantSlug) {
    return NextResponse.json(
      { error: 'restaurantSlug is required for customer order payments.' },
      { status: 400 }
    );
  }

  const row = await getRestaurantEasypaisaRuntimeConfigBySlug(restaurantSlug);
  if (!row) {
    return NextResponse.json(
      {
        error:
          'This restaurant cannot accept Easypaisa payments yet. The owner must configure Easypaisa in settings and activate Wallets.',
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

  const origin = await getRequestOrigin();
  const orderRefNum = makeOrderRefNum();
  const shouldStoreIntent =
    !!parsed.data.endpoint && parsed.data.payload != null;

  try {
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

      const intentKey = `easypaisa_order_intent:${orderRefNum}`;
      const intentValue = JSON.stringify({
        source: parsed.data.source,
        endpoint: parsed.data.endpoint,
        payload: parsed.data.payload,
        metadata: {
          ...(parsed.data.metadata ?? {}),
          restaurantSlug,
          successPath: parsed.data.successPath,
          cancelPath: parsed.data.cancelPath,
        },
        customerAccountId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      await db.platformSetting.upsert({
        where: { key: intentKey },
        create: { key: intentKey, value: intentValue },
        update: { value: intentValue },
      });
    }

    const postBackURL = new URL(
      `/api/easypaisa/return?restaurantSlug=${encodeURIComponent(restaurantSlug)}`,
      origin
    ).toString();

    const checkout = buildEasypaisaHostedCheckout(row.config, {
      amountMajor: parsed.data.amount,
      orderRefNum,
      postBackURL,
    });

    return NextResponse.json(
      {
        gatewayUrl: checkout.gatewayUrl,
        fields: checkout.fields,
        orderRefNum,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('Create Easypaisa checkout failed:', e);
    const msg =
      e instanceof Error ? e.message : 'Could not start Easypaisa checkout';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
