import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getOpenPosShift } from '@/lib/pos-shift';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';

const paySchema = z.object({
  diningTableId: z.string().uuid(),
  paid: z.number().min(0),
  method: z.string().min(1).max(100).optional(),
  /** Explicit unpaid ticket ids from the POS dialog — prevents under/over settle races. */
  orderIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

/**
 * Complete payment for pending table-linked orders on a dining table.
 * Ends the open check; a new place on that table starts a new card.
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

    const parsed = paySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { diningTableId, paid, method, orderIds } = parsed.data;
    const methodLabel = method?.trim() || 'Cash';
    const requestedIds = orderIds ? [...new Set(orderIds)] : null;

    const orders = await db.order.findMany({
      where: {
        restaurantId: auth.restaurantId,
        diningTableId,
        status: {
          notIn: ['canceled', 'cancelled', 'failed', 'cancel'],
        },
        ...(requestedIds ? { id: { in: requestedIds } } : {}),
        payments: {
          some: {
            status: { equals: 'pending', mode: 'insensitive' },
          },
        },
      },
      select: {
        id: true,
        total: true,
        branchId: true,
        shortOrderId: true,
        ticketNumber: true,
        payments: {
          where: {
            status: { equals: 'pending', mode: 'insensitive' },
          },
          select: { id: true },
        },
        kitchenTickets: {
          where: {
            status: { notIn: ['canceled', 'cancelled'] },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'No open unpaid orders for this table.' },
        { status: 404 }
      );
    }

    if (requestedIds && orders.length !== requestedIds.length) {
      return NextResponse.json(
        {
          error:
            'Some selected tickets are no longer unpaid. Refresh Table orders and try again.',
          foundOrderIds: orders.map((o) => o.id),
        },
        { status: 409 }
      );
    }

    const notInKitchen = orders.filter((o) => o.kitchenTickets.length === 0);
    if (notInKitchen.length > 0) {
      const labels = notInKitchen
        .map((o) =>
          o.ticketNumber != null
            ? `#${String(o.ticketNumber).padStart(2, '0')}`
            : o.shortOrderId
        )
        .join(', ');
      return NextResponse.json(
        {
          error: `Send all tickets to kitchen before payment. Still held: ${labels}`,
          heldOrderIds: notInKitchen.map((o) => o.id),
        },
        { status: 400 }
      );
    }

    const totalDue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    if (paid + 0.001 < totalDue) {
      return NextResponse.json(
        { error: 'Paid amount is less than the table total.' },
        { status: 400 }
      );
    }

    const branchId = orders[0]?.branchId ?? null;
    const openShift = await getOpenPosShift({
      restaurantId: auth.restaurantId,
      branchId,
    });
    if (!openShift) {
      return NextResponse.json(
        { error: 'Start a new shift before recording table payments.' },
        { status: 409 }
      );
    }

    await db.$transaction(async (tx) => {
      for (const order of orders) {
        const orderTotal = Number(order.total) || 0;
        for (const payment of order.payments) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'completed',
              amount: orderTotal,
              method: methodLabel,
            },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: {
            posShiftId: openShift.id,
            status: 'completed',
          },
        });
      }
    });

    const remainingUnpaid = await db.order.count({
      where: {
        restaurantId: auth.restaurantId,
        diningTableId,
        status: {
          notIn: ['canceled', 'cancelled', 'failed', 'cancel'],
        },
        payments: {
          some: {
            status: { equals: 'pending', mode: 'insensitive' },
          },
        },
      },
    });

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId,
      exclude: ['kiosk.pending_cash', 'dashboard.analytics'],
    });

    return NextResponse.json({
      data: {
        diningTableId,
        orderIds: orders.map((o) => o.id),
        ticketCount: orders.length,
        totalDue,
        paid,
        change: Math.max(0, paid - totalDue),
        paymentStatus: 'completed',
        remainingUnpaidCount: remainingUnpaid,
        tableCleared: remainingUnpaid === 0,
      },
    });
  } catch (e) {
    console.error('table-orders pay POST', e);
    return NextResponse.json(
      { error: 'Failed to complete table payment' },
      { status: 500 }
    );
  }
}
