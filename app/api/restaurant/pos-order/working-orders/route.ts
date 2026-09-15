import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import {
  getBranchScopeFromRequest,
  orderBranchWhere,
} from '@/lib/branch/branch-scope';

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
    const orderBranchFilter = orderBranchWhere(
      branchScope?.activeBranchId ?? null
    );

    const workingOrders = await db.order.findMany({
      where: {
        restaurantId: auth.restaurantId,
        ...orderBranchFilter,
        status: {
          in: ['pending', 'pedding', 'making', 'in_progress', 'preparing', 'confirmed'],
        },
        NOT: [
          // Pending cash kiosk orders stay in the Kiosk Orders sheet until paid
          {
            sourceType: OrderSourceType.KIOSK,
            payments: {
              some: {
                status: 'pending',
                method: { equals: 'Cash', mode: 'insensitive' },
              },
            },
          },
        ],
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
        address: true,
        cutleryRequested: true,
        customerComment: true,
        orderScheduleMode: true,
        orderScheduleSlot: true,
        orderScheduleAt: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            productName: true,
            menuItem: { select: { name: true } },
            modifiers: {
              select: { name: true, quantity: true, unitPrice: true },
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

    const data = workingOrders.map((order) => {
      const latestPayment = order.payments[0] ?? null;
      const { payments: _payments, ...rest } = order;
      return {
        ...rest,
        paymentStatus: latestPayment?.status ?? null,
        paymentMethod: latestPayment?.method ?? null,
        paymentAmount: latestPayment?.amount ?? null,
      };
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (e) {
    console.error('pos working-orders GET', e);
    return NextResponse.json(
      { error: 'Failed to load working orders' },
      { status: 500 }
    );
  }
}
