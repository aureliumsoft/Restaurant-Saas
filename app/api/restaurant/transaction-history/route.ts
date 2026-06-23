import { NextRequest, NextResponse } from 'next/server';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
  userIsOwnerOrAdmin,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import {
  getTodayCreatedAtBounds,
  prismaCreatedAtTodayWhere,
  salesOrderFilterTimezone,
} from '@/lib/sales-order-period';

type HistoryKind = 'ORDER' | 'SUBSCRIPTION' | 'REGISTER';

type HistoryRow = {
  key: string;
  kind: HistoryKind;
  transactionId: string;
  referenceId: string | null;
  shortOrderId: string | null;
  ticketNumber: number | null;
  amount: number | null;
  currency: string;
  status: string;
  method: string | null;
  source: string;
  note: string | null;
  customerName: string | null;
  createdAt: string;
};

function toPositiveInt(raw: string | null, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
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
    const orderBranchFilter = orderBranchWhere(branchScope?.activeBranchId ?? null);
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

    const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
    const kindFilterRaw = req.nextUrl.searchParams.get('kind');
    const kindFilter =
      kindFilterRaw === 'ORDER' ||
      kindFilterRaw === 'SUBSCRIPTION' ||
      kindFilterRaw === 'REGISTER'
        ? kindFilterRaw
        : 'ALL';
    const page = toPositiveInt(req.nextUrl.searchParams.get('page'), 1);
    const take = Math.min(toPositiveInt(req.nextUrl.searchParams.get('take'), 20), 100);

    const [orders, subscriptions, registerTxns] = await Promise.all([
      db.order.findMany({
        where: { restaurantId, ...orderBranchFilter, ...todayCreatedAt },
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
      }),
      db.subscriptionPayment.findMany({
        where: { restaurantId, ...todayPaidAt },
        orderBy: { paidAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          paidAt: true,
          notes: true,
          restaurantSubscriptionId: true,
        },
      }),
      db.transaction.findMany({
        where: { restaurantId, ...todayCreatedAt },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          totalAmount: true,
          isComplete: true,
          sourceType: true,
          createdAt: true,
        },
      }),
    ]);

    const rows: HistoryRow[] = [
      ...orders.map((o) => {
        const payment = o.payments[0];
        return {
          key: `ORDER:${o.id}`,
          kind: 'ORDER' as const,
          transactionId: payment?.id ?? o.id,
          referenceId: o.id,
          shortOrderId: o.shortOrderId,
          ticketNumber: o.ticketNumber,
          amount: payment?.amount ?? o.total ?? null,
          currency: 'EUR',
          status: payment?.status ?? o.status,
          method: payment?.method ?? null,
          source: o.sourceType,
          note: o.address ?? null,
          customerName: o.customer?.name ?? null,
          createdAt: o.createdAt.toISOString(),
        };
      }),
      ...subscriptions.map((p) => ({
        key: `SUBSCRIPTION:${p.id}`,
        kind: 'SUBSCRIPTION' as const,
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
      })),
      ...registerTxns.map((t) => ({
        key: `REGISTER:${t.id}`,
        kind: 'REGISTER' as const,
        transactionId: t.id,
        referenceId: null,
        shortOrderId: null,
        ticketNumber: null,
        amount: t.totalAmount != null ? Number(t.totalAmount) : null,
        currency: 'EUR',
        status: t.isComplete ? 'completed' : 'open',
        method: 'register',
        source: t.sourceType,
        note: null,
        customerName: null,
        createdAt: t.createdAt.toISOString(),
      })),
    ];

    const filtered = rows
      .filter((row) => (kindFilter === 'ALL' ? true : row.kind === kindFilter))
      .filter((row) => {
        if (!q) return true;
        return (
          row.transactionId.toLowerCase().includes(q) ||
          (row.referenceId ?? '').toLowerCase().includes(q) ||
          (row.shortOrderId ?? '').toLowerCase().includes(q) ||
          (row.ticketNumber != null ? String(row.ticketNumber) : '').includes(q) ||
          row.kind.toLowerCase().includes(q) ||
          row.source.toLowerCase().includes(q) ||
          row.status.toLowerCase().includes(q) ||
          (row.method ?? '').toLowerCase().includes(q) ||
          (row.customerName ?? '').toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / take));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * take;
    const data = filtered.slice(start, start + take);

    return NextResponse.json({
      data,
      meta: {
        page: safePage,
        take,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
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

