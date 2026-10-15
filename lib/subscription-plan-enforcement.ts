import { NextResponse } from 'next/server';

import {
  canCreateCap,
  canCreatePerBranchCap,
  getRestaurantEntitlements,
  isPaidModule,
  type CapKey,
  type Entitlements,
  type ModuleKey,
} from '@/lib/entitlements';
import { getRestaurantPaymentProviderDto } from '@/lib/restaurant-payment-credentials';
import {
  getPlanFeatures,
  planFeaturesFromEntitlements,
  type PlanFeatureMatrix,
} from '@/lib/subscription-plan-features';

export type { PlanFeatureMatrix } from '@/lib/subscription-plan-features';
export type { Entitlements };

export async function getRestaurantPlanFeatures(
  restaurantId: string
): Promise<PlanFeatureMatrix> {
  const e = await getRestaurantEntitlements(restaurantId);
  return planFeaturesFromEntitlements(e);
}

export async function getRestaurantEntitlementsForApi(
  restaurantId: string
): Promise<Entitlements> {
  return getRestaurantEntitlements(restaurantId);
}

export function subscriptionPlanDeniedResponse(featureLabel: string) {
  return NextResponse.json(
    {
      error: `${featureLabel} is not included on your current plan. Upgrade from Pricing.`,
    },
    { status: 403 }
  );
}

export function subscriptionLimitDeniedResponse(featureLabel: string) {
  return NextResponse.json(
    {
      error: `${featureLabel} limit reached on your current plan. Upgrade from Pricing.`,
    },
    { status: 403 }
  );
}

/** Hard 403 when create would exceed plan cap. */
export async function assertCreateCap(
  restaurantId: string,
  capKey: CapKey,
  currentCount: number,
  featureLabel: string
) {
  const e = await getRestaurantEntitlements(restaurantId);
  if (!canCreateCap(e, capKey, currentCount)) {
    return subscriptionLimitDeniedResponse(featureLabel);
  }
  return null;
}

/** Hard 403 when users/roles create would exceed per-branch × branchCount. */
export async function assertPerBranchCreateCap(
  restaurantId: string,
  capKey: 'users' | 'roles',
  currentCount: number,
  branchCount: number,
  featureLabel: string
) {
  const e = await getRestaurantEntitlements(restaurantId);
  if (!canCreatePerBranchCap(e, capKey, currentCount, branchCount)) {
    return subscriptionLimitDeniedResponse(featureLabel);
  }
  return null;
}

/** Hard 403 when module is Paid on the plan. */
export async function assertModuleNotPaid(
  restaurantId: string,
  moduleKey: ModuleKey,
  featureLabel: string
) {
  const e = await getRestaurantEntitlements(restaurantId);
  if (isPaidModule(e, moduleKey)) {
    return subscriptionPlanDeniedResponse(featureLabel);
  }
  return null;
}

export type OnlinePaymentProviderKey =
  | 'stripe'
  | 'paypal'
  | 'jazzcash'
  | 'easypaisa';

/** Allow updating an already-configured PSP; block new ones past cap / Paid. */
export async function assertCanConfigureOnlinePayment(
  restaurantId: string,
  providerKey: OnlinePaymentProviderKey
) {
  const paid = await assertModuleNotPaid(
    restaurantId,
    'onlinePayments',
    'Online payments'
  );
  if (paid) return paid;

  const e = await getRestaurantEntitlements(restaurantId);
  const dto = await getRestaurantPaymentProviderDto(restaurantId);
  if (dto[providerKey].configured) return null;

  const count = [
    dto.stripe,
    dto.paypal,
    dto.jazzcash,
    dto.easypaisa,
  ].filter((p) => p.configured).length;
  if (!canCreateCap(e, 'onlinePaymentMethods', count)) {
    return subscriptionLimitDeniedResponse('Online payment methods');
  }
  return null;
}

/** Re-export for callers that still import getPlanFeatures from here. */
export { getPlanFeatures };
