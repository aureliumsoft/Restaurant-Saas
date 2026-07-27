import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decryptSecret } from '@/lib/credentials-encryption';
import { db } from '@/lib/db';
import {
  testRestaurantEasypaisaCredentials,
  toRestaurantEasypaisaRuntimeConfig,
} from '@/lib/restaurant-easypaisa-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  storeId: z.string().min(1).max(100).optional(),
  hashKey: z.string().min(2).max(500).optional(),
  username: z.string().max(200).optional().nullable(),
  password: z.string().max(200).optional().nullable(),
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
      { error: 'Invalid Easypaisa test request.' },
      { status: 400 }
    );
  }

  const existing = await db.restaurantEasypaisaCredentials.findUnique({
    where: { restaurantId: session.ctx.restaurant.id },
  });

  const storeId = parsed.data.storeId?.trim() || existing?.storeId || '';
  const hashKey =
    parsed.data.hashKey?.trim() ||
    (existing ? decryptSecret(existing.hashKeyEnc) : '');
  const mode = parsed.data.mode ?? existing?.mode ?? 'sandbox';

  if (!storeId || !hashKey) {
    return NextResponse.json(
      { error: 'Store ID and hash key are required to test Easypaisa.' },
      { status: 400 }
    );
  }

  try {
    const runtime = toRestaurantEasypaisaRuntimeConfig({
      storeId,
      hashKey,
      username: parsed.data.username,
      password: parsed.data.password,
      mode,
    });
    testRestaurantEasypaisaCredentials(runtime);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Easypaisa connection test failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
