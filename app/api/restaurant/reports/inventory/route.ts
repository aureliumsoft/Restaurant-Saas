import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  userIsOwnerOrAdmin,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { resolveReportDateRange } from '@/lib/reports/date-range';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'reports',
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const canViewHistorical = await userIsOwnerOrAdmin(
    auth.user.id,
    auth.restaurant.id
  );
  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const branchId = branchScope?.activeBranchId ?? null;
  const range = await resolveReportDateRange({
    database: db,
    canViewHistorical,
    fromParam: req.nextUrl.searchParams.get('from'),
    toParam: req.nextUrl.searchParams.get('to'),
  });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const sourceRaw = req.nextUrl.searchParams.get('source') ?? 'all';
  const sourceFilter =
    sourceRaw === 'MANUAL' || sourceRaw === 'ORDER' ? sourceRaw : undefined;

  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const where: Prisma.IngredientStockEntryWhereInput = {
    restaurantId: auth.restaurant.id,
    ...(branchId ? { branchId } : {}),
    createdAt: { gte: range.from, lte: range.to },
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(q
      ? {
          OR: [
            { reason: { contains: q, mode: 'insensitive' } },
            { ingredient: { name: { contains: q, mode: 'insensitive' } } },
            { menuItem: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
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
      createdAt: true,
      ingredient: {
        select: { id: true, name: true, unit: true, unitCost: true },
      },
      menuItem: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    {
      data: rows.map((r) => ({
        id: r.id,
        quantity: r.quantity,
        reason: r.reason,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
        unitCost: r.ingredient.unitCost,
        usageValue: r.quantity * (r.ingredient.unitCost ?? 0),
        ingredient: r.ingredient,
        menuItem: r.menuItem,
        branch: r.branch,
      })),
      meta: {
        ...buildPaginationMeta(safePage, pageSize, total),
        from: range.fromKey,
        to: range.toKey,
        canViewHistorical,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
