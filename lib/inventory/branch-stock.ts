import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { validateBranchForRestaurant } from '@/lib/branch/branch-scope';

type BranchStockReader = Pick<typeof db, 'branchIngredientStock'>;

/** Resolve branch for stock ops; falls back to the restaurant's first branch. */
export async function resolveBranchIdForStock(
  restaurantId: string,
  branchId?: string | null
): Promise<string | null> {
  const trimmed = branchId?.trim();
  if (trimmed && (await validateBranchForRestaurant(trimmed, restaurantId))) {
    return trimmed;
  }
  const defaultBranch = await db.branch.findFirst({
    where: { restaurantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return defaultBranch?.id ?? null;
}

export async function loadBranchStockQuantities(
  client: BranchStockReader,
  branchId: string,
  ingredientIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ingredientIds.length === 0) return map;
  const rows = await client.branchIngredientStock.findMany({
    where: {
      branchId,
      ingredientId: { in: ingredientIds },
    },
    select: { ingredientId: true, quantity: true },
  });
  for (const row of rows) {
    map.set(row.ingredientId, row.quantity);
  }
  for (const id of ingredientIds) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

/** Create zero-qty branch stock rows for every branch (new ingredient catalog row). */
export async function seedBranchStockForIngredient(
  tx: Pick<typeof db, 'branch' | 'branchIngredientStock'>,
  restaurantId: string,
  ingredientId: string,
  options?: {
    initialQuantity?: number;
    initialBranchId?: string | null;
    minQuantity?: number | null;
  }
): Promise<void> {
  const branches = await tx.branch.findMany({
    where: { restaurantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (branches.length === 0) return;

  const initialBranchId = options?.initialBranchId?.trim() || null;
  const initialQty = options?.initialQuantity ?? 0;
  const minQty = options?.minQuantity ?? null;

  await tx.branchIngredientStock.createMany({
    data: branches.map((b) => ({
      branchId: b.id,
      ingredientId,
      quantity:
        initialBranchId && b.id === initialBranchId ? initialQty : 0,
      minQuantity: minQty,
    })),
    skipDuplicates: true,
  });
}

/** Keep Ingredient.quantity in sync as sum of branch rows (legacy dashboards). */
export async function syncIngredientTotalQuantity(
  tx: Pick<typeof db, 'branchIngredientStock' | 'ingredient'>,
  ingredientId: string
): Promise<void> {
  const agg = await tx.branchIngredientStock.aggregate({
    where: { ingredientId },
    _sum: { quantity: true },
  });
  await tx.ingredient.update({
    where: { id: ingredientId },
    data: { quantity: agg._sum.quantity ?? 0 },
  });
}

export async function setBranchIngredientQuantity(
  tx: Pick<typeof db, 'branchIngredientStock' | 'ingredient'>,
  branchId: string,
  ingredientId: string,
  quantity: number
): Promise<void> {
  await tx.branchIngredientStock.upsert({
    where: {
      branchId_ingredientId: { branchId, ingredientId },
    },
    create: { branchId, ingredientId, quantity },
    update: { quantity },
  });
  await syncIngredientTotalQuantity(tx, ingredientId);
}

export async function decrementBranchIngredientStock(
  tx: Pick<typeof db, 'branchIngredientStock' | 'ingredient'>,
  options: {
    branchId: string;
    ingredientId: string;
    amount: number;
    requireAvailable: boolean;
  }
): Promise<boolean> {
  const { branchId, ingredientId, amount, requireAvailable } = options;
  if (!(amount > 0)) return true;

  const updated = await tx.branchIngredientStock.updateMany({
    where: {
      branchId,
      ingredientId,
      ...(requireAvailable ? { quantity: { gte: amount } } : {}),
    },
    data: { quantity: { decrement: amount } },
  });
  if (requireAvailable && updated.count === 0) return false;
  await syncIngredientTotalQuantity(tx, ingredientId);
  return true;
}

export type BranchStockListRow = {
  ingredientId: string;
  quantity: number;
  minQuantity: number | null;
};

export async function listBranchStockForIngredients(
  branchId: string,
  ingredientIds: string[]
): Promise<Map<string, BranchStockListRow>> {
  const map = new Map<string, BranchStockListRow>();
  if (ingredientIds.length === 0) return map;
  const rows = await db.branchIngredientStock.findMany({
    where: {
      branchId,
      ingredientId: { in: ingredientIds },
    },
    select: {
      ingredientId: true,
      quantity: true,
      minQuantity: true,
    },
  });
  for (const row of rows) {
    map.set(row.ingredientId, {
      ingredientId: row.ingredientId,
      quantity: row.quantity,
      minQuantity: row.minQuantity,
    });
  }
  return map;
}

export function branchIdFromOrderPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const direct =
    (typeof obj.branchId === 'string' ? obj.branchId : null) ||
    (typeof obj.storeId === 'string' ? obj.storeId : null);
  if (direct?.trim()) return direct.trim();
  const orderInfo = obj.orderInfo;
  if (orderInfo && typeof orderInfo === 'object') {
    const storeId = (orderInfo as { storeId?: unknown }).storeId;
    if (typeof storeId === 'string' && storeId.trim()) return storeId.trim();
  }
  return null;
}
