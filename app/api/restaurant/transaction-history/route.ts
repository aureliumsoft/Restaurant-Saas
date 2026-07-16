import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
  userIsOwnerOrAdmin,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { isCanceledOrderStatus } from '@/lib/order-payment';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import {
  getTodayCreatedAtBounds,
  prismaCreatedAtTodayWhere,
  salesOrderFilterTimezone,
} from '@/lib/sales-order-period';
import type {
  TransactionHistoryKind,
  TransactionHistoryRow,
} from '@/types/transaction-history';

type UnifiedKey = { id: string; kind: TransactionHistoryKind };

function orderSearchWhere(q: string): Prisma.OrderWhereInput | undefined {
  if (!q) return undefined;
  const ticket = Number.parseInt(q.replace(/^#/, ''), 10);
  return {
    OR: [
      { id: { contains: q, mode: 'insensitive' } },
      { shortOrderId: { contains: q, mode: 'insensitive' } },
      { status: { contains: q, mode: 'insensitive' } },
      { sourceType: { equals: q.toUpperCase() as never } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      ...(Number.isFinite(ticket) ? [{ ticketNumber: ticket }] : []),
    ],
  };
}

function subscriptionSearchWhere(
  q: string
): Prisma.SubscriptionPaymentWhereInput | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { id: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
      { currency: { contains: q, mode: 'insensitive' } },
    ],
  };
}

function registerSearchWhere(q: string): Prisma.TransactionWhereInput | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { id: { contains: q, mode: 'insensitive' } },
      { sourceType: { equals: q.toUpperCase() as never } },
    ],
  };
}

async function loadOrderRows(
  ids: string[],
  orderCurrency: string
): Promise<Map<string, TransactionHistoryRow>> {
  if (ids.length === 0) return new Map();
  const orders = await db.order.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      shortOrderId: true,
      ticketNumber: true,
      total: true,
      status: true,
      sourceType: true,
      address: true,
      createdAt: true,
      customer: { select: { name: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, method: true, amount: true },
      },
    },
  });
  const map = new Map<string, TransactionHistoryRow>();
  for (const o of orders) {
    const payment = o.payments[0];
    const orderCanceled = isCanceledOrderStatus(o.status);
    map.set(o.id, {
      key: `ORDER:${o.id}`,
      kind: 'ORDER',
      transactionId: payment?.id ?? o.id,
      referenceId: o.id,
      shortOrderId: o.shortOrderId,
      ticketNumber: o.ticketNumber,
      amount: payment?.amount ?? o.total ?? null,
      currency: orderCurrency,
      status: orderCanceled ? 'cancelled' : (payment?.status ?? o.status),
      method: payment?.method ?? null,
      source: o.sourceType,
      note: o.address ?? null,
      customerName: o.customer?.name ?? null,
      createdAt: o.createdAt.toISOString(),
    });
  }
  return map;
}

async function loadSubscriptionRows(
  ids: string[]
): Promise<Map<string, TransactionHistoryRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.subscriptionPayment.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      amount: true,
      currency: true,
      paidAt: true,
      notes: true,
      restaurantSubscriptionId: true,
    },
  });
  const map = new Map<string, TransactionHistoryRow>();
  for (const p of rows) {
    map.set(p.id, {
      key: `SUBSCRIPTION:${p.id}`,
      kind: 'SUBSCRIPTION',
      transactionId: p.id,
      referenceId: p.restaurantSubscriptionId ?? null,
      shortOrderId: null,
      ticketNumber: null,
      amount: p.amount,
      currency: p.currency || 'EUR',
      status: 'completed',
      method: 'subscription',
      source: 'SAAS',
      note: p.notes ?? null,
      customerName: null,
      createdAt: p.paidAt.toISOString(),
    });
  }
  return map;
}

async function loadRegisterRows(
  ids: string[],
  orderCurrency: string
): Promise<Map<string, TransactionHistoryRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.transaction.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      totalAmount: true,
      isComplete: true,
      sourceType: true,
      createdAt: true,
    },
  });
  const map = new Map<string, TransactionHistoryRow>();
  for (const t of rows) {
    map.set(t.id, {
      key: `REGISTER:${t.id}`,
      kind: 'REGISTER',
      transactionId: t.id,
      referenceId: null,
      shortOrderId: null,
      ticketNumber: null,
      amount: t.totalAmount != null ? Number(t.totalAmount) : null,
      currency: orderCurrency,
      status: t.isComplete ? 'completed' : 'open',
      method: 'register',
      source: t.sourceType,
      note: null,
      customerName: null,
      createdAt: t.createdAt.toISOString(),
    });
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'records',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const restaurantId = auth.restaurantId;
    const canViewHistorical = await userIsOwnerOrAdmin(
      auth.userId,
      restaurantId
    );
    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      restaurantId
    );
    const activeBranchId = branchScope?.activeBranchId ?? null;
    const orderBranchFilter = orderBranchWhere(activeBranchId);
    const filterTz = salesOrderFilterTimezone();
    const todayBounds = canViewHistorical
      ? null
      : await getTodayCreatedAtBounds(db, filterTz);
    const todayCreatedAt = todayBounds
      ? prismaCreatedAtTodayWhere(todayBounds)
      : {};
    const todayPaidAt = todayBounds
      ? { paidAt: { gte: todayBounds.gte, lt: todayBounds.lt } }
      : {};

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    const kindFilterRaw = req.nextUrl.searchParams.get('kind');
    const kindFilter =
      kindFilterRaw === 'ORDER' ||
      kindFilterRaw === 'SUBSCRIPTION' ||
      kindFilterRaw === 'REGISTER'
        ? kindFilterRaw
        : 'ALL';

    const { page, pageSize, skip, take } = parsePaginationParams(
      req.nextUrl.searchParams,
      { defaultPageSize: 20, pageSizeKeys: ['take', 'limit'] }
    );

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { currencyCode: true },
    });
    const orderCurrency = restaurant?.currencyCode ?? 'EUR';

    let keys: UnifiedKey[] = [];
    let total = 0;

    if (kindFilter === 'ORDER') {
      const where: Prisma.OrderWhereInput = {
        restaurantId,
        ...orderBranchFilter,
        ...todayCreatedAt,
        ...orderSearchWhere(q),
      };
      total = await db.order.count({ where });
      const safePage = clampPage(page, total, pageSize);
      const pageSkip = (safePage - 1) * pageSize;
      const rows = await db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pageSkip,
        take: pageSize,
        select: { id: true },
      });
      keys = rows.map((r) => ({ id: r.id, kind: 'ORDER' as const }));
    } else if (kindFilter === 'SUBSCRIPTION') {
      const where: Prisma.SubscriptionPaymentWhereInput = {
        restaurantId,
        ...todayPaidAt,
        ...subscriptionSearchWhere(q),
      };
      total = await db.subscriptionPayment.count({ where });
      const safePage = clampPage(page, total, pageSize);
      const pageSkip = (safePage - 1) * pageSize;
      const rows = await db.subscriptionPayment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: pageSkip,
        take: pageSize,
        select: { id: true },
      });
      keys = rows.map((r) => ({ id: r.id, kind: 'SUBSCRIPTION' as const }));
    } else if (kindFilter === 'REGISTER') {
      const where: Prisma.TransactionWhereInput = {
        restaurantId,
        ...todayCreatedAt,
        ...registerSearchWhere(q),
      };
      total = await db.transaction.count({ where });
      const safePage = clampPage(page, total, pageSize);
      const pageSkip = (safePage - 1) * pageSize;
      const rows = await db.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pageSkip,
        take: pageSize,
        select: { id: true },
      });
      keys = rows.map((r) => ({ id: r.id, kind: 'REGISTER' as const }));
    } else {
      // Combined ALL view: page keys via SQL UNION, then hydrate.
      const like = q ? `%${q}%` : null;
      const ticket = q
        ? Number.parseInt(q.replace(/^#/, ''), 10)
        : Number.NaN;
      const hasTicket = Number.isFinite(ticket);

      const todayOrderSql = todayBounds
        ? Prisma.sql`AND o."createdAt" >= ${todayBounds.gte} AND o."createdAt" < ${todayBounds.lt}`
        : Prisma.empty;
      const todaySubSql = todayBounds
        ? Prisma.sql`AND s."paidAt" >= ${todayBounds.gte} AND s."paidAt" < ${todayBounds.lt}`
        : Prisma.empty;
      const todayRegSql = todayBounds
        ? Prisma.sql`AND t."createdAt" >= ${todayBounds.gte} AND t."createdAt" < ${todayBounds.lt}`
        : Prisma.empty;
      const branchSql = activeBranchId
        ? Prisma.sql`AND o."branchId" = ${activeBranchId}`
        : Prisma.empty;

      const orderSearchSql = like
        ? Prisma.sql`AND (
            o.id::text ILIKE ${like}
            OR o."shortOrderId" ILIKE ${like}
            OR o.status ILIKE ${like}
            OR o."sourceType"::text ILIKE ${like}
            OR EXISTS (
              SELECT 1 FROM "Customer" c
              WHERE c.id = o."customerId" AND c.name ILIKE ${like}
            )
            ${hasTicket ? Prisma.sql`OR o."ticketNumber" = ${ticket}` : Prisma.empty}
          )`
        : Prisma.empty;
      const subSearchSql = like
        ? Prisma.sql`AND (
            s.id::text ILIKE ${like}
            OR COALESCE(s.notes, '') ILIKE ${like}
            OR s.currency ILIKE ${like}
          )`
        : Prisma.empty;
      const regSearchSql = like
        ? Prisma.sql`AND (
            t.id::text ILIKE ${like}
            OR t."sourceType"::text ILIKE ${like}
          )`
        : Prisma.empty;

      const unionBody = Prisma.sql`
        SELECT o.id::text AS id, 'ORDER'::text AS kind, o."createdAt" AS sort_at
        FROM "Order" o
        WHERE o."restaurantId" = ${restaurantId}
          ${branchSql}
          ${todayOrderSql}
          ${orderSearchSql}
        UNION ALL
        SELECT s.id::text AS id, 'SUBSCRIPTION'::text AS kind, s."paidAt" AS sort_at
        FROM "SubscriptionPayment" s
        WHERE s."restaurantId" = ${restaurantId}
          ${todaySubSql}
          ${subSearchSql}
        UNION ALL
        SELECT t.id::text AS id, 'REGISTER'::text AS kind, t."createdAt" AS sort_at
        FROM "Transaction" t
        WHERE t."restaurantId" = ${restaurantId}
          ${todayRegSql}
          ${regSearchSql}
      `;

      const countRows = await db.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM (${unionBody}) AS u`
      );
      total = Number(countRows[0]?.count ?? 0);
      const safePage = clampPage(page, total, pageSize);
      const pageSkip = (safePage - 1) * pageSize;

      const pageRows = await db.$queryRaw<Array<{ id: string; kind: string }>>(
        Prisma.sql`
          SELECT id, kind FROM (${unionBody}) AS u
          ORDER BY sort_at DESC
          LIMIT ${pageSize} OFFSET ${pageSkip}
        `
      );
      keys = pageRows
        .filter(
          (r): r is { id: string; kind: TransactionHistoryKind } =>
            r.kind === 'ORDER' ||
            r.kind === 'SUBSCRIPTION' ||
            r.kind === 'REGISTER'
        )
        .map((r) => ({ id: r.id, kind: r.kind }));
    }

    const orderIds = keys.filter((k) => k.kind === 'ORDER').map((k) => k.id);
    const subIds = keys
      .filter((k) => k.kind === 'SUBSCRIPTION')
      .map((k) => k.id);
    const regIds = keys.filter((k) => k.kind === 'REGISTER').map((k) => k.id);

    const [orderMap, subMap, regMap] = await Promise.all([
      loadOrderRows(orderIds, orderCurrency),
      loadSubscriptionRows(subIds),
      loadRegisterRows(regIds, orderCurrency),
    ]);

    const data: TransactionHistoryRow[] = [];
    for (const key of keys) {
      const row =
        key.kind === 'ORDER'
          ? orderMap.get(key.id)
          : key.kind === 'SUBSCRIPTION'
            ? subMap.get(key.id)
            : regMap.get(key.id);
      if (row) data.push(row);
    }

    const meta = buildPaginationMeta(page, pageSize, total);

    return NextResponse.json({
      data,
      meta: {
        page: meta.page,
        take: meta.pageSize,
        total: meta.total,
        totalPages: meta.totalPages,
        hasNextPage: meta.hasNextPage,
        hasPrevPage: meta.hasPrevPage,
        canViewHistorical,
        dataScope: canViewHistorical ? 'all' : 'today',
      },
    });
  } catch (error) {
    console.error('transaction-history GET failed', error);
    return NextResponse.json(
      { error: 'Failed to load transaction history' },
      { status: 500 }
    );
  }
}
