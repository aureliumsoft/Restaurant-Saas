import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
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

    const pendingCashWhere = {
      restaurantId: auth.restaurantId,
      ...orderBranchWhere(branchId),
      sourceType: OrderSourceType.KIOSK,
      status: { notIn: ['canceled', 'cancelled', 'failed'] },
      payments: {
        some: {
          status: 'pending',
          method: { equals: 'Cash', mode: 'insensitive' },
        },
      },
    };

    const countOnly =
      req.nextUrl.searchParams.get('count') === '1' ||
      req.nextUrl.searchParams.get('count') === 'true';

    if (countOnly) {
      const count = await db.order.count({ where: pendingCashWhere });
      return NextResponse.json({ count });
    }

    const orders = await db.order.findMany({
      where: pendingCashWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        shortOrderId: true,
        ticketNumber: true,
        total: true,
        status: true,
        tableLabel: true,
        createdAt: true,
        customer: { select: { name: true } },
        items: { select: { quantity: true } },
        payments: {
          where: {
            status: 'pending',
            method: { equals: 'Cash', mode: 'insensitive' },
          },
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
      tableLabel: order.tableLabel,
      createdAt: order.createdAt.toISOString(),
      customerName: order.customer?.name ?? null,
      paymentMethod: order.payments[0]?.method ?? 'Cash',
      paymentAmount:
        order.payments[0]?.amount ?? (Number(order.total) || 0),
      paymentStatus: order.payments[0]?.status ?? 'pending',
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('kiosk-order pending-cash GET', error);
    return NextResponse.json(
      { error: 'Failed to load kiosk orders' },
      { status: 500 }
    );
  }
}
