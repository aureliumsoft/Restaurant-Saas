import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { cancelOrderPayments } from '@/lib/order-payment';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';

const bodySchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  diningTableId: z.string().uuid().optional(),
});

/**
 * Cancel open table orders (pending payment). Cancels kitchen tickets too.
 * Either cancel specific orderIds or whole table open tab.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { orderIds, diningTableId } = parsed.data;
    if (!orderIds?.length && !diningTableId) {
      return NextResponse.json(
        { error: 'Provide orderIds or diningTableId' },
        { status: 400 }
      );
    }

    const orders = await db.order.findMany({
      where: {
        restaurantId: auth.restaurantId,
        diningTableId: diningTableId
          ? diningTableId
          : { not: null },
        ...(orderIds?.length ? { id: { in: orderIds } } : {}),
        status: {
          notIn: ['canceled', 'cancelled', 'failed', 'cancel'],
        },
        payments: {
          some: {
            status: { equals: 'pending', mode: 'insensitive' },
          },
        },
      },
      select: { id: true, branchId: true },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'No cancelable open table orders found.' },
        { status: 404 }
      );
    }

    await db.$transaction(async (tx) => {
      for (const order of orders) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'canceled' },
        });
        await cancelOrderPayments(tx, order.id);
        await tx.kitchenTicket.updateMany({
          where: {
            orderId: order.id,
            status: { in: ['pending', 'making'] },
          },
          data: { status: 'canceled' },
        });
      }
    });

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId: orders[0]?.branchId ?? null,
    });

    return NextResponse.json({
      data: { canceledOrderIds: orders.map((o) => o.id) },
    });
  } catch (e) {
    console.error('table-orders cancel POST', e);
    return NextResponse.json(
      { error: 'Failed to cancel table orders' },
      { status: 500 }
    );
  }
}
