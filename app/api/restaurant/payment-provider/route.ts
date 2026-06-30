import { CustomerPaymentProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getRestaurantPaymentProviderDto,
  setRestaurantPaymentProvider,
} from '@/lib/restaurant-payment-credentials';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  provider: z.nativeEnum(CustomerPaymentProvider),
  paymentTerminalIp: z.string().max(45).optional().nullable(),
});

export async function GET() {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  try {
    const data = await getRestaurantPaymentProviderDto(session.ctx.restaurant.id);
    return NextResponse.json({ data });
  } catch (e) {
    console.error('payment-provider GET failed:', e);
    return NextResponse.json(
      { error: 'Could not load payment provider settings.' },
      { status: 500 }
    );
  }
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
    await setRestaurantPaymentProvider(
      session.ctx.restaurant.id,
      parsed.data.provider,
      parsed.data.paymentTerminalIp
    );
    const data = await getRestaurantPaymentProviderDto(session.ctx.restaurant.id);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not update payment provider.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
