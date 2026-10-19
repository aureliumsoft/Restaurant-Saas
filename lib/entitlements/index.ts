export type {
  CapKey,
  Entitlements,
  ModuleAccess,
  ModuleEntitlement,
  ModuleKey,
  PlanCaps,
} from '@/lib/entitlements/types';
export {
  DASHBOARD_TO_MODULE,
  MODULE_KEYS,
} from '@/lib/entitlements/types';
export {
  CUSTOM_SELECTION_MODULES,
  CUSTOM_UNLOCKABLE_LIMITED,
} from '@/lib/entitlements/plan-matrices';
export {
  resolveEntitlements,
  getRestaurantEntitlements,
  getModule,
  isPaidModule,
  isFullModule,
  canAccessModule,
  moduleLimitFlag,
  canCreate,
  canCreateCap,
  effectivePerBranchCap,
  canCreatePerBranchCap,
  entitlementModuleForNav,
  isNavModulePremium,
  entitlementsToClientPayload,
} from '@/lib/entitlements/resolve';
export { getPublicModuleGate } from '@/lib/entitlements/public';
export {
  getCapUsage,
  countCapUsage,
  buildCapUsageSnapshot,
  type CapUsageSnapshot,
  type CapUsageKey,
  type CapUsageCounts,
  type CapUsageOverLimit,
} from '@/lib/entitlements/cap-usage';
export { syncPlanQuotaLocks } from '@/lib/entitlements/sync-plan-quota-locks';
