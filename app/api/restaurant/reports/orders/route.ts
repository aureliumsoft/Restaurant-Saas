import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType, Prisma } from '@prisma/client';

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
import {
  orderCountsTowardRevenue,
  salesOrderStatusBucket,
} from '@/lib/sales-order-status';

type ChannelFilter = 'all' | 'online' | 'pos' | 'kiosk';

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

function channelWhere(channel: ChannelFilter): Prisma.OrderWhereInput | undefined {
  if (channel === 'pos') return { sourceType: OrderSourceType.POS };
  if (channel === 'kiosk') return { sourceType: OrderSourceType.KIOSK };
  if (channel === 'online') return { sourceType: OrderSourceType.ONLINE };
  return undefined;
}

function parseChannel(raw: string | null): ChannelFilter {
  if (raw === 'pos' || raw === 'kiosk' || raw === 'online' || raw === 'web') {
    return raw === 'web' ? 'online' : raw;
  }
  return 'all';
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
  const channel = parseChannel(req.nextUrl.searchParams.get('channel'));

  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const ticket = Number.parseInt(q.replace(/^#/, ''), 10);
  const baseWhere: Prisma.OrderWhereInput = {
    restaurantId: auth.restaurant.id,
    ...orderBranchWhere(branchId),
    createdAt: { gte: range.from, lte: range.to },
    ...channelWhere(channel),
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

  const where: Prisma.OrderWhereInput = {
    ...baseWhere,
    ...statusWhere(statusFilter),
  };

  const [total, statOrders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where: baseWhere,
      select: {
        status: true,
        total: true,
      },
    }),
  ]);

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

  const stats = {
    totalOrders: 0,
    totalAmount: 0,
    pending: { count: 0, amount: 0 },
    canceled: { count: 0, amount: 0 },
    completed: { count: 0, amount: 0 },
  };

  for (const o of statOrders) {
    const amount = Number(o.total) || 0;
    stats.totalOrders += 1;
    stats.totalAmount += amount;
    const bucket = salesOrderStatusBucket(o.status);
    if (bucket === 'pending') {
      stats.pending.count += 1;
      stats.pending.amount += amount;
    } else if (bucket === 'canceled') {
      stats.canceled.count += 1;
      stats.canceled.amount += amount;
    } else if (bucket === 'completed') {
      stats.completed.count += 1;
      stats.completed.amount += amount;
    }
  }

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
      stats,
      meta: {
        ...buildPaginationMeta(safePage, pageSize, total),
        from: range.fromKey,
        to: range.toKey,
        canViewHistorical,
        channel,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
