import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { listBranchStockForIngredients } from '@/lib/inventory/branch-stock';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['inventory', 'product'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const branchId = branchScope?.activeBranchId ?? null;

  const ingredients = await db.ingredient.findMany({
    where: { restaurantId: auth.restaurant.id, isActive: true },
    select: {
      id: true,
      quantity: true,
      minQuantity: true,
      unitCost: true,
    },
  });

  const branchStock = branchId
    ? await listBranchStockForIngredients(
        branchId,
        ingredients.map((i) => i.id)
      )
    : new Map();

  let totalInventoryValue = 0;
  let lowStockCount = 0;

  for (const ing of ingredients) {
    const stock = branchStock.get(ing.id);
    const quantity = branchId ? (stock?.quantity ?? 0) : ing.quantity;
    const minQuantity = branchId
      ? (stock?.minQuantity ?? ing.minQuantity)
      : ing.minQuantity;
    const unitCost = ing.unitCost ?? 0;
    totalInventoryValue += quantity * unitCost;
    if (minQuantity != null && quantity <= minQuantity) {
      lowStockCount += 1;
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentEntries = await db.ingredientStockEntry.findMany({
    where: {
      restaurantId: auth.restaurant.id,
      ...(branchId ? { branchId } : {}),
      createdAt: { gte: thirtyDaysAgo },
    },
    select: {
      quantity: true,
      ingredient: { select: { unitCost: true } },
    },
  });

  const usageValue30d = recentEntries.reduce(
    (sum, row) => sum + row.quantity * (row.ingredient.unitCost ?? 0),
    0
  );

  const entryCount30d = recentEntries.length;

  return NextResponse.json({
    data: {
      branchId,
      totalInventoryValue,
      lowStockCount,
      activeIngredientCount: ingredients.length,
      usageValue30d,
      entryCount30d,
    },
  });
}
