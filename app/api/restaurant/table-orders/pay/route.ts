import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getOrOpenPosShift } from '@/lib/pos-shift';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';

const paySchema = z.object({
  diningTableId: z.string().uuid(),
  paid: z.number().min(0),
  method: z.string().min(1).max(100).optional(),
});

/**
 * Complete payment for all pending table-linked orders on a dining table.
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

    const { diningTableId, paid, method } = parsed.data;
    const methodLabel = method?.trim() || 'Cash';

    const orders = await db.order.findMany({
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
    const activeShift = await getOrOpenPosShift({
      restaurantId: auth.restaurantId,
      branchId,
      userId: auth.userId,
    });

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
            posShiftId: activeShift.id,
            status: 'completed',
          },
        });
      }
    });

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId,
    });

    return NextResponse.json({
      data: {
        diningTableId,
        orderIds: orders.map((o) => o.id),
        totalDue,
        paid,
        change: Math.max(0, paid - totalDue),
        paymentStatus: 'completed',
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
