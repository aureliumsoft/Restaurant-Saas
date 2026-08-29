import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { resolveRouteParams } from '@/lib/resolve-route-id';

type UpdateStatus = 'completed' | 'failed' | 'cancelled' | 'pending';

function normalizeStatus(value: unknown): UpdateStatus | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'completed' || v === 'failed' || v === 'cancelled' || v === 'pending') {
    return v;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { orderId } = await resolveRouteParams(context.params, ['orderId']);
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const status = normalizeStatus(body?.status);
    if (!status) {
      return NextResponse.json(
        { error: 'Invalid status. Use completed, failed, cancelled, or pending.' },
        { status: 400 }
      );
    }

    const amountNum = Number(body?.amount);
    const amount = Number.isFinite(amountNum) && amountNum >= 0 ? amountNum : undefined;
    const terminalTransactionId =
      typeof body?.terminalTransactionId === 'string'
        ? body.terminalTransactionId.trim()
        : '';

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: auth.restaurantId },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const latestPayment = await db.payment.findFirst({
      where: { orderId: order.id, restaurantId: auth.restaurantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const method =
      terminalTransactionId.length > 0
        ? `Card Terminal (${terminalTransactionId})`
        : 'Card Terminal';

    if (latestPayment) {
      await db.payment.update({
        where: { id: latestPayment.id },
        data: {
          status,
          method,
          ...(amount !== undefined ? { amount } : {}),
        },
      });
    } else {
      await db.payment.create({
        data: {
          orderId: order.id,
          restaurantId: auth.restaurantId,
          amount: amount ?? 0,
          status,
          method,
        },
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to update terminal payment status' },
      { status: 500 }
    );
  }
}
