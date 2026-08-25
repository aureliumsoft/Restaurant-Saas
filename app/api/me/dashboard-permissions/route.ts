import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAppSession } from '@/lib/auth/app-session';
import { db } from '@/lib/db';
import { SubscriptionPlan } from '@prisma/client';

import { getEffectiveDashboardPermissionNames } from '@/lib/restaurant-roles';
import { getRestaurantForUser } from '@/lib/restaurant-owner';
import { getPlanFeatures } from '@/lib/subscription-plan-features';

export async function GET(_req: NextRequest) {
  try {
    const session = await getAppSession();
    const email = session?.user?.email;
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const restaurant = await getRestaurantForUser(user.id);
    if (!restaurant) {
      const f0 = getPlanFeatures(SubscriptionPlan.STARTER);
      return NextResponse.json({
        permissions: [],
        plan: {
          maxBranches: f0.maxBranches,
          recommendations: f0.recommendations,
          roleBasedSettings: f0.roleBasedSettings,
          branding: f0.branding,
          advancedAnalytics: f0.advancedAnalytics,
          mobileApp: f0.mobileApp,
        },
      });
    }

    const [permissions, sub] = await Promise.all([
      getEffectiveDashboardPermissionNames(user.id, restaurant.id),
      db.restaurantSubscription.findUnique({
        where: { restaurantId: restaurant.id },
        select: { plan: true },
      }),
    ]);

    const f = getPlanFeatures(sub?.plan ?? SubscriptionPlan.STARTER);

    return NextResponse.json({
      permissions,
      plan: {
        maxBranches: Number.isFinite(f.maxBranches) ? f.maxBranches : null,
        recommendations: f.recommendations,
        roleBasedSettings: f.roleBasedSettings,
        branding: f.branding,
        advancedAnalytics: f.advancedAnalytics,
        mobileApp: f.mobileApp,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load permissions' },
      { status: 500 }
    );
  }
}
