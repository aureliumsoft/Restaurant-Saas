import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import { resolveRouteId, resolveRouteParams } from '@/lib/resolve-route-id';
import { isCompletedOrderStatus } from '@/lib/sales-order-status';

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

    if (!isCompletedOrderStatus(order.status)) {
      return NextResponse.json(
        { error: 'Only completed orders can be marked as delivered.' },
        { status: 409 }
      );
    }

    await db.order.update({
      where: { id: order.id },
      data: { status: 'delivered' },
    });

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId: order.branchId,
    });

    return NextResponse.json({ ok: true, status: 'delivered' }, { status: 200 });
  } catch (error) {
    console.error('pos-order deliver POST', error);
    return NextResponse.json(
      { error: 'Failed to mark order as delivered' },
      { status: 500 }
    );
  }
}
