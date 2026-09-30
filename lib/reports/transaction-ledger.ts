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
import { orderCreatedAtRangeSql } from '@/lib/reports/date-range';
import type { TransactionHistoryRow } from '@/types/transaction-history';

/** Restaurant ops ledger kinds (orders + inventory restocks). */
export type RestaurantLedgerKind = 'ORDER' | 'INVENTORY';

type UnifiedKey = { id: string; kind: RestaurantLedgerKind };

export type LedgerFilters = {
  status?: string | null;
  source?: string | null;
  payment?: string | null;
};

function parseLedgerKind(
  raw: string | null | undefined
): 'ALL' | RestaurantLedgerKind {
  if (raw === 'ORDER' || raw === 'INVENTORY') return raw;
  return 'ALL';
}

function normalizeFilter(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v || v === 'all' || v === 'ALL') return null;
  return v;
}

export function parseLedgerFilters(
  searchParams?: URLSearchParams | null
): LedgerFilters {
  if (!searchParams) return {};
  return {
    status: normalizeFilter(searchParams.get('status')),
    source: normalizeFilter(searchParams.get('source')),
    payment: normalizeFilter(
      searchParams.get('payment') ?? searchParams.get('method')
    ),
  };
}

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

function inventorySearchWhere(q: string): Prisma.ExpenseWhereInput | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { id: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
    ],
  };
}

function expenseOccurredAtRangeWhere(range: ReportDateRange) {
  return { occurredAt: { gte: range.from, lte: range.to } };
}

function expenseOccurredAtRangeSql(range: ReportDateRange): Prisma.Sql {
  return Prisma.sql`AND e."occurredAt" >= ${range.from} AND e."occurredAt" <= ${range.to}`;
}

function orderStatusWhere(
  status: string | null | undefined
): Prisma.OrderWhereInput | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'complete' || s === 'paid') {
    return {
      OR: [
        { status: { equals: 'completed', mode: 'insensitive' } },
        { status: { equals: 'complete', mode: 'insensitive' } },
        { status: { equals: 'delivered', mode: 'insensitive' } },
        {
          payments: {
            some: { status: { equals: 'completed', mode: 'insensitive' } },
          },
        },
        {
          payments: {
            some: { status: { equals: 'paid', mode: 'insensitive' } },
          },
        },
      ],
    };
  }
  if (s === 'canceled' || s === 'cancelled') {
    return {
      OR: [
        { status: { equals: 'canceled', mode: 'insensitive' } },
        { status: { equals: 'cancelled', mode: 'insensitive' } },
        { status: { equals: 'failed', mode: 'insensitive' } },
      ],
    };
  }
  if (s === 'pending') {
    return {
      NOT: {
        OR: [
          { status: { equals: 'completed', mode: 'insensitive' } },
          { status: { equals: 'complete', mode: 'insensitive' } },
          { status: { equals: 'delivered', mode: 'insensitive' } },
          { status: { equals: 'canceled', mode: 'insensitive' } },
          { status: { equals: 'cancelled', mode: 'insensitive' } },
          { status: { equals: 'failed', mode: 'insensitive' } },
        ],
      },
    };
  }
  return { status: { contains: status, mode: 'insensitive' } };
}

function orderSourceWhere(
  source: string | null | undefined
): Prisma.OrderWhereInput | undefined {
  if (!source) return undefined;
  const upper = source.toUpperCase();
  if (upper === 'WEB') return { sourceType: 'ONLINE' as never };
  if (upper === 'INVENTORY') return { id: '__none__' };
  return { sourceType: upper as never };
}

function orderPaymentWhere(
  payment: string | null | undefined
): Prisma.OrderWhereInput | undefined {
  if (!payment) return undefined;
  const p = payment.toLowerCase();
  if (p === 'cash') {
    return {
      payments: { some: { method: { contains: 'cash', mode: 'insensitive' } } },
    };
  }
  if (p === 'card') {
    return {
      payments: {
        some: {
          OR: [
            { method: { contains: 'card', mode: 'insensitive' } },
            { method: { contains: 'stripe', mode: 'insensitive' } },
            { method: { contains: 'visa', mode: 'insensitive' } },
            { method: { contains: 'master', mode: 'insensitive' } },
            { method: { contains: 'terminal', mode: 'insensitive' } },
            { method: { contains: 'debit', mode: 'insensitive' } },
            { method: { contains: 'credit', mode: 'insensitive' } },
          ],
        },
      },
    };
  }
  if (p === 'other') {
    return {
      payments: {
        some: {
          AND: [
            { NOT: { method: { contains: 'cash', mode: 'insensitive' } } },
            { NOT: { method: { contains: 'card', mode: 'insensitive' } } },
            { NOT: { method: { contains: 'stripe', mode: 'insensitive' } } },
          ],
        },
      },
    };
  }
  return {
    payments: {
      some: { method: { contains: payment, mode: 'insensitive' } },
    },
  };
}

function inventoryMatchesFilters(filters: LedgerFilters): boolean {
  if (filters.payment) return false;
  if (filters.source) {
    const s = filters.source.toUpperCase();
    if (s !== 'INVENTORY') return false;
  }
  if (filters.status) {
    const s = filters.status.toLowerCase();
    if (s !== 'completed' && s !== 'complete' && s !== 'paid') return false;
  }
  return true;
}

function orderStatusSql(status: string | null | undefined): Prisma.Sql {
  if (!status) return Prisma.empty;
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'complete' || s === 'paid') {
    return Prisma.sql`AND (
      o.status ILIKE 'completed' OR o.status ILIKE 'complete' OR o.status ILIKE 'delivered'
      OR EXISTS (
        SELECT 1 FROM "Payment" p
        WHERE p."orderId" = o.id::text
          AND (p.status ILIKE 'completed' OR p.status ILIKE 'paid')
      )
    )`;
  }
  if (s === 'canceled' || s === 'cancelled') {
    return Prisma.sql`AND (
      o.status ILIKE 'canceled' OR o.status ILIKE 'cancelled' OR o.status ILIKE 'failed'
    )`;
  }
  if (s === 'pending') {
    return Prisma.sql`AND NOT (
      o.status ILIKE 'completed' OR o.status ILIKE 'complete' OR o.status ILIKE 'delivered'
      OR o.status ILIKE 'canceled' OR o.status ILIKE 'cancelled' OR o.status ILIKE 'failed'
    )`;
  }
  const like = `%${status}%`;
  return Prisma.sql`AND o.status ILIKE ${like}`;
}

function orderSourceSql(source: string | null | undefined): Prisma.Sql {
  if (!source) return Prisma.empty;
  const upper = source.toUpperCase() === 'WEB' ? 'ONLINE' : source.toUpperCase();
  if (upper === 'INVENTORY') {
    return Prisma.sql`AND FALSE`;
  }
  return Prisma.sql`AND o."sourceType"::text = ${upper}`;
}

function orderPaymentSql(payment: string | null | undefined): Prisma.Sql {
  if (!payment) return Prisma.empty;
  const p = payment.toLowerCase();
  if (p === 'cash') {
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM "Payment" pay
      WHERE pay."orderId" = o.id::text AND pay.method ILIKE '%cash%'
    )`;
  }
  if (p === 'card') {
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM "Payment" pay
      WHERE pay."orderId" = o.id::text
        AND (
          pay.method ILIKE '%card%' OR pay.method ILIKE '%stripe%'
          OR pay.method ILIKE '%visa%' OR pay.method ILIKE '%master%'
          OR pay.method ILIKE '%terminal%' OR pay.method ILIKE '%debit%'
          OR pay.method ILIKE '%credit%'
        )
    )`;
  }
  if (p === 'other') {
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM "Payment" pay
      WHERE pay."orderId" = o.id::text
        AND pay.method NOT ILIKE '%cash%'
        AND pay.method NOT ILIKE '%card%'
        AND pay.method NOT ILIKE '%stripe%'
    )`;
  }
  const like = `%${payment}%`;
  return Prisma.sql`AND EXISTS (
    SELECT 1 FROM "Payment" pay
    WHERE pay."orderId" = o.id::text AND pay.method ILIKE ${like}
  )`;
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

async function loadInventoryRows(
  ids: string[],
  orderCurrency: string
): Promise<Map<string, TransactionHistoryRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.expense.findMany({
    where: { id: { in: ids }, type: 'INVENTORY' },
    select: {
      id: true,
      title: true,
      amount: true,
      notes: true,
      occurredAt: true,
      quantity: true,
      ingredientId: true,
      ingredient: { select: { name: true } },
    },
  });
  const map = new Map<string, TransactionHistoryRow>();
  for (const e of rows) {
    map.set(e.id, {
      key: `INVENTORY:${e.id}`,
      kind: 'INVENTORY',
      transactionId: e.id,
      referenceId: e.ingredientId ?? null,
      shortOrderId: null,
      ticketNumber: null,
      amount: e.amount,
      currency: orderCurrency,
      status: 'completed',
      method: null,
      source: 'INVENTORY',
      note: e.notes ?? e.title,
      customerName: e.ingredient?.name ?? e.title,
      createdAt: e.occurredAt.toISOString(),
    });
  }
  return map;
}

export type QueryTransactionLedgerInput = {
  restaurantId: string;
  activeBranchId: string | null;
  range: ReportDateRange;
  q?: string;
  kind?: 'ALL' | RestaurantLedgerKind | string | null;
  status?: string | null;
  source?: string | null;
  payment?: string | null;
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

/** Paginated restaurant ledger: orders + inventory restock expenses. */
export async function queryTransactionLedger(
  input: QueryTransactionLedgerInput
): Promise<QueryTransactionLedgerResult> {
  const restaurantId = input.restaurantId;
  const activeBranchId = input.activeBranchId;
  const range = input.range;
  const q = input.q?.trim() ?? '';
  const kindFilter = parseLedgerKind(
    input.kind ?? input.searchParams?.get('kind')
  );
  const spFilters = parseLedgerFilters(input.searchParams);
  const filters: LedgerFilters = {
    status: normalizeFilter(input.status) ?? spFilters.status,
    source: normalizeFilter(input.source) ?? spFilters.source,
    payment: normalizeFilter(input.payment) ?? spFilters.payment,
  };

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
  const expenseBranchFilter = activeBranchId
    ? { branchId: activeBranchId }
    : {};

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { currencyCode: true },
  });
  const orderCurrency = restaurant?.currencyCode ?? 'EUR';

  let keys: UnifiedKey[] = [];
  let total = 0;
  let aggregateAmount = 0;

  if (kindFilter === 'ORDER') {
    const where: Prisma.OrderWhereInput = {
      restaurantId,
      ...orderBranchFilter,
      createdAt: { gte: range.from, lte: range.to },
      ...orderSearchWhere(q),
      ...orderStatusWhere(filters.status),
      ...orderSourceWhere(filters.source),
      ...orderPaymentWhere(filters.payment),
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
    const agg = await aggregateTransactionLedger({
      restaurantId,
      activeBranchId,
      range,
      kind: 'ORDER',
      q,
      ...filters,
    });
    aggregateAmount = agg.transactionAmount;
  } else if (kindFilter === 'INVENTORY') {
    if (!inventoryMatchesFilters(filters)) {
      return {
        data: [],
        meta: buildPaginationMeta(1, pageSize, 0),
        aggregates: { transactionCount: 0, transactionAmount: 0 },
      };
    }
    const where: Prisma.ExpenseWhereInput = {
      restaurantId,
      type: 'INVENTORY',
      ...expenseBranchFilter,
      ...expenseOccurredAtRangeWhere(range),
      ...inventorySearchWhere(q),
    };
    total = await db.expense.count({ where });
    const safePage = clampPage(page, total, pageSize);
    const rows = await db.expense.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: { id: true },
    });
    keys = rows.map((r) => ({ id: r.id, kind: 'INVENTORY' as const }));
    const agg = await aggregateTransactionLedger({
      restaurantId,
      activeBranchId,
      range,
      kind: 'INVENTORY',
      q,
      ...filters,
    });
    aggregateAmount = agg.transactionAmount;
  } else {
    const includeOrders =
      !filters.source || filters.source.toUpperCase() !== 'INVENTORY';
    const includeInventory = inventoryMatchesFilters(filters);

    const like = q ? `%${q}%` : null;
    const ticket = q
      ? Number.parseInt(q.replace(/^#/, ''), 10)
      : Number.NaN;
    const hasTicket = Number.isFinite(ticket);
    const branchSql = activeBranchId
      ? Prisma.sql`AND o."branchId" = ${activeBranchId}`
      : Prisma.empty;
    const expenseBranchSql = activeBranchId
      ? Prisma.sql`AND e."branchId" = ${activeBranchId}`
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
    const invSearchSql = like
      ? Prisma.sql`AND (
            e.id::text ILIKE ${like}
            OR e.title ILIKE ${like}
            OR COALESCE(e.notes, '') ILIKE ${like}
          )`
      : Prisma.empty;

    const parts: Prisma.Sql[] = [];
    if (includeOrders) {
      parts.push(Prisma.sql`
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
          ${orderStatusSql(filters.status)}
          ${orderSourceSql(filters.source)}
          ${orderPaymentSql(filters.payment)}
      `);
    }
    if (includeInventory) {
      parts.push(Prisma.sql`
        SELECT e.id::text AS id, 'INVENTORY'::text AS kind, e."occurredAt" AS sort_at,
               COALESCE(e.amount, 0)::float AS amt
        FROM "Expense" e
        WHERE e."restaurantId" = ${restaurantId}
          AND e.type = 'INVENTORY'::"ExpenseType"
          ${expenseBranchSql}
          ${expenseOccurredAtRangeSql(range)}
          ${invSearchSql}
      `);
    }

    if (parts.length === 0) {
      return {
        data: [],
        meta: buildPaginationMeta(1, pageSize, 0),
        aggregates: { transactionCount: 0, transactionAmount: 0 },
      };
    }

    const unionBody =
      parts.length === 1
        ? parts[0]!
        : Prisma.sql`${parts[0]!} UNION ALL ${parts[1]!}`;

    const countRows = await db.$queryRaw<
      Array<{ count: bigint; amount: number }>
    >(
      Prisma.sql`SELECT COUNT(*)::bigint AS count, COALESCE(SUM(amt), 0)::float AS amount FROM (${unionBody}) AS u`
    );
    total = Number(countRows[0]?.count ?? 0);
    aggregateAmount = Number(countRows[0]?.amount ?? 0);
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
        (r): r is { id: string; kind: RestaurantLedgerKind } =>
          r.kind === 'ORDER' || r.kind === 'INVENTORY'
      )
      .map((r) => ({ id: r.id, kind: r.kind }));

    const orderIds = keys.filter((k) => k.kind === 'ORDER').map((k) => k.id);
    const invIds = keys.filter((k) => k.kind === 'INVENTORY').map((k) => k.id);
    const [orderMap, invMap] = await Promise.all([
      loadOrderRows(orderIds, orderCurrency),
      loadInventoryRows(invIds, orderCurrency),
    ]);

    const data: TransactionHistoryRow[] = [];
    for (const key of keys) {
      const row =
        key.kind === 'ORDER'
          ? orderMap.get(key.id)
          : invMap.get(key.id);
      if (row) data.push(row);
    }

    return {
      data,
      meta: buildPaginationMeta(safePage, pageSize, total),
      aggregates: {
        transactionCount: total,
        transactionAmount: aggregateAmount,
      },
    };
  }

  const orderIds = keys.filter((k) => k.kind === 'ORDER').map((k) => k.id);
  const invIds = keys.filter((k) => k.kind === 'INVENTORY').map((k) => k.id);
  const [orderMap, invMap] = await Promise.all([
    loadOrderRows(orderIds, orderCurrency),
    loadInventoryRows(invIds, orderCurrency),
  ]);

  const data: TransactionHistoryRow[] = [];
  for (const key of keys) {
    const row =
      key.kind === 'ORDER' ? orderMap.get(key.id) : invMap.get(key.id);
    if (row) data.push(row);
  }

  const safePage = clampPage(page, total, pageSize);
  return {
    data,
    meta: buildPaginationMeta(safePage, pageSize, total),
    aggregates: {
      transactionCount: total,
      transactionAmount: aggregateAmount,
    },
  };
}

/** Aggregate count + amount for restaurant ledger in range (orders + inventory). */
export async function aggregateTransactionLedger(opts: {
  restaurantId: string;
  activeBranchId: string | null;
  range: ReportDateRange;
  kind?: 'ALL' | RestaurantLedgerKind | string | null;
  q?: string;
  status?: string | null;
  source?: string | null;
  payment?: string | null;
}): Promise<{ transactionCount: number; transactionAmount: number }> {
  const q = opts.q?.trim() ?? '';
  const like = q ? `%${q}%` : null;
  const ticket = q ? Number.parseInt(q.replace(/^#/, ''), 10) : Number.NaN;
  const hasTicket = Number.isFinite(ticket);
  const kind = parseLedgerKind(opts.kind);
  const range = opts.range;
  const restaurantId = opts.restaurantId;
  const filters: LedgerFilters = {
    status: normalizeFilter(opts.status),
    source: normalizeFilter(opts.source),
    payment: normalizeFilter(opts.payment),
  };
  const branchSql = opts.activeBranchId
    ? Prisma.sql`AND o."branchId" = ${opts.activeBranchId}`
    : Prisma.empty;
  const expenseBranchSql = opts.activeBranchId
    ? Prisma.sql`AND e."branchId" = ${opts.activeBranchId}`
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
  const invSearchSql = like
    ? Prisma.sql`AND (
            e.id::text ILIKE ${like}
            OR e.title ILIKE ${like}
            OR COALESCE(e.notes, '') ILIKE ${like}
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
          ${orderSearchSql}
          ${orderStatusSql(filters.status)}
          ${orderSourceSql(filters.source)}
          ${orderPaymentSql(filters.payment)}`;

  const invPart = Prisma.sql`
        SELECT COALESCE(e.amount, 0)::float AS amt
        FROM "Expense" e
        WHERE e."restaurantId" = ${restaurantId}
          AND e.type = 'INVENTORY'::"ExpenseType"
          ${expenseBranchSql}
          ${expenseOccurredAtRangeSql(range)}
          ${invSearchSql}`;

  let body: Prisma.Sql;
  if (kind === 'ORDER') {
    body = orderPart;
  } else if (kind === 'INVENTORY') {
    if (!inventoryMatchesFilters(filters)) {
      return { transactionCount: 0, transactionAmount: 0 };
    }
    body = invPart;
  } else {
    const includeOrders =
      !filters.source || filters.source.toUpperCase() !== 'INVENTORY';
    const includeInventory = inventoryMatchesFilters(filters);
    if (includeOrders && includeInventory) {
      body = Prisma.sql`${orderPart} UNION ALL ${invPart}`;
    } else if (includeOrders) {
      body = orderPart;
    } else if (includeInventory) {
      body = invPart;
    } else {
      return { transactionCount: 0, transactionAmount: 0 };
    }
  }

  const rows = await db.$queryRaw<Array<{ count: bigint; amount: number }>>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count, COALESCE(SUM(amt), 0)::float AS amount FROM (${body}) AS u`
  );
  return {
    transactionCount: Number(rows[0]?.count ?? 0),
    transactionAmount: Number(rows[0]?.amount ?? 0),
  };
}
