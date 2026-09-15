import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import { resolveRouteId, resolveRouteParams } from '@/lib/resolve-route-id';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { orderId: orderIdParam } = await resolveRouteParams(params, [
      'orderId',
    ]);
    const orderId = resolveRouteId(orderIdParam);
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: auth.restaurantId },
      select: { id: true, status: true, branchId: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const currentStatus = String(order.status ?? '').toLowerCase();
    if (currentStatus === 'completed' || currentStatus === 'delivered') {
      return NextResponse.json(
        { error: 'Order is already completed.' },
        { status: 409 }
      );
    }
    if (currentStatus === 'canceled' || currentStatus === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot complete a canceled order.' },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'completed' },
      });

      await tx.kitchenTicket.updateMany({
        where: {
          orderId: order.id,
          status: { in: ['pending', 'making'] },
        },
        data: { status: 'completed' },
      });
    });

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId: order.branchId,
    });

    return NextResponse.json(
      { ok: true, status: 'completed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('pos-order complete POST', error);
    return NextResponse.json(
      { error: 'Failed to complete order' },
      { status: 500 }
    );
  }
}
