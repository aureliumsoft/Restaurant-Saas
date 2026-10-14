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

  const {
    assertModuleNotPaid,
    assertCanConfigureOnlinePayment,
  } = await import('@/lib/subscription-plan-enforcement');

  const terminalIp =
    typeof parsed.data.paymentTerminalIp === 'string'
      ? parsed.data.paymentTerminalIp.trim()
      : parsed.data.paymentTerminalIp;
  if (terminalIp) {
    const terminalDenied = await assertModuleNotPaid(
      session.ctx.restaurant.id,
      'terminalPayment',
      'Terminal payment'
    );
    if (terminalDenied) return terminalDenied;
  }

  if (parsed.data.provider !== CustomerPaymentProvider.NONE) {
    const onlinePaid = await assertModuleNotPaid(
      session.ctx.restaurant.id,
      'onlinePayments',
      'Online payments'
    );
    if (onlinePaid) return onlinePaid;
  }

  const providerKey =
    parsed.data.provider === CustomerPaymentProvider.STRIPE
      ? 'stripe'
      : parsed.data.provider === CustomerPaymentProvider.PAYPAL
        ? 'paypal'
        : null;
  if (providerKey) {
    const onlineDenied = await assertCanConfigureOnlinePayment(
      session.ctx.restaurant.id,
      providerKey
    );
    if (onlineDenied) return onlineDenied;
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
