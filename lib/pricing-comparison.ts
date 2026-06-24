import { SubscriptionPlan } from '@prisma/client';

import { getPlanFeatures } from '@/lib/subscription-plan-features';

export type PricingComparisonRow = {
  id: string;
  label: string;
  included: (plan: string) => boolean;
};

/** Canonical feature rows shown on the public pricing comparison. */
export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    id: 'menu_tools',
    label: 'Menu & order tools',
    included: () => true,
  },
  {
    id: 'dashboard',
    label: 'Basic dashboard metrics',
    included: () => true,
  },
  {
    id: 'one_branch',
    label: '1 branch maximum',
    included: (plan) => plan === SubscriptionPlan.STARTER,
  },
  {
    id: 'five_branches',
    label: 'Up to 5 branches',
    included: (plan) => plan === SubscriptionPlan.GROWTH,
  },
  {
    id: 'unlimited_branches',
    label: 'Unlimited branches',
    included: (plan) => plan === SubscriptionPlan.SCALE,
  },
  {
    id: 'roles',
    label: 'Role-based users & permissions',
    included: (plan) => getPlanFeatures(plan).roleBasedSettings,
  },
  {
    id: 'analytics',
    label: 'Advanced analytics & 7-day charts',
    included: (plan) => getPlanFeatures(plan).advancedAnalytics,
  },
  {
    id: 'branding',
    label: 'Logo, banners & theme customization',
    included: (plan) => getPlanFeatures(plan).branding,
  },
  {
    id: 'recommendations',
    label: 'Recommendations & add-ons',
    included: (plan) => getPlanFeatures(plan).recommendations,
  },
  {
    id: 'priority_support',
    label: 'Priority support',
    included: (plan) => plan === SubscriptionPlan.SCALE,
  },
  {
    id: 'integrations',
    label: 'Custom integrations',
    included: (plan) => plan === SubscriptionPlan.SCALE,
  },
  {
    id: 'onboarding',
    label: 'Dedicated onboarding',
    included: (plan) => plan === SubscriptionPlan.SCALE,
  },
];

export function planIncludesComparisonFeature(
  plan: string,
  row: PricingComparisonRow
): boolean {
  return row.included(plan.toUpperCase());
}
