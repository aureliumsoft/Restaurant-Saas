import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decryptSecret } from '@/lib/credentials-encryption';
import { db } from '@/lib/db';
import {
  deleteRestaurantEasypaisaCredentials,
  getRestaurantPaymentProviderDto,
  upsertRestaurantEasypaisaCredentials,
} from '@/lib/restaurant-payment-credentials';
import {
  testRestaurantEasypaisaCredentials,
  toRestaurantEasypaisaRuntimeConfig,
} from '@/lib/restaurant-easypaisa-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  storeId: z.string().min(1).max(100),
  hashKey: z.string().min(2).max(500).optional(),
  username: z.string().max(200).optional().nullable(),
  password: z.string().max(200).optional().nullable(),
  mode: z.enum(['sandbox', 'live']).optional(),
});

export async function GET() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  const data = await getRestaurantPaymentProviderDto(session.ctx.restaurant.id);
  return NextResponse.json({ data: data.easypaisa });
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
    const existing = await db.restaurantEasypaisaCredentials.findUnique({
      where: { restaurantId: session.ctx.restaurant.id },
    });
    const hashKey =
      parsed.data.hashKey?.trim() ||
      (existing ? decryptSecret(existing.hashKeyEnc) : '');
    if (!hashKey) {
      throw new Error('Hash key is required.');
    }

    const runtime = toRestaurantEasypaisaRuntimeConfig({
      storeId: parsed.data.storeId,
      hashKey,
      username: parsed.data.username,
      password: parsed.data.password,
      mode: parsed.data.mode,
    });
    testRestaurantEasypaisaCredentials(runtime);

    const easypaisa = await upsertRestaurantEasypaisaCredentials({
      restaurantId: session.ctx.restaurant.id,
      storeId: parsed.data.storeId,
      hashKey: parsed.data.hashKey,
      username: parsed.data.username,
      password: parsed.data.password,
      mode: runtime.mode,
      isVerified: true,
    });
    return NextResponse.json({ data: easypaisa });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not save Easypaisa credentials.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  await deleteRestaurantEasypaisaCredentials(session.ctx.restaurant.id);
  return NextResponse.json({ ok: true });
}
