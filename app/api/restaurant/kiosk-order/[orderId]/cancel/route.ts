import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import { db } from '@/lib/db';
import { cancelOrderPayments } from '@/lib/order-payment';
import { getOpenPosShift } from '@/lib/pos-shift';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import { resolveRouteParams } from '@/lib/resolve-route-id';

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

    const { orderId } = await resolveRouteParams(ctx.params, ['orderId']);
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

    const openShift = await getOpenPosShift({
      restaurantId: auth.restaurantId,
      branchId: order.branchId,
    });
    if (!openShift) {
      return NextResponse.json(
        { error: 'Start a new shift before canceling kiosk orders.' },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'canceled', posShiftId: openShift.id },
      });
      await tx.kitchenTicket.updateMany({
        where: {
          orderId: order.id,
          status: { in: ['pending', 'making'] },
        },
        data: { status: 'canceled' },
      });
      await cancelOrderPayments(tx, order.id);
    });

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId: order.branchId,
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
