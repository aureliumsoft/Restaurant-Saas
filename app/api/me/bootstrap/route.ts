import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SubscriptionPlan } from '@prisma/client';

import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import { getAppSession } from '@/lib/auth/app-session';
import { db } from '@/lib/db';
import {
  RESTAURANT_BRANDING_DB_SELECT,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  isPrismaUnknownFieldError,
  withDefaultServiceChargesPayload,
  withServiceChargesPayload,
} from '@/lib/restaurant-service-charge';
import { getEffectiveDashboardPermissionNames } from '@/lib/restaurant-roles';
import { getRestaurantForUser } from '@/lib/restaurant-owner';
import {
  parseRestaurantRegionalSettings,
  RESTAURANT_REGIONAL_DB_SELECT,
} from '@/lib/restaurant-regional';
import { evaluateSubscriptionAccess } from '@/lib/subscription-access';
import { processSubscriptionLifecycle } from '@/lib/subscription-lifecycle';
import { isPeriodExpired } from '@/lib/subscription-period';
import { getPlanFeatures } from '@/lib/subscription-plan-features';
import type { StaffBootstrapData } from '@/types/staff-bootstrap';

export const dynamic = 'force-dynamic';

async function loadSubscriptionAccess(restaurantId: string) {
  const pre = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
    select: {
      autoRenew: true,
      currentPeriodEnd: true,
      status: true,
    },
  });

  const shouldRenew =
    pre?.autoRenew === true &&
    (isPeriodExpired(pre.currentPeriodEnd) || pre.status === 'PAST_DUE');

  await processSubscriptionLifecycle(restaurantId, {
    syncPayPal: shouldRenew,
  });

  const subscription = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
    select: {
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      plan: true,
    },
  });

  const access = evaluateSubscriptionAccess(subscription);
  return {
    allowed: access.allowed,
    warning: access.warning,
    plan: subscription?.plan ?? null,
    status: subscription?.status ?? null,
  };
}

/** Single bootstrap payload: permissions, branches, regional, branding, subscription. */
export async function GET(req: NextRequest) {
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
      const payload: StaffBootstrapData = {
        permissions: [],
        plan: {
          maxBranches: f0.maxBranches,
          recommendations: f0.recommendations,
          roleBasedSettings: f0.roleBasedSettings,
          branding: f0.branding,
          advancedAnalytics: f0.advancedAnalytics,
        },
        regional: parseRestaurantRegionalSettings(null),
        restaurant: null,
        serviceCharges: null,
        branchScope: null,
        subscription: {
          allowed: false,
          warning: null,
          plan: null,
          status: null,
        },
      };
      return NextResponse.json({ data: payload });
    }

    const branchScope = await getBranchScopeFromRequest(
      req,
      user.id,
      restaurant.id
    );

    const selectWithCharges = {
      ...RESTAURANT_BRANDING_DB_SELECT,
      ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
      ...RESTAURANT_REGIONAL_DB_SELECT,
      subdomain: true,
    } as const;

    let restaurantPayload: Record<string, unknown> | null = null;
    try {
      const row = await db.restaurant.findUnique({
        where: { id: restaurant.id },
        select: selectWithCharges,
      });
      if (row) {
        restaurantPayload = {
          ...withServiceChargesPayload(row),
          regional: parseRestaurantRegionalSettings(row),
        };
      }
    } catch (error) {
      if (!isPrismaUnknownFieldError(error)) throw error;
      const row = await db.restaurant.findUnique({
        where: { id: restaurant.id },
        select: {
          id: true,
          name: true,
          slug: true,
          subdomain: true,
          logoUrl: true,
          mainBannerUrl: true,
          menuBannerUrls: true,
          themePrimaryColor: true,
        },
      });
      if (row) {
        restaurantPayload = {
          ...withDefaultServiceChargesPayload(row),
          regional: parseRestaurantRegionalSettings(null),
        };
      }
    }

    const [permissions, sub, subscription] = await Promise.all([
      getEffectiveDashboardPermissionNames(user.id, restaurant.id),
      db.restaurantSubscription.findUnique({
        where: { restaurantId: restaurant.id },
        select: { plan: true },
      }),
      loadSubscriptionAccess(restaurant.id),
    ]);

    const f = getPlanFeatures(sub?.plan ?? SubscriptionPlan.STARTER);

    const payload: StaffBootstrapData = {
      permissions,
      plan: {
        maxBranches: Number.isFinite(f.maxBranches) ? f.maxBranches : null,
        recommendations: f.recommendations,
        roleBasedSettings: f.roleBasedSettings,
        branding: f.branding,
        advancedAnalytics: f.advancedAnalytics,
      },
      regional: parseRestaurantRegionalSettings(
        restaurantPayload as { currencyCode?: string; countryCode?: string } | null
      ),
      restaurant: restaurantPayload as StaffBootstrapData['restaurant'],
      serviceCharges: restaurantPayload as StaffBootstrapData['serviceCharges'],
      branchScope: branchScope
        ? {
            activeBranchId: branchScope.activeBranchId,
            allowedBranchIds: branchScope.allowedBranchIds,
            branches: branchScope.branches,
            canSwitchBranch: branchScope.canSwitchBranch,
            isOwnerOrAdmin: branchScope.isOwnerOrAdmin,
          }
        : null,
      subscription,
    };

    return NextResponse.json({ data: payload });
  } catch (e) {
    console.error('bootstrap GET', e);
    return NextResponse.json(
      { error: 'Failed to load bootstrap data' },
      { status: 500 }
    );
  }
}
