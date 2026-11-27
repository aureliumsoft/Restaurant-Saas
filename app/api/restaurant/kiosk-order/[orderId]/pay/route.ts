import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';
import { buildKitchenTicketItemRows } from '@/lib/kitchen-ticket-items';
import { getOpenPosShift } from '@/lib/pos-shift';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const MIN_PREP_MINUTES = 1;
const MAX_PREP_MINUTES = 240;

const paySchema = z.object({
  paid: z.number().min(0),
  /** Set on the POS when cash is taken, so the order skips the KDS time queue. */
  selectedMinutes: z.number().int().min(MIN_PREP_MINUTES).max(MAX_PREP_MINUTES).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
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
      select: {
        id: true,
        total: true,
        status: true,
        branchId: true,
        items: {
          select: {
            quantity: true,
            productName: true,
            menuItem: { select: { name: true } },
            modifiers: {
              select: {
                name: true,
                quantity: true,
                menuItemId: true,
                groupName: true,
              },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        payments: {
          where: {
            status: 'pending',
            method: { equals: 'Cash', mode: 'insensitive' },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, amount: true, status: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const status = String(order.status ?? '').toLowerCase();
    if (status === 'canceled' || status === 'cancelled') {
      return NextResponse.json(
        { error: 'Order is already canceled.' },
        { status: 409 }
      );
    }

    const payment = order.payments[0];
    if (!payment) {
      return NextResponse.json(
        { error: 'No pending cash payment found for this order.' },
        { status: 409 }
      );
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

    const orderTotal = Number(order.total) || 0;
    const paid = parsed.data.paid;
    const selectedMinutes = parsed.data.selectedMinutes;
    if (paid + 0.001 < orderTotal) {
      return NextResponse.json(
        { error: 'Paid amount is less than order total.' },
        { status: 400 }
      );
    }

    const openShift = await getOpenPosShift({
      restaurantId: auth.restaurantId,
      branchId: order.branchId,
    });
    if (!openShift) {
      return NextResponse.json(
        { error: 'Start a new shift before recording payments.' },
        { status: 409 }
      );
    }

    const itemRows = buildKitchenTicketItemRows(
      order.items.map((line) => ({
        quantity: line.quantity,
        productName: line.productName,
        menuItem: line.menuItem,
        modifiers: line.modifiers,
      }))
    );

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          amount: orderTotal,
          method: 'Cash',
        },
      });

      if (selectedMinutes == null) {
        await tx.order.update({
          where: { id: order.id },
          data: { posShiftId: openShift.id },
        });
        return;
      }

      await tx.order.update({
        where: { id: order.id },
        data: { posShiftId: openShift.id, status: 'making' },
      });

      const existing = await tx.kitchenTicket.findFirst({
        where: {
          orderId: order.id,
          status: { in: ['pending', 'making', 'Pending', 'Making'] },
        },
        select: { id: true, status: true },
      });

      const ticketId = existing
        ? existing.id
        : (
            await tx.kitchenTicket.create({
              data: {
                restaurantId: auth.restaurantId,
                orderId: order.id,
                status: 'making',
                selectedMinutes,
                startedAt: new Date(),
              },
              select: { id: true },
            })
          ).id;

      if (existing) {
        await tx.kitchenTicket.update({
          where: { id: existing.id },
          data: {
            status: 'making',
            selectedMinutes,
            startedAt: new Date(),
          },
        });
        await tx.kitchenTicketItem.deleteMany({
          where: { kitchenTicketId: existing.id },
        });
      }

      if (itemRows.length > 0) {
        await tx.kitchenTicketItem.createMany({
          data: itemRows.map((row, sortOrder) => ({
            kitchenTicketId: ticketId,
            productName: row.productName,
            quantity: row.quantity,
            sortOrder,
          })),
        });
      }
    });

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId: order.branchId,
    });

    return NextResponse.json({
      data: {
        orderId: order.id,
        paid,
        change: Math.max(0, paid - orderTotal),
        paymentStatus: 'completed',
      },
    });
  } catch (error) {
    console.error('kiosk-order pay POST', error);
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    );
  }
}
