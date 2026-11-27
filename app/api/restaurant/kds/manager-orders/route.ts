import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  orderBranchWhere,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { isPendingPaymentStatus } from '@/lib/sales-order-status';

export async function GET(_req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(_req, {
      moduleKey: 'kds',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const branchScope = await getBranchScopeFromRequest(
      _req,
      auth.userId,
      auth.restaurantId
    );
    const orderBranchFilter = orderBranchWhere(branchScope?.activeBranchId ?? null);

    const pending = await db.order.findMany({
      where: {
        restaurantId: auth.restaurantId,
        ...orderBranchFilter,
        status: { in: ['pending', 'pedding'] },
        // POS sends straight to kitchen after checkout; not queued here.
        sourceType: { not: OrderSourceType.POS },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        ticketNumber: true,
        shortOrderId: true,
        status: true,
        total: true,
        sourceType: true,
        tableLabel: true,
        cutleryRequested: true,
        customerComment: true,
        orderScheduleMode: true,
        orderScheduleSlot: true,
        orderScheduleAt: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
        items: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            quantity: true,
            productName: true,
            menuItem: { select: { name: true } },
            modifiers: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
              select: {
                name: true,
                quantity: true,
                menuItemId: true,
                groupName: true,
                sortOrder: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, method: true, amount: true },
        },
      },
    });

    const data = pending.flatMap((order) => {
      const latestPayment = order.payments[0] ?? null;
      const paymentMethod = latestPayment?.method ?? null;
      const paymentStatus = latestPayment?.status ?? null;
      // Cash kiosk orders wait at the POS. Prep time is chosen when cash is taken.
      const cashKiosk =
        order.sourceType === OrderSourceType.KIOSK &&
        String(paymentMethod ?? '').toLowerCase() === 'cash' &&
        isPendingPaymentStatus(paymentStatus);
      if (cashKiosk) return [];
      const { payments: _payments, ...rest } = order;
      return [
        {
          ...rest,
          paymentStatus,
          paymentMethod,
          paymentAmount: latestPayment?.amount ?? null,
        },
      ];
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (e) {
    console.error('kds manager-orders', e);
    return NextResponse.json(
      { error: 'Failed to load manager orders' },
      { status: 500 }
    );
  }
}
