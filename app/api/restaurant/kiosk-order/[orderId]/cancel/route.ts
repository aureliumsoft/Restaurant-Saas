import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import { db } from '@/lib/db';
import { getOrOpenPosShift } from '@/lib/pos-shift';
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
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: auth.restaurantId,
        sourceType: OrderSourceType.KIOSK,
      },
      select: { id: true, status: true, branchId: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const status = String(order.status ?? '').toLowerCase();
    if (status === 'canceled' || status === 'cancelled' || status === 'failed') {
      return NextResponse.json(
        { error: `Order is already ${status}` },
        { status: 409 }
      );
    }

    const activeShift = await getOrOpenPosShift({
      restaurantId: auth.restaurantId,
      branchId: order.branchId,
      userId: auth.userId,
    });

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'canceled', posShiftId: activeShift.id },
      });
      await tx.kitchenTicket.updateMany({
        where: {
          orderId: order.id,
          status: { in: ['pending', 'making'] },
        },
        data: { status: 'canceled' },
      });
      await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: 'pending',
        },
        data: { status: 'cancelled' },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('kiosk-order cancel PATCH', error);
    return NextResponse.json(
      { error: 'Failed to cancel kiosk order' },
      { status: 500 }
    );
  }
}
