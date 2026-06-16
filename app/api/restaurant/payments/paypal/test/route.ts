import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decryptSecret } from '@/lib/credentials-encryption';
import { db } from '@/lib/db';
import {
  testRestaurantPayPalCredentials,
  toRestaurantPayPalRuntimeConfig,
} from '@/lib/restaurant-paypal-client';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  clientId: z.string().min(3).max(500).optional(),
  clientSecret: z.string().min(3).max(500).optional(),
  webhookId: z.string().max(200).optional().nullable(),
  mode: z.enum(['sandbox', 'live']).optional(),
  currency: z.string().min(3).max(3).optional(),
  countryCode: z.string().length(2).optional(),
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
      { error: fieldMsg ?? 'Invalid PayPal test request.' },
      { status: 400 }
    );
  }

  const existing = await db.restaurantPayPalCredentials.findUnique({
    where: { restaurantId: session.ctx.restaurant.id },
  });

  const clientId = parsed.data.clientId?.trim() || existing?.clientId;
  const clientSecret =
    parsed.data.clientSecret?.trim() ||
    (existing ? decryptSecret(existing.clientSecretEnc) : '');
  const mode = parsed.data.mode ?? existing?.mode ?? 'sandbox';
  const currency = parsed.data.currency ?? existing?.currency ?? 'EUR';
  const countryCode =
    parsed.data.countryCode ?? existing?.countryCode ?? undefined;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Client ID and client secret are required to test PayPal.' },
      { status: 400 }
    );
  }

  try {
    const runtime = toRestaurantPayPalRuntimeConfig({
      clientId,
      clientSecret,
      mode,
      currency,
      countryCode,
    });
    await testRestaurantPayPalCredentials(runtime);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'PayPal connection test failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
