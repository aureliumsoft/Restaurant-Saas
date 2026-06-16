import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  deleteRestaurantPayPalCredentials,
  getRestaurantPaymentProviderDto,
  upsertRestaurantPayPalCredentials,
} from '@/lib/restaurant-payment-credentials';
import {
  testRestaurantPayPalCredentials,
  toRestaurantPayPalRuntimeConfig,
} from '@/lib/restaurant-paypal-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  clientId: z.string().min(3).max(500),
  clientSecret: z.string().min(3).max(500).optional(),
  webhookId: z.string().max(200).optional().nullable(),
  mode: z.enum(['sandbox', 'live']).default('sandbox'),
  currency: z.string().min(3).max(3).default('EUR'),
  countryCode: z.string().length(2).default('DE'),
});

export async function GET() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  const data = await getRestaurantPaymentProviderDto(session.ctx.restaurant.id);
  return NextResponse.json({ data: data.paypal });
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
    const runtime = toRestaurantPayPalRuntimeConfig({
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret ?? '',
      mode: parsed.data.mode,
      currency: parsed.data.currency,
      countryCode: parsed.data.countryCode,
    });
    await testRestaurantPayPalCredentials(runtime);

    const paypal = await upsertRestaurantPayPalCredentials({
      restaurantId: session.ctx.restaurant.id,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
      webhookId: parsed.data.webhookId,
      mode: parsed.data.mode,
      currency: parsed.data.currency,
      countryCode: parsed.data.countryCode,
      isVerified: true,
    });
    return NextResponse.json({ data: paypal });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not save PayPal credentials.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  await deleteRestaurantPayPalCredentials(session.ctx.restaurant.id);
  return NextResponse.json({ ok: true });
}
