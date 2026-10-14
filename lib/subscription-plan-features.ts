import { SubscriptionPlan } from '@prisma/client';

import {
  canAccessModule,
  resolveEntitlements,
  type Entitlements,
} from '@/lib/entitlements';

/** @deprecated Prefer Entitlements; kept for existing call sites. */
export type PlanFeatureMatrix = {
  plan: SubscriptionPlan;
  maxBranches: number;
  recommendations: boolean;
  roleBasedSettings: boolean;
  branding: boolean;
  advancedAnalytics: boolean;
  mobileApp: boolean;
};

export function planFeaturesFromEntitlements(e: Entitlements): PlanFeatureMatrix {
  const branches = e.caps.branches;
  return {
    plan: e.plan,
    maxBranches: branches == null ? 9999 : branches,
    recommendations: canAccessModule(e, 'configuration'),
    roleBasedSettings: canAccessModule(e, 'usersRoles'),
    branding:
      e.caps.mainBanner ||
      e.caps.menuBanners === null ||
      (typeof e.caps.menuBanners === 'number' && e.caps.menuBanners > 0),
    advancedAnalytics:
      e.modules.dashboard.access !== 'paid' &&
      (e.modules.dashboard.limits?.days14 === true ||
        e.plan !== SubscriptionPlan.FREE),
    mobileApp: canAccessModule(e, 'mobileApp'),
  };
}

export function getPlanFeatures(
  plan: SubscriptionPlan | string | null,
  customSelectedModules: string[] = []
): PlanFeatureMatrix {
  return planFeaturesFromEntitlements(
    resolveEntitlements(plan, customSelectedModules)
  );
}

export function branchCapacityAllows(
  currentBranchCount: number,
  branchesToAdd: number,
  f: PlanFeatureMatrix
): boolean {
  return currentBranchCount + branchesToAdd <= f.maxBranches;
}
