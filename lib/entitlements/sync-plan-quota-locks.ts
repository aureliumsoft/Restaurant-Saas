import { getRestaurantEntitlements } from '@/lib/entitlements/resolve';
import { db } from '@/lib/db';

/**
 * Soft-lock newest excess products/categories/variations/branches after a plan downgrade.
 * Keeps oldest rows up to the cap sellable; unlocks planQuotaLocked rows when under cap.
 * Does not flip manually hidden categories (showInFront=false without planQuotaLocked).
 */
export async function syncPlanQuotaLocks(restaurantId: string): Promise<void> {
  const entitlements = await getRestaurantEntitlements(restaurantId);
  const productCap = entitlements.caps.products;
  const categoryCap = entitlements.caps.categories;
  const variationCap = entitlements.caps.variations;
  const branchCap = entitlements.caps.branches;

  await Promise.all([
    syncMenuItemQuotaLocks(restaurantId, productCap),
    syncMenuCategoryQuotaLocks(restaurantId, categoryCap),
    syncRestaurantVariationQuotaLocks(restaurantId, variationCap),
    syncBranchQuotaLocks(restaurantId, branchCap),
  ]);
}

async function syncMenuItemQuotaLocks(
  restaurantId: string,
  cap: number | null
): Promise<void> {
  if (cap == null) {
    await db.menuItem.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { isActive: true, planQuotaLocked: false },
    });
    return;
  }

  const items = await db.menuItem.findMany({
    where: { restaurantId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, planQuotaLocked: true },
  });

  if (items.length <= cap) {
    await db.menuItem.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { isActive: true, planQuotaLocked: false },
    });
    return;
  }

  const keepIds = items.slice(0, cap).map((i) => i.id);
  const lockIds = items.slice(cap).map((i) => i.id);
  const keepLockedIds = items
    .slice(0, cap)
    .filter((i) => i.planQuotaLocked)
    .map((i) => i.id);

  await Promise.all([
    keepLockedIds.length > 0
      ? db.menuItem.updateMany({
          where: { id: { in: keepLockedIds } },
          data: { isActive: true, planQuotaLocked: false },
        })
      : Promise.resolve(),
    lockIds.length > 0
      ? db.menuItem.updateMany({
          where: { id: { in: lockIds } },
          data: { isActive: false, planQuotaLocked: true },
        })
      : Promise.resolve(),
  ]);

  void keepIds;
}

async function syncMenuCategoryQuotaLocks(
  restaurantId: string,
  cap: number | null
): Promise<void> {
  if (cap == null) {
    await db.menuCategory.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { showInFront: true, planQuotaLocked: false },
    });
    return;
  }

  const categories = await db.menuCategory.findMany({
    where: { restaurantId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, planQuotaLocked: true },
  });

  if (categories.length <= cap) {
    await db.menuCategory.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { showInFront: true, planQuotaLocked: false },
    });
    return;
  }

  const keepLockedIds = categories
    .slice(0, cap)
    .filter((c) => c.planQuotaLocked)
    .map((c) => c.id);
  const lockIds = categories.slice(cap).map((c) => c.id);

  await Promise.all([
    keepLockedIds.length > 0
      ? db.menuCategory.updateMany({
          where: { id: { in: keepLockedIds } },
          data: { showInFront: true, planQuotaLocked: false },
        })
      : Promise.resolve(),
    lockIds.length > 0
      ? db.menuCategory.updateMany({
          where: { id: { in: lockIds } },
          data: { showInFront: false, planQuotaLocked: true },
        })
      : Promise.resolve(),
  ]);
}

async function syncRestaurantVariationQuotaLocks(
  restaurantId: string,
  cap: number | null
): Promise<void> {
  if (cap == null) {
    await db.restaurantVariation.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { isActive: true, planQuotaLocked: false },
    });
    return;
  }

  const variations = await db.restaurantVariation.findMany({
    where: { restaurantId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, planQuotaLocked: true },
  });

  if (variations.length <= cap) {
    await db.restaurantVariation.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { isActive: true, planQuotaLocked: false },
    });
    return;
  }

  const keepLockedIds = variations
    .slice(0, cap)
    .filter((v) => v.planQuotaLocked)
    .map((v) => v.id);
  const lockIds = variations.slice(cap).map((v) => v.id);

  await Promise.all([
    keepLockedIds.length > 0
      ? db.restaurantVariation.updateMany({
          where: { id: { in: keepLockedIds } },
          data: { isActive: true, planQuotaLocked: false },
        })
      : Promise.resolve(),
    lockIds.length > 0
      ? db.restaurantVariation.updateMany({
          where: { id: { in: lockIds } },
          data: { isActive: false, planQuotaLocked: true },
        })
      : Promise.resolve(),
  ]);
}

async function syncBranchQuotaLocks(
  restaurantId: string,
  cap: number | null
): Promise<void> {
  if (cap == null) {
    await db.branch.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { isActive: true, planQuotaLocked: false },
    });
    return;
  }

  const branches = await db.branch.findMany({
    where: { restaurantId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, planQuotaLocked: true },
  });

  if (branches.length <= cap) {
    await db.branch.updateMany({
      where: { restaurantId, planQuotaLocked: true },
      data: { isActive: true, planQuotaLocked: false },
    });
    return;
  }

  const keepLockedIds = branches
    .slice(0, cap)
    .filter((b) => b.planQuotaLocked)
    .map((b) => b.id);
  const lockIds = branches.slice(cap).map((b) => b.id);

  await Promise.all([
    keepLockedIds.length > 0
      ? db.branch.updateMany({
          where: { id: { in: keepLockedIds } },
          data: { isActive: true, planQuotaLocked: false },
        })
      : Promise.resolve(),
    lockIds.length > 0
      ? db.branch.updateMany({
          where: { id: { in: lockIds } },
          data: { isActive: false, planQuotaLocked: true },
        })
      : Promise.resolve(),
  ]);
}
