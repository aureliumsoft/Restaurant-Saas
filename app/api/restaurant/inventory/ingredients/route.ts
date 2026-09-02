import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import {
  listBranchStockForIngredients,
  seedBranchStockForIngredient,
  syncIngredientTotalQuantity,
} from '@/lib/inventory/branch-stock';
import { ingredientCreateSchema } from '@/lib/inventory/validation';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publishInventoryStockUpdate } from '@/lib/realtime/publish';
import { ingredientApiPath } from '@/lib/dashboard-paths';
import { withUrlIds } from '@/lib/with-url-id';

function lazyImageUrl(id: string): string {
  return `${ingredientApiPath(id)}/image`;
}

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

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const activeOnly = req.nextUrl.searchParams.get('active') !== '0';
  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const where: Prisma.IngredientWhereInput = {
    restaurantId: auth.restaurant.id,
    ...(activeOnly ? { isActive: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const total = await db.ingredient.count({ where });
  const safePage = clampPage(page, total, pageSize);
  const rows = await db.ingredient.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      description: true,
      quantity: true,
      unit: true,
      isMajor: true,
      sku: true,
      minQuantity: true,
      unitCost: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const branchStock = branchId
    ? await listBranchStockForIngredients(
        branchId,
        rows.map((r) => r.id)
      )
    : new Map();

  const withImage = await db.ingredient.findMany({
    where: {
      id: { in: rows.map((r) => r.id) },
      AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
    },
    select: { id: true },
  });
  const hasImage = new Set(withImage.map((r) => r.id));

  return NextResponse.json(
    {
      data: withUrlIds(rows).map((r) => {
        const stock = branchStock.get(r.id);
        return {
          ...r,
          quantity: branchId ? (stock?.quantity ?? 0) : r.quantity,
          minQuantity: branchId
            ? (stock?.minQuantity ?? r.minQuantity)
            : r.minQuantity,
          unitCost: r.unitCost,
          stockValue:
            (branchId ? (stock?.quantity ?? 0) : r.quantity) *
            (r.unitCost ?? 0),
          branchId,
          hasImage: hasImage.has(r.id),
          imageUrl: hasImage.has(r.id) ? lazyImageUrl(r.id) : null,
        };
      }),
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
  const activeBranchId = branchScope?.activeBranchId ?? null;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ingredientCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  try {
    const row = await db.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.create({
        data: {
          restaurantId: auth.restaurant.id,
          name,
          description: parsed.data.description?.trim() || null,
          quantity: 0,
          unit: parsed.data.unit,
          isMajor: parsed.data.isMajor ?? false,
          imageUrl: parsed.data.imageUrl?.trim() || null,
          sku: parsed.data.sku?.trim() || null,
          minQuantity: parsed.data.minQuantity ?? null,
          unitCost: parsed.data.unitCost ?? null,
        },
      });
      await seedBranchStockForIngredient(tx, auth.restaurant.id, ingredient.id, {
        initialQuantity: parsed.data.quantity,
        initialBranchId: activeBranchId,
        minQuantity: parsed.data.minQuantity ?? null,
      });
      await syncIngredientTotalQuantity(tx, ingredient.id);
      return ingredient;
    });
    publishInventoryStockUpdate(auth.restaurant.id, activeBranchId);
    return NextResponse.json(
      {
        data: {
          ...row,
          quantity: parsed.data.quantity,
          branchId: activeBranchId,
          hasImage: Boolean(row.imageUrl),
          imageUrl: row.imageUrl ? lazyImageUrl(row.id) : null,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'An ingredient with this name already exists.' },
        { status: 409 }
      );
    }
    console.error('[inventory] create ingredient', e);
    return NextResponse.json(
      { error: 'Could not create ingredient.' },
      { status: 500 }
    );
  }
}
