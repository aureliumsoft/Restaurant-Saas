import { SubscriptionPlan } from '@prisma/client';

import {
  BASIC_MODULES,
  PRO_CAPS,
  capsForPlan,
  modulesForPlan,
  CUSTOM_SELECTION_MODULES,
  CUSTOM_UNLOCKABLE_LIMITED,
} from '@/lib/entitlements/plan-matrices';
import type {
  CapKey,
  Entitlements,
  ModuleAccess,
  ModuleEntitlement,
  ModuleKey,
  PlanCaps,
} from '@/lib/entitlements/types';
import { DASHBOARD_TO_MODULE, MODULE_KEYS } from '@/lib/entitlements/types';
import { db } from '@/lib/db';

function normalizePlan(plan: SubscriptionPlan | string | null): SubscriptionPlan {
  const key = (plan ?? SubscriptionPlan.FREE).toString().toUpperCase();
  if (key === 'STARTER') return SubscriptionPlan.FREE;
  if (
    key === SubscriptionPlan.BASIC ||
    key === SubscriptionPlan.GROWTH ||
    key === SubscriptionPlan.SCALE ||
    key === SubscriptionPlan.PRO ||
    key === SubscriptionPlan.CUSTOM ||
    key === SubscriptionPlan.FREE
  ) {
    return key as SubscriptionPlan;
  }
  return SubscriptionPlan.FREE;
}

function mergeCustomModules(
  selected: string[]
): Record<ModuleKey, ModuleEntitlement> {
  const selectedSet = new Set(
    selected.map((s) => s.trim()).filter(Boolean)
  );
  const modules = modulesForPlan(SubscriptionPlan.CUSTOM);

  for (const key of CUSTOM_SELECTION_MODULES) {
    if (selectedSet.has(key)) {
      modules[key] = { access: 'full' };
    } else {
      modules[key] = { access: 'paid' };
    }
  }

  for (const key of CUSTOM_UNLOCKABLE_LIMITED) {
    if (selectedSet.has(key)) {
      modules[key] = { access: 'full' };
    } else {
      // Basic-plan limited behavior
      modules[key] = BASIC_MODULES[key]
        ? { ...BASIC_MODULES[key] }
        : { access: 'limited' };
    }
  }

  // Caps: start from Basic; unlock unlimited-ish when branches/users checked
  return modules;
}

function capsForCustom(selected: string[]): PlanCaps {
  const selectedSet = new Set(selected);
  const caps = capsForPlan(SubscriptionPlan.CUSTOM);
  if (selectedSet.has('branches')) {
    caps.branches = PRO_CAPS.branches;
  }
  if (selectedSet.has('usersRoles')) {
    caps.users = PRO_CAPS.users;
    caps.roles = PRO_CAPS.roles;
  }
  if (selectedSet.has('basicSettings')) {
    caps.menuBanners = null;
    caps.mainBanner = true;
  }
  if (selectedSet.has('onlinePayments')) {
    caps.onlinePaymentMethods = null;
  }
  if (selectedSet.has('configuration')) {
    // configuration unlock implies recommendations full
  }
  return caps;
}

export function resolveEntitlements(
  plan: SubscriptionPlan | string | null,
  customSelectedModules: string[] = []
): Entitlements {
  const normalized = normalizePlan(plan);
  if (normalized === SubscriptionPlan.CUSTOM) {
    return {
      plan: normalized,
      modules: mergeCustomModules(customSelectedModules),
      caps: capsForCustom(customSelectedModules),
      customSelectedModules: [...customSelectedModules],
    };
  }
  return {
    plan: normalized,
    modules: modulesForPlan(normalized),
    caps: capsForPlan(normalized),
    customSelectedModules: [],
  };
}

export async function getRestaurantEntitlements(
  restaurantId: string
): Promise<Entitlements> {
  const sub = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
    select: { plan: true, customSelectedModules: true },
  });
  return resolveEntitlements(
    sub?.plan ?? SubscriptionPlan.FREE,
    sub?.customSelectedModules ?? []
  );
}

export function getModule(
  e: Entitlements,
  key: ModuleKey
): ModuleEntitlement {
  return e.modules[key] ?? { access: 'paid' };
}

export function isPaidModule(e: Entitlements, key: ModuleKey): boolean {
  return getModule(e, key).access === 'paid';
}

export function isFullModule(e: Entitlements, key: ModuleKey): boolean {
  return getModule(e, key).access === 'full';
}

export function canAccessModule(e: Entitlements, key: ModuleKey): boolean {
  const access = getModule(e, key).access;
  return access === 'full' || access === 'limited';
}

export function moduleLimitFlag(
  e: Entitlements,
  key: ModuleKey,
  flag: string,
  fallback = false
): boolean {
  const v = getModule(e, key).limits?.[flag];
  return typeof v === 'boolean' ? v : fallback;
}

/** null cap = unlimited; 0 = none allowed */
export function canCreate(cap: number | null | undefined, currentCount: number): boolean {
  if (cap == null) return true;
  if (cap <= 0) return false;
  return currentCount < cap;
}

export function canCreateCap(
  e: Entitlements,
  key: CapKey,
  currentCount: number
): boolean {
  return canCreate(e.caps[key] as number | null, currentCount);
}

/** users/roles caps are per-branch; restaurant max = perBranch × branchCount. */
export function effectivePerBranchCap(
  perBranchCap: number | null | undefined,
  branchCount: number
): number | null {
  if (perBranchCap == null) return null;
  if (perBranchCap <= 0) return 0;
  return perBranchCap * Math.max(1, branchCount);
}

export function canCreatePerBranchCap(
  e: Entitlements,
  key: 'users' | 'roles',
  currentCount: number,
  branchCount: number
): boolean {
  return canCreate(
    effectivePerBranchCap(e.caps[key], branchCount),
    currentCount
  );
}

export function entitlementModuleForNav(
  dashboardModuleKey: string
): ModuleKey | null {
  return DASHBOARD_TO_MODULE[dashboardModuleKey] ?? null;
}

export function isNavModulePremium(
  e: Entitlements,
  dashboardModuleKey: string
): boolean {
  const key = entitlementModuleForNav(dashboardModuleKey);
  if (!key) return false;
  return isPaidModule(e, key);
}

/** Serialize for bootstrap / client. */
export function entitlementsToClientPayload(e: Entitlements): {
  planId: SubscriptionPlan;
  maxBranches: number | null;
  recommendations: boolean;
  roleBasedSettings: boolean;
  branding: boolean;
  advancedAnalytics: boolean;
  mobileApp: boolean;
  modules: Record<
    string,
    {
      access: ModuleAccess;
      limits?: Record<string, number | boolean | string>;
    }
  >;
  caps: PlanCaps;
  customSelectedModules: string[];
} {
  const modules: Record<
    string,
    {
      access: ModuleAccess;
      limits?: Record<string, number | boolean | string>;
    }
  > = {};
  for (const key of MODULE_KEYS) {
    modules[key] = {
      access: e.modules[key].access,
      ...(e.modules[key].limits
        ? { limits: e.modules[key].limits }
        : {}),
    };
  }
  return {
    planId: e.plan,
    maxBranches: e.caps.branches,
    recommendations: canAccessModule(e, 'configuration'),
    roleBasedSettings: canAccessModule(e, 'usersRoles'),
    branding: canAccessModule(e, 'basicSettings') && e.caps.mainBanner,
    advancedAnalytics: moduleLimitFlag(e, 'dashboard', 'days14', e.plan !== SubscriptionPlan.FREE),
    mobileApp: canAccessModule(e, 'mobileApp'),
    modules,
    caps: e.caps,
    customSelectedModules: e.customSelectedModules,
  };
}
