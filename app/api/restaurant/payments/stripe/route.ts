import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  deleteRestaurantStripeCredentials,
  getRestaurantPaymentProviderDto,
  upsertRestaurantStripeCredentials,
} from '@/lib/restaurant-payment-credentials';
import {
  testRestaurantStripeCredentials,
  toRestaurantStripeRuntimeConfig,
} from '@/lib/restaurant-stripe-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  publishableKey: z.string().min(8).max(500),
  secretKey: z.string().min(8).max(500).optional(),
  webhookSecret: z.string().max(500).optional().nullable(),
  mode: z.enum(['test', 'live']).optional(),
});

export async function GET() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  const data = await getRestaurantPaymentProviderDto(session.ctx.restaurant.id);
  return NextResponse.json({ data: data.stripe });
}

export async function PUT(req: Request) {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

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

  try {
    const runtime = toRestaurantStripeRuntimeConfig({
      publishableKey: parsed.data.publishableKey,
      secretKey: parsed.data.secretKey ?? '',
      webhookSecret: parsed.data.webhookSecret,
      mode: parsed.data.mode,
    });
    await testRestaurantStripeCredentials(runtime);

    const stripe = await upsertRestaurantStripeCredentials({
      restaurantId: session.ctx.restaurant.id,
      publishableKey: parsed.data.publishableKey,
      secretKey: parsed.data.secretKey,
      webhookSecret: parsed.data.webhookSecret,
      mode: runtime.mode,
      isVerified: true,
    });
    return NextResponse.json({ data: stripe });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not save Stripe credentials.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  await deleteRestaurantStripeCredentials(session.ctx.restaurant.id);
  return NextResponse.json({ ok: true });
}
