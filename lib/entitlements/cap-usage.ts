import type { SubscriptionPlan } from '@prisma/client';

import { db } from '@/lib/db';
import {
  getRestaurantEntitlements,
  type Entitlements,
  type PlanCaps,
} from '@/lib/entitlements';

export type CapUsageKey =
  | 'products'
  | 'categories'
  | 'variations'
  | 'branches';

export type CapUsageCounts = Record<CapUsageKey, number>;

export type CapUsageOverLimit = Record<CapUsageKey, boolean>;

export type CapUsageSnapshot = {
  plan: SubscriptionPlan;
  caps: PlanCaps;
  usage: CapUsageCounts;
  overLimit: CapUsageOverLimit;
  /** True when any counted resource exceeds its finite cap. */
  anyOverLimit: boolean;
};

function isOver(cap: number | null | undefined, used: number): boolean {
  if (cap == null) return false;
  return used > cap;
}

export async function countCapUsage(
  restaurantId: string
): Promise<CapUsageCounts> {
  const [products, categories, variations, branches] = await Promise.all([
    db.menuItem.count({ where: { restaurantId } }),
    db.menuCategory.count({ where: { restaurantId } }),
    db.restaurantVariation.count({ where: { restaurantId } }),
    db.branch.count({ where: { restaurantId } }),
  ]);
  return { products, categories, variations, branches };
}

export function buildCapUsageSnapshot(
  entitlements: Entitlements,
  usage: CapUsageCounts
): CapUsageSnapshot {
  const { caps, plan } = entitlements;
  const overLimit: CapUsageOverLimit = {
    products: isOver(caps.products, usage.products),
    categories: isOver(caps.categories, usage.categories),
    variations: isOver(caps.variations, usage.variations),
    branches: isOver(caps.branches, usage.branches),
  };
  return {
    plan,
    caps,
    usage,
    overLimit,
    anyOverLimit: Object.values(overLimit).some(Boolean),
  };
}

export async function getCapUsage(
  restaurantId: string,
  entitlements?: Entitlements
): Promise<CapUsageSnapshot> {
  const [e, usage] = await Promise.all([
    entitlements
      ? Promise.resolve(entitlements)
      : getRestaurantEntitlements(restaurantId),
    countCapUsage(restaurantId),
  ]);
  return buildCapUsageSnapshot(e, usage);
}
