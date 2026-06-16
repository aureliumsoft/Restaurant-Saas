import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { isPayPalNetworkError } from '@/lib/paypal-network';
import { getPayPalSubscriptionDetails } from '@/lib/paypal-subscriptions';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';
import { processSubscriptionLifecycle } from '@/lib/subscription-lifecycle';
import { isPeriodExpired } from '@/lib/subscription-period';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  const refresh = new URL(req.url).searchParams.get('refresh') === '1';
  const { restaurant } = session.ctx;

  let subscription = await db.restaurantSubscription.findUnique({
    where: { restaurantId: restaurant.id },
  });

  const periodExpired = isPeriodExpired(subscription?.currentPeriodEnd ?? null);
  const shouldSyncPayPal =
    refresh || (periodExpired && subscription?.autoRenew === true);

  subscription = await processSubscriptionLifecycle(restaurant.id, {
    syncPayPal: shouldSyncPayPal,
  });

  const catalog = subscription
    ? await db.subscriptionCatalog.findUnique({
        where: { plan: subscription.plan },
      })
    : null;

  const recentPayments = await db.subscriptionPayment.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { paidAt: 'desc' },
    take: 5,
    select: {
      id: true,
      amount: true,
      currency: true,
      paidAt: true,
      periodStart: true,
      periodEnd: true,
    },
  });

  let currentPeriodEnd = subscription?.currentPeriodEnd ?? null;
  let paypalStatus: string | null = null;

  if (shouldSyncPayPal && subscription?.paypalSubscriptionId) {
    try {
      const live = await getPayPalSubscriptionDetails(
        subscription.paypalSubscriptionId
      );
      paypalStatus = live.status;
      subscription = await db.restaurantSubscription.findUnique({
        where: { restaurantId: restaurant.id },
      });
      currentPeriodEnd = subscription?.currentPeriodEnd ?? null;
    } catch (e) {
      if (!isPayPalNetworkError(e)) {
        console.error('Billing refresh from PayPal failed:', e);
      }
    }
  }

  return NextResponse.json({
    data: {
      plan: subscription?.plan ?? null,
      planName: catalog?.name ?? null,
      priceLabel: catalog?.priceLabel ?? null,
      status: subscription?.status ?? null,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
      autoRenew: subscription?.autoRenew ?? true,
      paypalSubscriptionId: subscription?.paypalSubscriptionId ?? null,
      paypalStatus,
      recentPayments: recentPayments.map((p) => ({
        ...p,
        paidAt: p.paidAt.toISOString(),
        periodStart: p.periodStart?.toISOString() ?? null,
        periodEnd: p.periodEnd?.toISOString() ?? null,
      })),
    },
  });
}
