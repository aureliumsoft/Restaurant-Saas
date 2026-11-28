import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAppSession } from '@/lib/auth/app-session';
import { db } from '@/lib/db';
import {
  capturePayPalOrder,
  getPayPalConfigError,
  getPayPalOrder,
  isPayPalConfigured,
} from '@/lib/paypal-server';
import { markRegistrationFeePaid } from '@/lib/registration-fee';
import { getRestaurantForUser } from '@/lib/restaurant-owner';

export const runtime = 'nodejs';

const bodySchema = z.object({
  orderId: z.string().min(3).max(200),
  restaurantId: z.string().min(1).max(64),
});

/**
 * Captures a platform PayPal one-time order and unlocks Free plan via registration fee.
 */
export async function POST(req: NextRequest) {
  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: getPayPalConfigError() ?? 'PayPal is not configured' },
      { status: 503 }
    );
  }

  const session = await getAppSession();
  const email =
    typeof session?.user?.email === 'string' ? session.user.email.trim() : '';
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const restaurant = await getRestaurantForUser(user.id);
  if (!restaurant || restaurant.id !== parsed.data.restaurantId) {
    return NextResponse.json(
      { error: 'Restaurant not found for this account' },
      { status: 403 }
    );
  }

  const freeCatalog = await db.subscriptionCatalog.findUnique({
    where: { plan: 'FREE' },
    select: { price: true },
  });
  const expectedAmount = freeCatalog?.price ?? 0;
  if (!(expectedAmount > 0)) {
    return NextResponse.json(
      { error: 'Registration fee is not configured (Free catalog price must be > 0).' },
      { status: 400 }
    );
  }

  let captured = false;
  let captureAmount = 0;
  let captureCurrency = 'EUR';

  try {
    const capture = await capturePayPalOrder(parsed.data.orderId);
    const pu = capture.purchase_units?.[0];
    const cap = pu?.payments?.captures?.[0];
    captured = String(cap?.status ?? '').toUpperCase() === 'COMPLETED';
    captureAmount = Number(cap?.amount?.value ?? 0) || 0;
    captureCurrency = String(cap?.amount?.currency_code ?? 'EUR').toUpperCase();
  } catch {
    const order = await getPayPalOrder(parsed.data.orderId);
    captured = String(order.status ?? '').toUpperCase() === 'COMPLETED';
    captureAmount = expectedAmount;
    captureCurrency = 'EUR';
  }

  if (!captured) {
    return NextResponse.json(
      { error: 'PayPal payment was not completed' },
      { status: 402 }
    );
  }

  const amount = captureAmount > 0 ? captureAmount : expectedAmount;

  const subscription = await markRegistrationFeePaid({
    restaurantId: restaurant.id,
    amount,
    currency: captureCurrency,
    notes: `registration_fee:paypal:${parsed.data.orderId}`,
  });

  return NextResponse.json({
    data: {
      synced: true,
      registrationFeePaid: subscription.registrationFeePaid,
      plan: subscription.plan,
      status: subscription.status,
    },
  });
}
