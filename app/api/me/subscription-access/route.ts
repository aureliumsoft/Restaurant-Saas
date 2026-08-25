import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { evaluateSubscriptionAccess } from '@/lib/subscription-access';
import { getPlanFeatures } from '@/lib/subscription-plan-features';
import { processSubscriptionLifecycle } from '@/lib/subscription-lifecycle';
import { isPeriodExpired } from '@/lib/subscription-period';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const restaurant = await db.restaurant.findUnique({
      where: { id: auth.restaurantId },
      select: {
        id: true,
        subscription: {
          select: {
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            plan: true,
          },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const pre = await db.restaurantSubscription.findUnique({
      where: { restaurantId: auth.restaurantId },
      select: {
        autoRenew: true,
        currentPeriodEnd: true,
        status: true,
      },
    });

    const shouldRenew =
      pre?.autoRenew === true &&
      (isPeriodExpired(pre.currentPeriodEnd) || pre.status === 'PAST_DUE');

    await processSubscriptionLifecycle(auth.restaurantId, {
      syncPayPal: shouldRenew,
    });

    const subscription = await db.restaurantSubscription.findUnique({
      where: { restaurantId: auth.restaurantId },
      select: {
        status: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        plan: true,
        autoRenew: true,
      },
    });

    const access = evaluateSubscriptionAccess(subscription);
    const plan = subscription?.plan ?? null;
    const limits = getPlanFeatures(plan);
    return NextResponse.json(
      {
        data: {
          ...access,
          plan,
          status: subscription?.status ?? null,
          trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
          currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
          autoRenew: subscription?.autoRenew ?? true,
          limits: {
            maxBranches: Number.isFinite(limits.maxBranches)
              ? limits.maxBranches
              : null,
            recommendations: limits.recommendations,
            roleBasedSettings: limits.roleBasedSettings,
            branding: limits.branding,
            advancedAnalytics: limits.advancedAnalytics,
            mobileApp: limits.mobileApp,
          },
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to evaluate subscription access' }, { status: 500 });
  }
}
