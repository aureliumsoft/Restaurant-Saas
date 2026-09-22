import { Prisma } from '@prisma/client';

import { orderBranchWhere } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { isCanceledOrderStatus } from '@/lib/order-payment';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import type { ReportDateRange } from '@/lib/reports/date-range';
import {
  orderCreatedAtRangeSql,
  prismaCreatedAtRangeWhere,
  prismaPaidAtRangeWhere,
  subscriptionPaidAtRangeSql,
  transactionCreatedAtRangeSql,
} from '@/lib/reports/date-range';
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

export type QueryTransactionLedgerInput = {
  restaurantId: string;
  activeBranchId: string | null;
  range: ReportDateRange;
  q?: string;
  kind?: 'ALL' | TransactionHistoryKind;
  page?: number;
  pageSize?: number;
  searchParams?: URLSearchParams;
};

export type QueryTransactionLedgerResult = {
  data: TransactionHistoryRow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  aggregates: {
    transactionCount: number;
    transactionAmount: number;
  };
};

/** Paginated unified transaction ledger with date range. */
export async function queryTransactionLedger(
  input: QueryTransactionLedgerInput
): Promise<QueryTransactionLedgerResult> {
  const restaurantId = input.restaurantId;
  const activeBranchId = input.activeBranchId;
  const range = input.range;
  const q = input.q?.trim() ?? '';
  const kindFilter =
    input.kind === 'ORDER' ||
    input.kind === 'SUBSCRIPTION' ||
    input.kind === 'REGISTER'
      ? input.kind
      : 'ALL';

  const pagination = input.searchParams
    ? parsePaginationParams(input.searchParams, {
        defaultPageSize: input.pageSize ?? 20,
        pageSizeKeys: ['take', 'limit'],
      })
    : {
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 20,
        skip: ((input.page ?? 1) - 1) * (input.pageSize ?? 20),
        take: input.pageSize ?? 20,
      };
  const { page, pageSize } = pagination;

  const orderBranchFilter = orderBranchWhere(activeBranchId);
  const createdAtRange = prismaCreatedAtRangeWhere(range);
  const paidAtRange = prismaPaidAtRangeWhere(range);

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
      ...createdAtRange,
      ...orderSearchWhere(q),
    };
    total = await db.order.count({ where });
    const safePage = clampPage(page, total, pageSize);
    const rows = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: { id: true },
    });
    keys = rows.map((r) => ({ id: r.id, kind: 'ORDER' as const }));
  } else if (kindFilter === 'SUBSCRIPTION') {
    const where: Prisma.SubscriptionPaymentWhereInput = {
      restaurantId,
      ...paidAtRange,
      ...subscriptionSearchWhere(q),
    };
    total = await db.subscriptionPayment.count({ where });
    const safePage = clampPage(page, total, pageSize);
    const rows = await db.subscriptionPayment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: { id: true },
    });
    keys = rows.map((r) => ({ id: r.id, kind: 'SUBSCRIPTION' as const }));
  } else if (kindFilter === 'REGISTER') {
    const where: Prisma.TransactionWhereInput = {
      restaurantId,
      ...createdAtRange,
      ...registerSearchWhere(q),
    };
    total = await db.transaction.count({ where });
    const safePage = clampPage(page, total, pageSize);
    const rows = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: { id: true },
    });
    keys = rows.map((r) => ({ id: r.id, kind: 'REGISTER' as const }));
  } else {
    const like = q ? `%${q}%` : null;
    const ticket = q
      ? Number.parseInt(q.replace(/^#/, ''), 10)
      : Number.NaN;
    const hasTicket = Number.isFinite(ticket);

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
        SELECT o.id::text AS id, 'ORDER'::text AS kind, o."createdAt" AS sort_at,
               COALESCE(
                 (SELECT p.amount FROM "Payment" p
                  WHERE p."orderId" = o.id::text
                  ORDER BY p."createdAt" DESC LIMIT 1),
                 o.total, 0
               )::float AS amt
        FROM "Order" o
        WHERE o."restaurantId" = ${restaurantId}
          ${branchSql}
          ${orderCreatedAtRangeSql(range)}
          ${orderSearchSql}
        UNION ALL
        SELECT s.id::text AS id, 'SUBSCRIPTION'::text AS kind, s."paidAt" AS sort_at,
               COALESCE(s.amount, 0)::float AS amt
        FROM "SubscriptionPayment" s
        WHERE s."restaurantId" = ${restaurantId}
          ${subscriptionPaidAtRangeSql(range)}
          ${subSearchSql}
        UNION ALL
        SELECT t.id::text AS id, 'REGISTER'::text AS kind, t."createdAt" AS sort_at,
               COALESCE(t."totalAmount", 0)::float AS amt
        FROM "Transaction" t
        WHERE t."restaurantId" = ${restaurantId}
          ${transactionCreatedAtRangeSql(range)}
          ${regSearchSql}
      `;

    const countRows = await db.$queryRaw<
      Array<{ count: bigint; amount: number }>
    >(
      Prisma.sql`SELECT COUNT(*)::bigint AS count, COALESCE(SUM(amt), 0)::float AS amount FROM (${unionBody}) AS u`
    );
    total = Number(countRows[0]?.count ?? 0);
    const aggregateAmount = Number(countRows[0]?.amount ?? 0);
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

    const meta = buildPaginationMeta(safePage, pageSize, total);
    return {
      data,
      meta,
      aggregates: {
        transactionCount: total,
        transactionAmount: aggregateAmount,
      },
    };
  }

  // Single-kind path: hydrate + separate aggregate
  const orderIds = keys.filter((k) => k.kind === 'ORDER').map((k) => k.id);
  const subIds = keys
    .filter((k) => k.kind === 'SUBSCRIPTION')
    .map((k) => k.id);
  const regIds = keys.filter((k) => k.kind === 'REGISTER').map((k) => k.id);

  const [orderMap, subMap, regMap, aggregates] = await Promise.all([
    loadOrderRows(orderIds, orderCurrency),
    loadSubscriptionRows(subIds),
    loadRegisterRows(regIds, orderCurrency),
    aggregateTransactionLedger({
      restaurantId,
      activeBranchId,
      range,
      kind: kindFilter,
      q,
    }),
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

  const safePage = clampPage(page, total, pageSize);
  const meta = buildPaginationMeta(safePage, pageSize, total);
  return {
    data,
    meta,
    aggregates,
  };
}

/** Aggregate count + amount for ledger in range (no pagination). */
export async function aggregateTransactionLedger(opts: {
  restaurantId: string;
  activeBranchId: string | null;
  range: ReportDateRange;
  kind?: 'ALL' | TransactionHistoryKind;
  q?: string;
}): Promise<{ transactionCount: number; transactionAmount: number }> {
  const q = opts.q?.trim() ?? '';
  const like = q ? `%${q}%` : null;
  const ticket = q ? Number.parseInt(q.replace(/^#/, ''), 10) : Number.NaN;
  const hasTicket = Number.isFinite(ticket);
  const kind = opts.kind ?? 'ALL';
  const range = opts.range;
  const restaurantId = opts.restaurantId;
  const branchSql = opts.activeBranchId
    ? Prisma.sql`AND o."branchId" = ${opts.activeBranchId}`
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

  const orderPart = Prisma.sql`
        SELECT COALESCE(
                 (SELECT p.amount FROM "Payment" p
                  WHERE p."orderId" = o.id::text
                  ORDER BY p."createdAt" DESC LIMIT 1),
                 o.total, 0
               )::float AS amt
        FROM "Order" o
        WHERE o."restaurantId" = ${restaurantId}
          ${branchSql}
          ${orderCreatedAtRangeSql(range)}
          ${orderSearchSql}`;

  const subPart = Prisma.sql`
        SELECT COALESCE(s.amount, 0)::float AS amt
        FROM "SubscriptionPayment" s
        WHERE s."restaurantId" = ${restaurantId}
          ${subscriptionPaidAtRangeSql(range)}
          ${subSearchSql}`;

  const regPart = Prisma.sql`
        SELECT COALESCE(t."totalAmount", 0)::float AS amt
        FROM "Transaction" t
        WHERE t."restaurantId" = ${restaurantId}
          ${transactionCreatedAtRangeSql(range)}
          ${regSearchSql}`;

  const body =
    kind === 'ORDER'
      ? orderPart
      : kind === 'SUBSCRIPTION'
        ? subPart
        : kind === 'REGISTER'
          ? regPart
          : Prisma.sql`${orderPart} UNION ALL ${subPart} UNION ALL ${regPart}`;

  const rows = await db.$queryRaw<Array<{ count: bigint; amount: number }>>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count, COALESCE(SUM(amt), 0)::float AS amount FROM (${body}) AS u`
  );
  return {
    transactionCount: Number(rows[0]?.count ?? 0),
    transactionAmount: Number(rows[0]?.amount ?? 0),
  };
}
