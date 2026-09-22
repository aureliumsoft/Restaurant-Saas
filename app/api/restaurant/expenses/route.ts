import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ExpenseType, Prisma } from '@prisma/client';

import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { createExpense } from '@/lib/expenses/create-expense';
import { expenseManualCreateSchema } from '@/lib/expenses/validation';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

function parseExpenseType(
  raw: string | null
): ExpenseType | undefined {
  if (!raw || raw === 'all') return undefined;
  if (raw === 'INVENTORY' || raw === 'MANUAL') return raw;
  return undefined;
}

function parseDateBound(raw: string | null, endOfDay: boolean): Date | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'expenses',
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

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const type = parseExpenseType(req.nextUrl.searchParams.get('type'));
  const from = parseDateBound(req.nextUrl.searchParams.get('from'), false);
  const to = parseDateBound(req.nextUrl.searchParams.get('to'), true);

  const where: Prisma.ExpenseWhereInput = {
    restaurantId: auth.restaurant.id,
    ...(branchId ? { branchId } : {}),
    ...(type ? { type } : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
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

  const [rows, aggregates, byType] = await Promise.all([
    db.expense.findMany({
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
        branchId: true,
        ingredientId: true,
        createdAt: true,
        ingredient: { select: { id: true, name: true, unit: true } },
        branch: { select: { id: true, name: true } },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    db.expense.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
      _avg: { amount: true },
    }),
    db.expense.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
    }),
  ]);

  let inventoryAmount = 0;
  let manualAmount = 0;
  for (const row of byType) {
    const sum = row._sum.amount ?? 0;
    if (row.type === 'INVENTORY') inventoryAmount = sum;
    if (row.type === 'MANUAL') manualAmount = sum;
  }

  const count = aggregates._count._all;
  const totalAmount = aggregates._sum.amount ?? 0;

  return NextResponse.json(
    {
      data: rows.map((r) => ({
        ...r,
        occurredAt: r.occurredAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      meta: buildPaginationMeta(safePage, pageSize, total),
      kpis: {
        totalAmount,
        inventoryAmount,
        manualAmount,
        count,
        avgAmount: aggregates._avg.amount ?? 0,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'expenses',
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
  const branchId = branchScope?.activeBranchId ?? null;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = expenseManualCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const row = await createExpense(tx, {
        restaurantId: auth.restaurant.id,
        branchId,
        type: 'MANUAL',
        title: parsed.data.title,
        amount: parsed.data.amount,
        notes: parsed.data.notes,
        occurredAt: parsed.data.occurredAt,
        createdByUserId: auth.user.id,
      });
      return tx.expense.findUniqueOrThrow({
        where: { id: row.id },
        select: {
          id: true,
          type: true,
          title: true,
          amount: true,
          notes: true,
          occurredAt: true,
          quantity: true,
          branchId: true,
          ingredientId: true,
          createdAt: true,
          ingredient: { select: { id: true, name: true, unit: true } },
          branch: { select: { id: true, name: true } },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    return NextResponse.json(
      {
        data: {
          ...created,
          occurredAt: created.occurredAt.toISOString(),
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not create expense.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
