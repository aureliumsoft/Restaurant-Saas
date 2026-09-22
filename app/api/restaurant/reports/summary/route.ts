import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  userIsOwnerOrAdmin,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { listBranchStockForIngredients } from '@/lib/inventory/branch-stock';
import {
  orderCreatedAtRangeSql,
  resolveReportDateRange,
  transactionCreatedAtRangeSql,
} from '@/lib/reports/date-range';
import { aggregateTransactionLedger } from '@/lib/reports/transaction-ledger';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { salesOrderStatusBucket } from '@/lib/sales-order-status';

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
  const rid = auth.restaurant.id;

  const range = await resolveReportDateRange({
    database: db,
    canViewHistorical,
    fromParam: req.nextUrl.searchParams.get('from'),
    toParam: req.nextUrl.searchParams.get('to'),
  });

  const branchSql = branchId
    ? Prisma.sql`AND o."branchId" = ${branchId}`
    : Prisma.empty;
  const orderRangeSql = orderCreatedAtRangeSql(range);
  const txRangeSql = transactionCreatedAtRangeSql(range);

  const [
    financial,
    orderStatRows,
    revenueStatRows,
    txCompleteRows,
    expenseAgg,
    expenseByType,
    ingredients,
    usageEntries,
  ] = await Promise.all([
    aggregateTransactionLedger({
      restaurantId: rid,
      activeBranchId: branchId,
      range,
    }),
    db.$queryRaw<
      Array<{ status: string; cnt: bigint | number; amt: number }>
    >(Prisma.sql`
      SELECT o.status, COUNT(*)::int AS cnt, COALESCE(SUM(o.total), 0)::float AS amt
      FROM "Order" o
      WHERE o."restaurantId" = ${rid}
        ${branchSql}
        ${orderRangeSql}
      GROUP BY o.status
    `).catch(() => [] as Array<{ status: string; cnt: number; amt: number }>),
    db.$queryRaw<Array<{ cnt: bigint | number; amt: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS cnt,
             COALESCE(SUM(COALESCE(lp.amount, o.total)), 0)::float AS amt
      FROM "Order" o
      LEFT JOIN LATERAL (
        SELECT p.amount, p.status
        FROM "Payment" p
        WHERE p."orderId" = o.id::text
        ORDER BY p."createdAt" DESC
        LIMIT 1
      ) lp ON true
      WHERE o."restaurantId" = ${rid}
        ${branchSql}
        ${orderRangeSql}
        AND (
          lower(COALESCE(lp.status, '')) IN (
            'completed', 'complete', 'paid', 'success'
          )
          OR (
            lp.status IS NULL
            AND lower(o.status) IN ('completed', 'complete', 'delivered')
          )
        )
    `).catch(() => [] as Array<{ cnt: number; amt: number }>),
    db.$queryRaw<Array<{ cnt: number; amt: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS cnt,
             COALESCE(SUM(t."totalAmount"), 0)::float AS amt
      FROM "Transaction" t
      WHERE t."restaurantId" = ${rid}
        AND t."isComplete" = true
        ${txRangeSql}
    `).catch(() => [] as Array<{ cnt: number; amt: number }>),
    db.expense.aggregate({
      where: {
        restaurantId: rid,
        ...(branchId ? { branchId } : {}),
        occurredAt: { gte: range.from, lte: range.to },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.expense.groupBy({
      by: ['type'],
      where: {
        restaurantId: rid,
        ...(branchId ? { branchId } : {}),
        occurredAt: { gte: range.from, lte: range.to },
      },
      _sum: { amount: true },
    }),
    db.ingredient.findMany({
      where: { restaurantId: rid, isActive: true },
      select: {
        id: true,
        quantity: true,
        minQuantity: true,
        unitCost: true,
      },
    }),
    db.ingredientStockEntry.findMany({
      where: {
        restaurantId: rid,
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        quantity: true,
        ingredient: { select: { unitCost: true } },
      },
    }),
  ]);

  let orderCount = 0;
  let pendingCount = 0;
  let canceledCount = 0;
  for (const row of orderStatRows) {
    const count = Number(row.cnt) || 0;
    orderCount += count;
    const bucket = salesOrderStatusBucket(row.status);
    if (bucket === 'pending') pendingCount += count;
    else if (bucket === 'canceled') canceledCount += count;
  }

  let revenueAmount = Number(revenueStatRows[0]?.amt ?? 0) || 0;
  let revenueOrders = Number(revenueStatRows[0]?.cnt ?? 0) || 0;
  const txAmt = Number(txCompleteRows[0]?.amt ?? 0) || 0;
  const txCnt = Number(txCompleteRows[0]?.cnt ?? 0) || 0;
  revenueAmount += txAmt;
  revenueOrders += txCnt;
  orderCount += txCnt;

  let inventoryAmount = 0;
  let manualAmount = 0;
  for (const row of expenseByType) {
    const sum = row._sum.amount ?? 0;
    if (row.type === 'INVENTORY') inventoryAmount = sum;
    if (row.type === 'MANUAL') manualAmount = sum;
  }
  const expensesTotal = expenseAgg._sum.amount ?? 0;

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
    totalInventoryValue += quantity * (ing.unitCost ?? 0);
    if (minQuantity != null && quantity <= minQuantity) lowStockCount += 1;
  }

  const usageValueInRange = usageEntries.reduce(
    (sum, row) => sum + row.quantity * (row.ingredient.unitCost ?? 0),
    0
  );

  const profit = revenueAmount - expensesTotal;

  return NextResponse.json(
    {
      kpis: {
        financial: {
          transactionCount: financial.transactionCount,
          transactionAmount: financial.transactionAmount,
        },
        orders: {
          orderCount,
          revenueAmount,
          revenueOrders,
          pendingCount,
          canceledCount,
        },
        inventory: {
          totalInventoryValue,
          lowStockCount,
          usageValueInRange,
          entryCountInRange: usageEntries.length,
        },
        expenses: {
          totalAmount: expensesTotal,
          inventoryAmount,
          manualAmount,
          count: expenseAgg._count._all,
        },
      },
      pnl: {
        revenue: revenueAmount,
        expenses: expensesTotal,
        profit,
      },
      meta: {
        from: range.fromKey,
        to: range.toKey,
        branchId,
        canViewHistorical,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
