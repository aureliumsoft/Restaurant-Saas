import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import {
  decrementBranchIngredientStock,
  loadBranchStockQuantities,
  resolveBranchIdForStock,
} from '@/lib/inventory/branch-stock';
import { stockEntryCreateSchema } from '@/lib/inventory/validation';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publishInventoryStockUpdate } from '@/lib/realtime/publish';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'inventory',
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

  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const where = {
    restaurantId: auth.restaurant.id,
    ...(branchId ? { branchId } : {}),
  };
  const total = await db.ingredientStockEntry.count({ where });
  const safePage = clampPage(page, total, pageSize);
  const rows = await db.ingredientStockEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      quantity: true,
      reason: true,
      source: true,
      branchId: true,
      createdAt: true,
      ingredient: { select: { id: true, name: true, unit: true } },
      menuItem: { select: { id: true, name: true } },
      variation: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    {
      data: rows,
      meta: buildPaginationMeta(safePage, pageSize, total),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'inventory',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const branchId = await resolveBranchIdForStock(
    auth.restaurant.id,
    branchScope?.activeBranchId
  );
  if (!branchId) {
    return NextResponse.json(
      { error: 'No branch configured for stock.' },
      { status: 400 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = stockEntryCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ingredient = await db.ingredient.findFirst({
    where: {
      id: parsed.data.ingredientId,
      restaurantId: auth.restaurant.id,
    },
  });
  if (!ingredient) {
    return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
  }

  let menuItemId: string | null = parsed.data.menuItemId ?? null;
  let menuItemVariationId: string | null = null;

  if (menuItemId) {
    const product = await db.menuItem.findFirst({
      where: { id: menuItemId, restaurantId: auth.restaurant.id },
      select: {
        id: true,
        variations: {
          select: { id: true, restaurantVariationId: true },
        },
      },
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const templateId = parsed.data.restaurantVariationId?.trim();
    if (templateId) {
      const variation = product.variations.find(
        (v) => v.restaurantVariationId === templateId || v.id === templateId
      );
      menuItemVariationId = variation?.id ?? null;
    }
  }

  const deduct = parsed.data.quantity;
  const stockMap = await loadBranchStockQuantities(db, branchId, [ingredient.id]);
  const onHand = stockMap.get(ingredient.id) ?? 0;
  if (onHand < deduct) {
    return NextResponse.json(
      {
        error: `${ingredient.name} ingredient is not exist in stock`,
      },
      { status: 400 }
    );
  }

  try {
    const entry = await db.$transaction(async (tx) => {
      const ok = await decrementBranchIngredientStock(tx, {
        branchId,
        ingredientId: ingredient.id,
        amount: deduct,
        requireAvailable: true,
      });
      if (!ok) {
        throw new Error(`${ingredient.name} ingredient is not exist in stock`);
      }
      return tx.ingredientStockEntry.create({
        data: {
          restaurantId: auth.restaurant.id,
          branchId,
          ingredientId: ingredient.id,
          menuItemId,
          menuItemVariationId,
          quantity: deduct,
          reason: parsed.data.reason.trim(),
          source: 'MANUAL',
          createdByUserId: auth.user.id,
        },
        include: {
          ingredient: { select: { id: true, name: true, unit: true } },
          menuItem: { select: { id: true, name: true } },
          variation: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      });
    });

    publishInventoryStockUpdate(auth.restaurant.id, branchId);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not save stock entry.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
