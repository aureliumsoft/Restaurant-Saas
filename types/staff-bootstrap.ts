import type { BranchOption } from '@/lib/branch/branch-scope';
import type { CapUsageSnapshot, PlanCaps } from '@/lib/entitlements';
import type { RestaurantRegionalSettings } from '@/lib/restaurant-regional';
import type { RestaurantServiceCharges } from '@/lib/restaurant-service-charge';
import type { RestaurantFulfillmentSettings } from '@/lib/restaurant-fulfillment-settings';

export type StaffBootstrapModuleEntitlement = {
  access: 'full' | 'limited' | 'paid';
  limits?: Record<string, number | boolean | string>;
};

export type StaffBootstrapCapUsage = Pick<
  CapUsageSnapshot,
  'usage' | 'overLimit' | 'anyOverLimit'
>;

export type StaffBootstrapPlan = {
  maxBranches: number | null;
  recommendations: boolean;
  roleBasedSettings: boolean;
  branding: boolean;
  advancedAnalytics: boolean;
  mobileApp: boolean;
  planId?: string;
  modules?: Record<string, StaffBootstrapModuleEntitlement>;
  caps?: PlanCaps;
  customSelectedModules?: string[];
  capUsage?: StaffBootstrapCapUsage;
};

export type StaffBootstrapBranchScope = {
  activeBranchId: string | null;
  allowedBranchIds: string[];
  branches: BranchOption[];
  canSwitchBranch: boolean;
  isOwnerOrAdmin: boolean;
};

export type StaffBootstrapRestaurant = {
  id: string;
  name: string;
  slug: string | null;
  subdomain: string | null;
  logoUrl: string | null;
  mainBannerUrl?: string | null;
  menuBannerUrls?: string[];
  themePrimaryColor?: string | null;
  regional?: RestaurantRegionalSettings;
  serviceCharges?: RestaurantServiceCharges;
  fulfillmentSettings?: RestaurantFulfillmentSettings;
  currencyCode?: string;
  countryCode?: string;
};

export type StaffBootstrapSubscription = {
  allowed: boolean;
  warning: string | null;
  plan: string | null;
  status: string | null;
};

export type StaffBootstrapData = {
  permissions: string[];
  plan: StaffBootstrapPlan;
  regional: RestaurantRegionalSettings;
  restaurant: StaffBootstrapRestaurant | null;
  serviceCharges: StaffBootstrapRestaurant | null;
  branchScope: StaffBootstrapBranchScope | null;
  subscription: StaffBootstrapSubscription;
};

export type StaffBootstrapResponse = {
  data?: StaffBootstrapData;
};

export const STAFF_BOOTSTRAP_KEY = '/api/me/bootstrap' as const;
