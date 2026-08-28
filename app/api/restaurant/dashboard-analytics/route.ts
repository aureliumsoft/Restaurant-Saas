import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
  userIsOwnerOrAdmin,
} from '@/lib/branch/branch-scope';
import { countDiningTables } from '@/lib/dining-tables-query';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import {
  analyticsActiveOrderStatusWhere,
  isCanceledOrderStatus,
  orderCountsTowardRevenue,
} from '@/lib/sales-order-status';
import {
  enforceAnalyticsDays,
  getTodayCreatedAtBounds,
  getTodayDayKeyInTimezone,
  lastNCalendarDayKeys,
  calendarDayKeyInTimezone,
  salesOrderFilterTimezone,
} from '@/lib/sales-order-period';
import { getRestaurantPlanFeatures } from '@/lib/subscription-plan-enforcement';

function hourInTimezone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    return Number.isFinite(h) ? h : date.getHours();
  } catch {
    return date.getHours();
  }
}

function normalizePaymentMethod(
  method: string | null | undefined
): 'cash' | 'card' | 'other' {
  const m = String(method ?? '').trim().toLowerCase();
  if (!m) return 'other';
  if (m.includes('cash')) return 'cash';
  if (
    m.includes('card') ||
    m.includes('visa') ||
    m.includes('master') ||
    m.includes('stripe') ||
    m.includes('terminal') ||
    m.includes('debit') ||
    m.includes('credit')
  ) {
    return 'card';
  }
  return 'other';
}

async function resolveRestaurantId(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKey: 'dashboard',
    action: 'access',
  });
  if (!auth.ok) {
    return {
      error: NextResponse.json({ error: auth.error }, { status: auth.status }),
    };
  }
  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.userId,
    auth.restaurantId
  );
  const activeBranchId = branchScope?.activeBranchId ?? null;
  const activeBranchName =
    branchScope?.branches.find((b) => b.id === activeBranchId)?.name ?? null;
  const canViewHistorical = await userIsOwnerOrAdmin(
    auth.userId,
    auth.restaurantId
  );
  return {
    restaurantId: auth.restaurantId,
    activeBranchId,
    activeBranchName,
    orderBranchFilter: orderBranchWhere(activeBranchId),
    canViewHistorical,
  };
}

export async function GET(_req: NextRequest) {
  try {
    const auth = await resolveRestaurantId(_req);
    if ('error' in auth) return auth.error;

    const {
      restaurantId,
      activeBranchId,
      activeBranchName,
      orderBranchFilter,
      canViewHistorical,
    } = auth;
    const branchId = orderBranchFilter.branchId ?? null;
    const planFeatures = await getRestaurantPlanFeatures(restaurantId);
    const url = new URL(_req.url);
    const rawDays = Number(url.searchParams.get('days') ?? 7);
    const requestedDays = rawDays === 14 || rawDays === 30 ? rawDays : 7;
    const days = enforceAnalyticsDays(
      requestedDays,
      canViewHistorical,
      planFeatures.advancedAnalytics
    );
    const filterTz = salesOrderFilterTimezone();
    const todayBounds = canViewHistorical
      ? null
      : await getTodayCreatedAtBounds(db, filterTz);
    const dayKeys =
      days === 1
        ? [await getTodayDayKeyInTimezone(db, filterTz)]
        : lastNCalendarDayKeys(days, filterTz);
    const from =
      todayBounds?.gte ??
      new Date(
        new Date(`${dayKeys[0]}T00:00:00.000Z`).getTime() - 36 * 60 * 60 * 1000
      );
    const activeOrderStatus = analyticsActiveOrderStatusWhere();
    const orderDateFilter = todayBounds
      ? { createdAt: { gte: todayBounds.gte, lt: todayBounds.lt } }
      : {};
    const orderScope = {
      restaurantId,
      ...orderBranchFilter,
      ...activeOrderStatus,
      ...orderDateFilter,
    };
    const windowWhere = {
      restaurantId,
      ...orderBranchFilter,
      ...(todayBounds
        ? { createdAt: { gte: todayBounds.gte, lt: todayBounds.lt } }
        : { createdAt: { gte: from } }),
    };

    const [
      branches,
      categories,
      menuItems,
      variations,
      tables,
      ordersTotal,
      posOrders,
      customers,
      recommendations,
      kdsOpen,
      orderDisplayQueue,
      employees,
      openTableTabs,
      ordersWindow,
    ] = await Promise.all([
      db.branch.count({ where: { restaurantId } }),
      db.menuCategory.count({ where: { restaurantId } }),
      db.menuItem.count({ where: { restaurantId } }),
      db.restaurantVariation.count({ where: { restaurantId } }),
      countDiningTables(restaurantId, branchId),
      db.order.count({ where: orderScope }),
      db.order.count({
        where: {
          ...orderScope,
          sourceType: OrderSourceType.POS,
        },
      }),
      db.customer.count({
        where: {
          restaurantId,
          ...(branchId ? { orders: { some: { branchId } } } : {}),
        },
      }),
      db.menuItemOffer.count({
        where: { baseItem: { restaurantId } },
      }),
      db.kitchenTicket.count({
        where: {
          restaurantId,
          status: { notIn: ['completed', 'canceled'] },
          ...(orderBranchFilter.branchId
            ? { order: { branchId: orderBranchFilter.branchId } }
            : {}),
        },
      }),
      db.kitchenTicket.count({
        where: {
          restaurantId,
          status: { notIn: ['completed', 'canceled'] },
          order: {
            ...orderBranchFilter,
            sourceType: { in: [OrderSourceType.POS, OrderSourceType.KIOSK] },
          },
        },
      }),
      db.employee.count({
        where: {
          restaurantId,
          ...(branchId ? { branches: { some: { branchId } } } : {}),
        },
      }),
      db.order.count({
        where: {
          restaurantId,
          ...orderBranchFilter,
          diningTableId: { not: null },
          NOT: {
            OR: [
              { status: { equals: 'canceled', mode: 'insensitive' } },
              { status: { equals: 'cancelled', mode: 'insensitive' } },
              { status: { equals: 'failed', mode: 'insensitive' } },
              { status: { equals: 'completed', mode: 'insensitive' } },
              { status: { equals: 'complete', mode: 'insensitive' } },
            ],
          },
        },
      }),
      db.order.findMany({
        where: windowWhere,
        select: {
          createdAt: true,
          total: true,
          sourceType: true,
          status: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true, amount: true, method: true },
          },
          items: {
            select: {
              quantity: true,
              price: true,
              productName: true,
              menuItemId: true,
              menuItem: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const byDay = new Map<
      string,
      {
        orders: number;
        revenue: number;
        onlineOrders: number;
        posOrders: number;
        kioskOrders: number;
        onlineRevenue: number;
        posRevenue: number;
        kioskRevenue: number;
      }
    >();
    for (const k of dayKeys) {
      byDay.set(k, {
        orders: 0,
        revenue: 0,
        onlineOrders: 0,
        posOrders: 0,
        kioskOrders: 0,
        onlineRevenue: 0,
        posRevenue: 0,
        kioskRevenue: 0,
      });
    }
    const channelTotals = {
      orders: { online: 0, pos: 0, kiosk: 0 },
      revenue: { online: 0, pos: 0, kiosk: 0 },
    };
    const hourlyOrders = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label:
        hour === 0
          ? '12a'
          : hour < 12
            ? `${hour}a`
            : hour === 12
              ? '12p'
              : `${hour - 12}p`,
      orders: 0,
    }));
    const itemAgg = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    const paymentMix = { cash: 0, card: 0, other: 0 };
    let canceledOrders = 0;
    let revenueOrders = 0;

    for (const row of ordersWindow) {
      if (isCanceledOrderStatus(row.status)) {
        canceledOrders += 1;
        continue;
      }

      const k =
        days === 1
          ? dayKeys[0]
          : calendarDayKeyInTimezone(new Date(row.createdAt), filterTz);
      const bucket = byDay.get(k);
      const latestPayment = row.payments[0];
      const revenueEligible = orderCountsTowardRevenue({
        orderStatus: row.status,
        paymentStatus: latestPayment?.status ?? null,
      });
      const total = revenueEligible
        ? Number(latestPayment?.amount ?? row.total) || 0
        : 0;

      hourlyOrders[hourInTimezone(new Date(row.createdAt), filterTz)].orders +=
        1;

      if (!bucket) continue;

      bucket.orders += 1;
      if (revenueEligible) {
        bucket.revenue += total;
        revenueOrders += 1;
        const method = normalizePaymentMethod(latestPayment?.method);
        paymentMix[method] += total;

        for (const item of row.items) {
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) continue;
          const name =
            item.productName?.trim() ||
            item.menuItem?.name?.trim() ||
            'Item';
          const key = item.menuItemId || name.toLowerCase();
          const line = qty * (Number(item.price) || 0);
          const prev = itemAgg.get(key) ?? {
            name,
            quantity: 0,
            revenue: 0,
          };
          prev.quantity += qty;
          prev.revenue += line;
          itemAgg.set(key, prev);
        }
      }

      if (row.sourceType === 'ONLINE') {
        bucket.onlineOrders += 1;
        if (revenueEligible) {
          bucket.onlineRevenue += total;
          channelTotals.revenue.online += total;
        }
        channelTotals.orders.online += 1;
      } else if (row.sourceType === 'KIOSK') {
        bucket.kioskOrders += 1;
        if (revenueEligible) {
          bucket.kioskRevenue += total;
          channelTotals.revenue.kiosk += total;
        }
        channelTotals.orders.kiosk += 1;
      } else {
        bucket.posOrders += 1;
        if (revenueEligible) {
          bucket.posRevenue += total;
          channelTotals.revenue.pos += total;
        }
        channelTotals.orders.pos += 1;
      }
    }

    const series = dayKeys.map((day) => {
      const b = byDay.get(day)!;
      return {
        day,
        orders: b.orders,
        revenue: b.revenue,
        onlineOrders: b.onlineOrders,
        posOrders: b.posOrders,
        kioskOrders: b.kioskOrders,
        onlineRevenue: b.onlineRevenue,
        posRevenue: b.posRevenue,
        kioskRevenue: b.kioskRevenue,
      };
    });

    const topItems = [...itemAgg.values()]
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        quantity: item.quantity,
        revenue: Math.round(item.revenue * 100) / 100,
      }));

    const peakHour = hourlyOrders.reduce(
      (best, row) => (row.orders > best.orders ? row : best),
      hourlyOrders[0]
    );

    const ops = {
      kdsOpen,
      openTableTabs,
      orderDisplayQueue,
      canceledOrders,
      revenueOrders,
      peakHour: peakHour.orders > 0 ? peakHour.hour : null,
      peakHourLabel: peakHour.orders > 0 ? peakHour.label : null,
      peakHourOrders: peakHour.orders,
    };

    const analyticsTier = planFeatures.advancedAnalytics
      ? ('advanced' as const)
      : ('basic' as const);

    return NextResponse.json({
      counts: {
        branches,
        categories,
        menuItems,
        variations,
        tables,
        orders: ordersTotal,
        posOrders,
        customers,
        recommendations: planFeatures.advancedAnalytics ? recommendations : 0,
        kdsOpen,
        orderDisplayQueue,
        employees,
        openTableTabs,
      },
      series,
      channelTotals,
      hourlyOrders,
      topItems,
      paymentMix,
      ops,
      days,
      analyticsTier,
      activeBranchId,
      activeBranchName,
      branchScoped: Boolean(branchId),
      canViewHistorical,
      dataScope: canViewHistorical ? ('all' as const) : ('today' as const),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load dashboard analytics' },
      { status: 500 }
    );
  }
}
