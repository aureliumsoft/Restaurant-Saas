import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRequestOrigin } from '@/lib/request-origin';
import { getRestaurantStripeRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';
import { createRestaurantStripeCheckoutSession } from '@/lib/restaurant-stripe-client';

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
  const currency = (parsed.data.currency ?? 'EUR').toUpperCase();
  if (parsed.data.amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const restaurantSlug = parsed.data.metadata?.restaurantSlug?.trim();
  if (!restaurantSlug) {
    return NextResponse.json(
      { error: 'restaurantSlug is required for customer order payments.' },
      { status: 400 }
    );
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

  const successUrl = new URL(parsed.data.successPath, origin).toString();
  const cancelUrl = new URL(parsed.data.cancelPath, origin).toString();

  try {
    const shouldStoreIntent = !!parsed.data.endpoint && parsed.data.payload != null;
    const intentId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `intent-${Date.now()}`;

    if (shouldStoreIntent) {
      const intentKey = `stripe_order_intent:${intentId}`;
      await db.platformSetting.upsert({
        where: { key: intentKey },
        create: {
          key: intentKey,
          value: JSON.stringify({
            source: parsed.data.source,
            endpoint: parsed.data.endpoint,
            payload: parsed.data.payload,
            metadata: parsed.data.metadata ?? {},
            status: 'pending',
            createdAt: new Date().toISOString(),
          }),
        },
        update: {
          value: JSON.stringify({
            source: parsed.data.source,
            endpoint: parsed.data.endpoint,
            payload: parsed.data.payload,
            metadata: parsed.data.metadata ?? {},
            status: 'pending',
            createdAt: new Date().toISOString(),
          }),
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

    return NextResponse.json({ url: checkout.url, id: checkout.id }, { status: 200 });
  } catch (e) {
    console.error('Create Stripe checkout failed:', e);
    const msg =
      e instanceof Error ? e.message : 'Could not start Stripe checkout';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
