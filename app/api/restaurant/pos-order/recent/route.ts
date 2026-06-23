import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import {
  getTodayCreatedAtBounds,
  salesOrderFilterTimezone,
} from '@/lib/sales-order-period';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      auth.restaurantId
    );
    const branchIdFromQuery = req.nextUrl.searchParams.get('branchId')?.trim();
    let branchId = branchScope?.activeBranchId ?? null;
    if (branchIdFromQuery) {
      const valid = await validateBranchForRestaurant(
        branchIdFromQuery,
        auth.restaurantId
      );
      if (!valid) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      if (
        branchScope &&
        !branchScope.allowedBranchIds.includes(branchIdFromQuery)
      ) {
        return NextResponse.json(
          { error: 'You do not have access to this branch.' },
          { status: 403 }
        );
      }
      branchId = branchIdFromQuery;
    }

    const tz = salesOrderFilterTimezone();
    const todayBounds = await getTodayCreatedAtBounds(db, tz);

    const orders = await db.order.findMany({
      where: {
        restaurantId: auth.restaurantId,
        ...orderBranchWhere(branchId),
        createdAt: todayBounds,
        status: { notIn: ['failed'] },
        OR: [
          { sourceType: OrderSourceType.POS },
          {
            sourceType: OrderSourceType.KIOSK,
            OR: [
              { posShiftId: { not: null } },
              { status: { in: ['canceled', 'cancelled'] } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        shortOrderId: true,
        ticketNumber: true,
        total: true,
        status: true,
        sourceType: true,
        createdAt: true,
        customer: { select: { name: true } },
        items: { select: { quantity: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { method: true, amount: true, status: true },
        },
      },
    });

    const data = orders.map((order) => ({
      id: order.id,
      shortOrderId: order.shortOrderId,
      ticketNumber: order.ticketNumber,
      total: Number(order.total) || 0,
      status: order.status,
      sourceType: order.sourceType,
      createdAt: order.createdAt.toISOString(),
      customerName: order.customer?.name ?? null,
      paymentMethod: order.payments[0]?.method ?? null,
      paymentAmount: order.payments[0]?.amount ?? null,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('pos-order recent GET', error);
    return NextResponse.json(
      { error: 'Failed to load recent POS orders' },
      { status: 500 }
    );
  }
}
