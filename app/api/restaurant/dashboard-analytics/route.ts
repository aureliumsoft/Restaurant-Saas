import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
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
  return {
    restaurantId: auth.restaurantId,
    orderBranchFilter: orderBranchWhere(branchScope?.activeBranchId ?? null),
  };
}

export async function GET(_req: NextRequest) {
  try {
    const auth = await resolveRestaurantId(_req);
    if ('error' in auth) return auth.error;

    const { restaurantId, orderBranchFilter } = auth;
    const planFeatures = await getRestaurantPlanFeatures(restaurantId);
    const url = new URL(_req.url);
    const rawDays = Number(url.searchParams.get('days') ?? 7);
    const requestedDays = rawDays === 14 || rawDays === 30 ? rawDays : 7;
    const days = planFeatures.advancedAnalytics ? requestedDays : 7;
    const dayKeys = lastNDayKeys(days);
    const from = new Date(`${dayKeys[0]}T00:00:00.000Z`);

    const [
      branches,
      categories,
      menuItems,
      ordersTotal,
      posOrders,
      customers,
      recommendations,
      kdsOpen,
      employees,
      ordersWindow,
    ] = await Promise.all([
      db.branch.count({ where: { restaurantId } }),
      db.menuCategory.count({ where: { restaurantId } }),
      db.menuItem.count({ where: { restaurantId } }),
      db.order.count({
        where: {
          restaurantId,
          ...orderBranchFilter,
          OR: [
            { status: { equals: 'completed', mode: 'insensitive' } },
            { status: { equals: 'complete', mode: 'insensitive' } },
          ],
        },
      }),
      db.order.count({
        where: {
          restaurantId,
          ...orderBranchFilter,
          sourceType: 'POS',
          OR: [
            { status: { equals: 'completed', mode: 'insensitive' } },
            { status: { equals: 'complete', mode: 'insensitive' } },
          ],
        },
      }),
      db.customer.count({ where: { restaurantId } }),
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
      db.employee.count({ where: { restaurantId } }),
      db.order.findMany({
        where: {
          restaurantId,
          ...orderBranchFilter,
          createdAt: { gte: from },
          OR: [
            { status: { equals: 'completed', mode: 'insensitive' } },
            { status: { equals: 'complete', mode: 'insensitive' } },
          ],
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
      const k = utcDayKey(new Date(row.createdAt));
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
          orders: ordersTotal,
          posOrders,
          customers,
          recommendations: 0,
          kdsOpen,
          employees,
        },
        series,
        channelTotals: {
          orders: { online: 0, pos: 0, kiosk: 0 },
          revenue: { online: 0, pos: 0, kiosk: 0 },
        },
        days,
        analyticsTier: 'basic' as const,
      });
    }

    return NextResponse.json({
      counts: {
        branches,
        categories,
        menuItems,
        orders: ordersTotal,
        posOrders,
        customers,
        recommendations,
        kdsOpen,
        employees,
      },
      series,
      channelTotals,
      days,
      analyticsTier: 'advanced' as const,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load dashboard analytics' },
      { status: 500 }
    );
  }
}
