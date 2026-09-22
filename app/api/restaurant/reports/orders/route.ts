import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
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
import { orderCountsTowardRevenue } from '@/lib/sales-order-status';

function statusWhere(
  statusFilter: 'all' | 'completed' | 'pending' | 'canceled'
): Prisma.OrderWhereInput | undefined {
  if (statusFilter === 'completed') {
    return {
      OR: [
        { status: { equals: 'completed', mode: 'insensitive' } },
        { status: { equals: 'complete', mode: 'insensitive' } },
        { status: { equals: 'delivered', mode: 'insensitive' } },
      ],
    };
  }
  if (statusFilter === 'canceled') {
    return {
      OR: [
        { status: { equals: 'canceled', mode: 'insensitive' } },
        { status: { equals: 'cancelled', mode: 'insensitive' } },
        { status: { equals: 'failed', mode: 'insensitive' } },
        { status: { equals: 'cancel', mode: 'insensitive' } },
      ],
    };
  }
  if (statusFilter === 'pending') {
    return {
      NOT: {
        OR: [
          { status: { equals: 'completed', mode: 'insensitive' } },
          { status: { equals: 'complete', mode: 'insensitive' } },
          { status: { equals: 'delivered', mode: 'insensitive' } },
          { status: { equals: 'canceled', mode: 'insensitive' } },
          { status: { equals: 'cancelled', mode: 'insensitive' } },
          { status: { equals: 'failed', mode: 'insensitive' } },
          { status: { equals: 'cancel', mode: 'insensitive' } },
        ],
      },
    };
  }
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
  const statusRaw = req.nextUrl.searchParams.get('status') ?? 'all';
  const statusFilter =
    statusRaw === 'completed' ||
    statusRaw === 'pending' ||
    statusRaw === 'canceled'
      ? statusRaw
      : 'all';

  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const ticket = Number.parseInt(q.replace(/^#/, ''), 10);
  const where: Prisma.OrderWhereInput = {
    restaurantId: auth.restaurant.id,
    ...orderBranchWhere(branchId),
    createdAt: { gte: range.from, lte: range.to },
    ...statusWhere(statusFilter),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { shortOrderId: { contains: q, mode: 'insensitive' } },
            { status: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
            ...(Number.isFinite(ticket) ? [{ ticketNumber: ticket }] : []),
          ],
        }
      : {}),
  };

  const total = await db.order.count({ where });
  const safePage = clampPage(page, total, pageSize);
  const rows = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      status: true,
      total: true,
      shortOrderId: true,
      ticketNumber: true,
      sourceType: true,
      createdAt: true,
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true, amount: true, method: true },
      },
    },
  });

  const data = rows.map((o) => {
    const payment = o.payments[0];
    const paymentStatus = payment?.status ?? null;
    const countsRevenue = orderCountsTowardRevenue({
      orderStatus: o.status,
      paymentStatus,
    });
    return {
      id: o.id,
      shortOrderId: o.shortOrderId,
      ticketNumber: o.ticketNumber,
      sourceType: o.sourceType,
      status: o.status,
      paymentStatus,
      method: payment?.method ?? null,
      total: o.total,
      revenueAmount: countsRevenue ? (payment?.amount ?? o.total ?? 0) : 0,
      countsTowardRevenue: countsRevenue,
      createdAt: o.createdAt.toISOString(),
    };
  });

  return NextResponse.json(
    {
      data,
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
