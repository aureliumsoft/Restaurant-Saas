import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ExpenseType, Prisma } from '@prisma/client';

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

function parseExpenseType(raw: string | null): ExpenseType | undefined {
  if (!raw || raw === 'all') return undefined;
  if (raw === 'INVENTORY' || raw === 'MANUAL') return raw;
  return undefined;
}

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
  const type = parseExpenseType(req.nextUrl.searchParams.get('type'));

  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const where: Prisma.ExpenseWhereInput = {
    restaurantId: auth.restaurant.id,
    ...(branchId ? { branchId } : {}),
    occurredAt: { gte: range.from, lte: range.to },
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            {
              ingredient: {
                name: { contains: q, mode: 'insensitive' },
              },
            },
          ],
        }
      : {}),
  };

  const total = await db.expense.count({ where });
  const safePage = clampPage(page, total, pageSize);
  const rows = await db.expense.findMany({
    where,
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      type: true,
      title: true,
      amount: true,
      notes: true,
      occurredAt: true,
      quantity: true,
      ingredient: { select: { id: true, name: true, unit: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    {
      data: rows.map((r) => ({
        ...r,
        occurredAt: r.occurredAt.toISOString(),
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
