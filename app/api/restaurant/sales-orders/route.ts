import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getBranchScopeFromRequest, orderBranchSql } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import {
  parseSalesOrdersPeriod,
  salesOrderFilterTimezone,
  salesOrderPeriodMenuSql,
  salesOrderPeriodTransactionSql,
} from '@/lib/sales-order-period';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { salesOrderMethodLabel } from '@/lib/order-fulfillment';
import {
  salesOrderStatusBucket,
  type SalesOrderStatusBucket,
} from '@/lib/sales-order-status';
import type {
  SalesChannelStats,
  SalesOrderRow,
  SalesOrdersStats,
  SalesOrdersStatusFilter,
  SalesOrdersTab,
} from '@/types/sales-order';

const PAGE_SIZE = 10;

const emptyChannelStats = (): SalesChannelStats => ({
  totalOrders: 0,
  totalAmount: 0,
  revenueAmount: 0,
  revenueOrders: 0,
  pending: { count: 0, amount: 0 },
  canceled: { count: 0, amount: 0 },
});

function parseTab(v: string | null): SalesOrdersTab {
  if (v === 'pos' || v === 'kiosk') return v;
  return 'online';
}

function parseStatusFilter(v: string | null): SalesOrdersStatusFilter {
  if (v === 'completed' || v === 'pending' || v === 'canceled') return v;
  return 'all';
}

function statusSqlFilter(filter: SalesOrdersStatusFilter): Prisma.Sql {
  if (filter === 'completed') {
    return Prisma.sql`AND lower(o.status) IN ('completed', 'complete')`;
  }
  if (filter === 'canceled') {
    return Prisma.sql`AND lower(o.status) IN ('canceled', 'cancelled', 'failed', 'cancel')`;
  }
  if (filter === 'pending') {
    return Prisma.sql`AND lower(o.status) NOT IN ('completed', 'complete', 'canceled', 'cancelled', 'failed', 'cancel')`;
  }
  return Prisma.empty;
}

function transactionStatusSqlFilter(filter: SalesOrdersStatusFilter): Prisma.Sql {
  if (filter === 'completed') {
    return Prisma.sql`AND t."isComplete" = true`;
  }
  if (filter === 'canceled') {
    return Prisma.sql`AND false`;
  }
  if (filter === 'pending') {
    return Prisma.sql`AND t."isComplete" = false`;
  }
  return Prisma.empty;
}

function searchSql(search: string): Prisma.Sql {
  const q = search.trim();
  if (!q) return Prisma.empty;
  const like = `%${q}%`;
  const ticket = Number.parseInt(q.replace(/^#/, ''), 10);
  if (Number.isFinite(ticket)) {
    return Prisma.sql`AND (
      o."shortOrderId" ILIKE ${like}
      OR o.id::text ILIKE ${like}
      OR o."ticketNumber" = ${ticket}
    )`;
  }
  return Prisma.sql`AND (
    o."shortOrderId" ILIKE ${like}
    OR o.id::text ILIKE ${like}
  )`;
}

function transactionSearchSql(search: string): Prisma.Sql {
  const q = search.trim();
  if (!q) return Prisma.empty;
  const like = `%${q}%`;
  return Prisma.sql`AND t.id::text ILIKE ${like}`;
}

function mapMenuOrderRow(o: {
  id: string;
  trackingToken?: string | null;
  shortOrderId?: string | null;
  ticketNumber: number | null;
  total: number;
  status: string;
  paymentStatus?: string | null;
  paymentId?: string | null;
  sourceType: string;
  address?: string | null;
  tableLabel?: string | null;
  createdAt: Date;
}): SalesOrderRow {
  const sourceType = o.sourceType;
  return {
    id: o.id,
    kind: 'menu_order',
    trackingToken: o.trackingToken ?? o.shortOrderId ?? o.id,
    ticketNumber: o.ticketNumber,
    sourceType,
    total: Number(o.total) || 0,
    status: o.status,
    paymentStatus: o.paymentStatus ?? null,
    transactionId: o.paymentId ?? o.id,
    method: salesOrderMethodLabel({
      address: o.address,
      sourceType,
      tableLabel: o.tableLabel,
    }),
    createdAt: o.createdAt.toISOString(),
  };
}

function sourceSqlForTab(tab: SalesOrdersTab): Prisma.Sql {
  if (tab === 'online') return Prisma.sql`o."sourceType" = 'ONLINE'::"OrderSourceType"`;
  if (tab === 'kiosk') return Prisma.sql`o."sourceType" = 'KIOSK'::"OrderSourceType"`;
  return Prisma.sql`o."sourceType" IN ('POS'::"OrderSourceType", 'OTHER'::"OrderSourceType")`;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'sales',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const tab = parseTab(url.searchParams.get('tab'));
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const statusFilter = parseStatusFilter(url.searchParams.get('status'));
    const period = parseSalesOrdersPeriod(url.searchParams.get('period'));
    const search = (url.searchParams.get('search') ?? '').trim();
    const offset = (page - 1) * PAGE_SIZE;
    const filterTz = salesOrderFilterTimezone();
    const menuPeriodSql = salesOrderPeriodMenuSql(period, filterTz);
    const transactionPeriodSql = salesOrderPeriodTransactionSql(
      period,
      filterTz
    );

    const restaurant = await db.restaurant.findUnique({
      where: { id: auth.restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      const stats: SalesOrdersStats = {
        online: emptyChannelStats(),
        pos: emptyChannelStats(),
        kiosk: emptyChannelStats(),
      };
      return NextResponse.json({
        orders: [],
        stats,
        pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 },
      });
    }

    const rid = restaurant.id;
    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      rid
    );
    const branchSql = orderBranchSql(branchScope?.activeBranchId ?? null);

    // --- Channel stats (all orders, not filtered by search/status) ---
    const stats: SalesOrdersStats = {
      online: emptyChannelStats(),
      pos: emptyChannelStats(),
      kiosk: emptyChannelStats(),
    };

    try {
      const menuStatRows = await db.$queryRaw<
        Array<{
          sourceType: string;
          status: string;
          cnt: bigint | number;
          amt: number;
        }>
      >(Prisma.sql`
        SELECT o."sourceType"::text AS "sourceType", o.status,
               COUNT(*)::int AS cnt, COALESCE(SUM(o.total), 0)::float AS amt
        FROM "Order" o
        WHERE o."restaurantId" = ${rid}
          ${branchSql}
          ${menuPeriodSql}
        GROUP BY o."sourceType", o.status
      `);
      for (const row of menuStatRows) {
        const amount = Number(row.amt) || 0;
        const bucket = salesOrderStatusBucket(row.status);
        const count = Number(row.cnt) || 0;
        const target =
          row.sourceType === 'ONLINE'
            ? stats.online
            : row.sourceType === 'KIOSK'
              ? stats.kiosk
              : row.sourceType === 'POS' || row.sourceType === 'OTHER'
                ? stats.pos
                : null;
        if (!target) continue;
        target.totalOrders += count;
        target.totalAmount += amount;
        if (bucket === 'completed') {
          target.revenueOrders += count;
          target.revenueAmount += amount;
        } else if (bucket === 'pending') {
          target.pending.count += count;
          target.pending.amount += amount;
        } else {
          target.canceled.count += count;
          target.canceled.amount += amount;
        }
      }
    } catch {
      // prisma fallback omitted for stats — keep zeros
    }

    try {
      const txRows = await db.$queryRaw<
        Array<{ isComplete: boolean; cnt: number; amt: number }>
      >(Prisma.sql`
        SELECT t."isComplete", COUNT(*)::int AS cnt,
               COALESCE(SUM(t."totalAmount"), 0)::float AS amt
        FROM "Transaction" t
        WHERE t."restaurantId" = ${rid}
          ${transactionPeriodSql}
        GROUP BY t."isComplete"
      `);
      for (const row of txRows) {
        const amount = Number(row.amt) || 0;
        const count = Number(row.cnt) || 0;
        const bucket: SalesOrderStatusBucket = row.isComplete
          ? 'completed'
          : 'pending';
        stats.pos.totalOrders += count;
        stats.pos.totalAmount += amount;
        if (bucket === 'completed') {
          stats.pos.revenueOrders += count;
          stats.pos.revenueAmount += amount;
        } else {
          stats.pos.pending.count += count;
          stats.pos.pending.amount += amount;
        }
      }
    } catch {
      // ignore
    }

    // --- Paginated list for active tab ---
    let orders: SalesOrderRow[] = [];
    let total = 0;

    if (tab === 'pos') {
      const unionRows = await db.$queryRaw<
        Array<{
          id: string;
          kind: string;
          trackingToken: string | null;
          ticketNumber: number | null;
          total: number | null;
          status: string;
          paymentStatus: string | null;
          paymentId: string | null;
          sourceType: string;
          address: string | null;
          tableLabel: string | null;
          createdAt: Date;
        }>
      >(Prisma.sql`
        SELECT * FROM (
          SELECT o.id, 'menu_order'::text AS kind,
            o."shortOrderId" AS "trackingToken", o."ticketNumber", o.total, o.status,
            o."sourceType"::text AS "sourceType", o.address, o."tableLabel",
            o."createdAt",
            (
              SELECT p.status FROM "Payment" p
              WHERE p."orderId" = o.id::text ORDER BY p."createdAt" DESC LIMIT 1
            ) AS "paymentStatus",
            (
              SELECT p.id FROM "Payment" p
              WHERE p."orderId" = o.id::text ORDER BY p."createdAt" DESC LIMIT 1
            ) AS "paymentId"
          FROM "Order" o
          WHERE o."restaurantId" = ${rid}
            ${branchSql}
            AND ${sourceSqlForTab(tab)}
            ${statusSqlFilter(statusFilter)}
            ${searchSql(search)}
            ${menuPeriodSql}
          UNION ALL
          SELECT t.id, 'sale_transaction'::text AS kind,
            t.id::text AS "trackingToken", NULL::int AS "ticketNumber",
            t."totalAmount"::float AS total,
            CASE WHEN t."isComplete" THEN 'Complete' ELSE 'Open' END AS status,
            t."sourceType"::text AS "sourceType", NULL::text AS address,
            NULL::text AS "tableLabel", t."createdAt",
            NULL::text AS "paymentStatus", NULL::text AS "paymentId"
          FROM "Transaction" t
          WHERE t."restaurantId" = ${rid}
            ${transactionStatusSqlFilter(statusFilter)}
            ${transactionSearchSql(search)}
            ${transactionPeriodSql}
        ) u
        ORDER BY u."createdAt" DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `);

      const countRow = await db.$queryRaw<[{ count: number }]>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT o.id FROM "Order" o
          WHERE o."restaurantId" = ${rid}
            ${branchSql}
            AND ${sourceSqlForTab(tab)}
            ${statusSqlFilter(statusFilter)}
            ${searchSql(search)}
            ${menuPeriodSql}
          UNION ALL
          SELECT t.id FROM "Transaction" t
          WHERE t."restaurantId" = ${rid}
            ${transactionStatusSqlFilter(statusFilter)}
            ${transactionSearchSql(search)}
            ${transactionPeriodSql}
        ) c
      `);
      total = Number(countRow[0]?.count ?? 0);

      orders = unionRows.map((o) => {
        if (o.kind === 'sale_transaction') {
          return {
            id: o.id,
            kind: 'sale_transaction' as const,
            trackingToken: o.trackingToken,
            ticketNumber: null,
            sourceType: o.sourceType,
            total: o.total != null ? Number(o.total) : null,
            status: o.status,
            transactionId: o.id,
            createdAt: o.createdAt.toISOString(),
          };
        }
        return mapMenuOrderRow({
          id: o.id,
          trackingToken: o.trackingToken,
          ticketNumber: o.ticketNumber,
          total: Number(o.total) || 0,
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentId: o.paymentId,
          sourceType: o.sourceType,
          address: o.address,
          tableLabel: o.tableLabel,
          createdAt: o.createdAt,
        });
      });
    } else {
      const rows = await db.$queryRaw<
        Array<{
          id: string;
          shortOrderId: string | null;
          ticketNumber: number | null;
          total: number;
          status: string;
          paymentStatus: string | null;
          paymentId: string | null;
          sourceType: string;
          address: string | null;
          tableLabel: string | null;
          createdAt: Date;
        }>
      >(Prisma.sql`
        SELECT o.id, o."shortOrderId", o."ticketNumber", o.total, o.status,
          o."sourceType"::text AS "sourceType", o.address, o."tableLabel", o."createdAt",
          (
            SELECT p.status FROM "Payment" p
            WHERE p."orderId" = o.id::text ORDER BY p."createdAt" DESC LIMIT 1
          ) AS "paymentStatus",
          (
            SELECT p.id FROM "Payment" p
            WHERE p."orderId" = o.id::text ORDER BY p."createdAt" DESC LIMIT 1
          ) AS "paymentId"
        FROM "Order" o
        WHERE o."restaurantId" = ${rid}
          ${branchSql}
          AND ${sourceSqlForTab(tab)}
          ${statusSqlFilter(statusFilter)}
          ${searchSql(search)}
          ${menuPeriodSql}
        ORDER BY o."createdAt" DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `);

      const countRow = await db.$queryRaw<[{ count: number }]>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "Order" o
        WHERE o."restaurantId" = ${rid}
          ${branchSql}
          AND ${sourceSqlForTab(tab)}
          ${statusSqlFilter(statusFilter)}
          ${searchSql(search)}
          ${menuPeriodSql}
      `);
      total = Number(countRow[0]?.count ?? 0);

      orders = rows.map((o) => mapMenuOrderRow(o));
    }

    const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;

    return NextResponse.json({
      orders,
      stats,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
      },
      period,
      onlineOrders: tab === 'online' ? orders : [],
      posOrders: tab === 'pos' ? orders : [],
      kioskOrders: tab === 'kiosk' ? orders : [],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load sales orders' },
      { status: 500 }
    );
  }
}
