import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SubscriptionPlan } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  getPayPalConfigError,
  getPayPalPlatformConfig,
  isPayPalConfigured,
} from '@/lib/paypal-server';
import { syncRestaurantSubscriptionFromPayPal } from '@/lib/paypal-subscriptions';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';

export const runtime = 'nodejs';

const bodySchema = z.object({
  subscriptionId: z.string().min(3).max(200),
  plan: z.nativeEnum(SubscriptionPlan),
});

export async function POST(req: NextRequest) {
  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: getPayPalConfigError() ?? 'PayPal is not configured' },
      { status: 503 }
    );
  }

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
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const catalog = await db.subscriptionCatalog.findUnique({
    where: { plan: parsed.data.plan },
  });
  if (!catalog) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 404 });
  }

  const config = getPayPalPlatformConfig();

  try {
    const details = await syncRestaurantSubscriptionFromPayPal({
      restaurantId: session.ctx.restaurant.id,
      paypalSubscriptionId: parsed.data.subscriptionId,
      plan: parsed.data.plan,
      recordPayment: {
        amount: catalog.price,
        currency: config.currency,
        idempotencyKey: `paypal_sub_activate:${parsed.data.subscriptionId}`,
      },
    });

    const row = await db.restaurantSubscription.findUnique({
      where: { restaurantId: session.ctx.restaurant.id },
    });

    return NextResponse.json({
      data: {
        synced: true,
        status: details.status,
        subscription: row,
      },
    });
  } catch (e) {
    console.error('PayPal activate-subscription failed:', e);
    return NextResponse.json(
      { error: 'Could not activate subscription' },
      { status: 502 }
    );
  }
}
