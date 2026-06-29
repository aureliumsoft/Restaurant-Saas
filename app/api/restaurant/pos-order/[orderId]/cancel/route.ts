import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import { db } from '@/lib/db';
import { cancelOrderPayments } from '@/lib/order-payment';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export async function PATCH(
  _req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(_req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { orderId } = await ctx.params;
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }

    const order = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: auth.restaurantId,
        sourceType: OrderSourceType.POS,
      },
      select: {
        id: true,
        status: true,
        kitchenTickets: {
          where: { status: { equals: 'making', mode: 'insensitive' } },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const status = String(order.status ?? '').toLowerCase();
    if (status === 'completed' || status === 'canceled' || status === 'cancelled') {
      return NextResponse.json(
        { error: `Order is already ${status}` },
        { status: 409 }
      );
    }

    if (order.kitchenTickets.length > 0) {
      return NextResponse.json(
        { error: 'Order is already on the kitchen display and cannot be canceled here.' },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
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
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('pos order cancel', e);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }
}
