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
import { analyticsActiveOrderStatusWhere } from '@/lib/sales-order-status';
import {
  enforceAnalyticsDays,
  getTodayCreatedAtBounds,
  getTodayDayKeyInTimezone,
  salesOrderFilterTimezone,
} from '@/lib/sales-order-period';
import { getRestaurantPlanFeatures } from '@/lib/subscription-plan-enforcement';

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDayKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
    );
    keys.push(utcDayKey(d));
  }
  return keys;
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

    const { restaurantId, activeBranchId, activeBranchName, orderBranchFilter, canViewHistorical } =
      auth;
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
        : lastNDayKeys(days);
    const from =
      todayBounds?.gte ??
      new Date(`${dayKeys[0]}T00:00:00.000Z`);
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
        where: { baseItem: { restaurantId } } },
      ),
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
      db.order.findMany({
        where: {
          ...orderScope,
          ...(todayBounds ? {} : { createdAt: { gte: from } }),
        },
        select: { createdAt: true, total: true, sourceType: true },
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
    for (const row of ordersWindow) {
      const k =
        days === 1
          ? dayKeys[0]
          : utcDayKey(new Date(row.createdAt));
      const bucket = byDay.get(k);
      if (!bucket) continue;
      const total = Number(row.total) || 0;
      bucket.orders += 1;
      bucket.revenue += total;
      if (row.sourceType === 'ONLINE') {
        bucket.onlineOrders += 1;
        bucket.onlineRevenue += total;
        channelTotals.orders.online += 1;
        channelTotals.revenue.online += total;
      } else if (row.sourceType === 'KIOSK') {
        bucket.kioskOrders += 1;
        bucket.kioskRevenue += total;
        channelTotals.orders.kiosk += 1;
        channelTotals.revenue.kiosk += total;
      } else {
        // Treat POS and other in-store sources as POS channel for analytics.
        bucket.posOrders += 1;
        bucket.posRevenue += total;
        channelTotals.orders.pos += 1;
        channelTotals.revenue.pos += total;
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

    if (!planFeatures.advancedAnalytics) {
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
          recommendations: 0,
          kdsOpen,
          orderDisplayQueue,
          employees,
        },
        series,
        channelTotals,
        days,
        analyticsTier: 'basic' as const,
        activeBranchId,
        activeBranchName,
        branchScoped: Boolean(branchId),
        canViewHistorical,
        dataScope: canViewHistorical ? ('all' as const) : ('today' as const),
      });
    }

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
        recommendations,
        kdsOpen,
        orderDisplayQueue,
        employees,
      },
      series,
      channelTotals,
      days,
      analyticsTier: 'advanced' as const,
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
