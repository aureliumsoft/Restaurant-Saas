import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import { getRequestOrigin } from '@/lib/request-origin';
import { getRestaurantJazzCashRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';
import {
  buildJazzCashHostedCheckout,
  resolveJazzCashReturnUrl,
} from '@/lib/restaurant-jazzcash-client';

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

function makeTxnRefNo(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  const stamp = `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `T${stamp}${rand}`.slice(0, 20);
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

  let row;
  try {
    row = await getRestaurantJazzCashRuntimeConfigBySlug(restaurantSlug);
  } catch (e) {
    console.error('Load JazzCash config failed:', e);
    return NextResponse.json(
      { error: 'Could not load JazzCash configuration. Please try again.' },
      { status: 503 }
    );
  }
  if (!row) {
    return NextResponse.json(
      {
        error:
          'This restaurant cannot accept JazzCash payments yet. The owner must configure JazzCash in settings and activate Wallets.',
      },
      { status: 403 }
    );
  }

  const origin = await getRequestOrigin();
  let returnUrl: string;
  try {
    returnUrl = resolveJazzCashReturnUrl(origin, row.config.returnUrl);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Invalid JazzCash return URL configuration.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const txnRefNo = makeTxnRefNo();
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

      const intentKey = `jazzcash_order_intent:${txnRefNo}`;
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

    const checkout = buildJazzCashHostedCheckout(row.config, {
      amountMajor: parsed.data.amount,
      billReference: txnRefNo,
      description: parsed.data.title ?? 'Order payment',
      returnUrl,
      txnRefNo,
    });

    console.info('[jazzcash] checkout prepared', {
      mode: row.config.mode,
      merchantId: row.config.merchantId,
      returnUrl,
      txnRefNo,
      amount: checkout.fields.pp_Amount,
      gatewayUrl: checkout.gatewayUrl,
      fieldKeys: Object.keys(checkout.fields).sort(),
    });

    return NextResponse.json(
      {
        gatewayUrl: checkout.gatewayUrl,
        fields: checkout.fields,
        txnRefNo,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('Create JazzCash checkout failed:', e);
    const msg =
      e instanceof Error ? e.message : 'Could not start JazzCash checkout';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
