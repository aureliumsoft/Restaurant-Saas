import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decryptSecret } from '@/lib/credentials-encryption';
import { db } from '@/lib/db';
import {
  testRestaurantStripeCredentials,
  toRestaurantStripeRuntimeConfig,
} from '@/lib/restaurant-stripe-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  publishableKey: z.string().min(8).max(500).optional(),
  secretKey: z.string().min(8).max(500).optional(),
  webhookSecret: z.string().max(500).optional().nullable(),
  mode: z.enum(['test', 'live']).optional(),
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
    const fieldMsg = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .find((m): m is string => typeof m === 'string' && m.length > 0);
    return NextResponse.json(
      { error: fieldMsg ?? 'Invalid Stripe test request.' },
      { status: 400 }
    );
  }

  const existing = await db.restaurantStripeCredentials.findUnique({
    where: { restaurantId: session.ctx.restaurant.id },
  });

  const publishableKey =
    parsed.data.publishableKey?.trim() || existing?.publishableKey;
  const secretKey =
    parsed.data.secretKey?.trim() ||
    (existing ? decryptSecret(existing.secretKeyEnc) : '');
  const webhookSecret =
    parsed.data.webhookSecret === undefined
      ? existing?.webhookSecretEnc
        ? decryptSecret(existing.webhookSecretEnc)
        : null
      : parsed.data.webhookSecret?.trim() || null;
  const mode = parsed.data.mode ?? existing?.mode ?? 'test';

  if (!publishableKey || !secretKey) {
    return NextResponse.json(
      { error: 'Publishable key and secret key are required to test Stripe.' },
      { status: 400 }
    );
  }

  try {
    const runtime = toRestaurantStripeRuntimeConfig({
      publishableKey,
      secretKey,
      webhookSecret,
      mode,
    });
    await testRestaurantStripeCredentials(runtime);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Stripe connection test failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
