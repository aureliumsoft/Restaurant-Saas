import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decryptSecret } from '@/lib/credentials-encryption';
import { db } from '@/lib/db';
import {
  testRestaurantJazzCashCredentials,
  toRestaurantJazzCashRuntimeConfig,
} from '@/lib/restaurant-jazzcash-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  merchantId: z.string().min(2).max(100).optional(),
  password: z.string().min(2).max(200).optional(),
  integritySalt: z.string().min(2).max(200).optional(),
  returnUrl: z.string().url().max(500).optional(),
  mode: z.enum(['sandbox', 'live']).optional(),
});

export async function POST(req: Request) {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  let json: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid JazzCash test request.' },
      { status: 400 }
    );
  }

  const existing = await db.restaurantJazzCashCredentials.findUnique({
    where: { restaurantId: session.ctx.restaurant.id },
  });

  const merchantId =
    parsed.data.merchantId?.trim() || existing?.merchantId || '';
  const password =
    parsed.data.password?.trim() ||
    (existing ? decryptSecret(existing.passwordEnc) : '');
  const integritySalt =
    parsed.data.integritySalt?.trim() ||
    (existing ? decryptSecret(existing.integritySaltEnc) : '');
  const mode = parsed.data.mode ?? existing?.mode ?? 'sandbox';
  const returnUrl =
    parsed.data.returnUrl?.trim() ||
    existing?.returnUrl ||
    undefined;

  if (!merchantId || !password || !integritySalt) {
    return NextResponse.json(
      {
        error:
          'Merchant ID, password, and integrity salt are required to test JazzCash.',
      },
      { status: 400 }
    );
  }

  try {
    const runtime = toRestaurantJazzCashRuntimeConfig({
      merchantId,
      password,
      integritySalt,
      mode,
      returnUrl,
    });
    testRestaurantJazzCashCredentials(runtime);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'JazzCash connection test failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
