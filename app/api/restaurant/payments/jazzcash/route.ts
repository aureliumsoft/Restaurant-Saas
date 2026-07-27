import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decryptSecret } from '@/lib/credentials-encryption';
import { db } from '@/lib/db';
import {
  deleteRestaurantJazzCashCredentials,
  getRestaurantPaymentProviderDto,
  upsertRestaurantJazzCashCredentials,
} from '@/lib/restaurant-payment-credentials';
import {
  testRestaurantJazzCashCredentials,
  toRestaurantJazzCashRuntimeConfig,
} from '@/lib/restaurant-jazzcash-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  merchantId: z.string().min(2).max(100),
  password: z.string().min(2).max(200).optional(),
  integritySalt: z.string().min(2).max(200).optional(),
  mode: z.enum(['sandbox', 'live']).optional(),
});

export async function GET() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  const data = await getRestaurantPaymentProviderDto(session.ctx.restaurant.id);
  return NextResponse.json({ data: data.jazzcash });
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
    const existing = await db.restaurantJazzCashCredentials.findUnique({
      where: { restaurantId: session.ctx.restaurant.id },
    });
    const password =
      parsed.data.password?.trim() ||
      (existing ? decryptSecret(existing.passwordEnc) : '');
    const integritySalt =
      parsed.data.integritySalt?.trim() ||
      (existing ? decryptSecret(existing.integritySaltEnc) : '');
    if (!password || !integritySalt) {
      throw new Error(
        'Password and integrity salt are required on first save.'
      );
    }

    const runtime = toRestaurantJazzCashRuntimeConfig({
      merchantId: parsed.data.merchantId,
      password,
      integritySalt,
      mode: parsed.data.mode,
    });
    testRestaurantJazzCashCredentials(runtime);

    const jazzcash = await upsertRestaurantJazzCashCredentials({
      restaurantId: session.ctx.restaurant.id,
      merchantId: parsed.data.merchantId,
      password: parsed.data.password,
      integritySalt: parsed.data.integritySalt,
      mode: runtime.mode,
      isVerified: true,
    });
    return NextResponse.json({ data: jazzcash });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not save JazzCash credentials.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  await deleteRestaurantJazzCashCredentials(session.ctx.restaurant.id);
  return NextResponse.json({ ok: true });
}
