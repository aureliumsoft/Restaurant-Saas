import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { buildKitchenTicketItemRows } from '@/lib/kitchen-ticket-items';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import { isDineInPayBeforeKitchen } from '@/lib/restaurant-dine-in-payment';

const bodySchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(50),
  selectedMinutes: z.number().int().min(1).max(240).optional(),
});

function buildKitchenRows(
  lines: {
    quantity: number;
    productName?: string | null;
    menuItem: { name: string } | null;
    modifiers: { name: string; quantity: number; menuItemId?: string | null }[];
  }[]
): { productName: string; quantity: number }[] {
  return buildKitchenTicketItemRows(
    lines.map((line) => ({
      quantity: line.quantity,
      productName: line.productName,
      menuItem: line.menuItem,
      modifiers: line.modifiers,
    }))
  );
}

/**
 * Create kitchen tickets for open table orders (paid or unpaid).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKeys: ['pos', 'kds'],
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

    const selectedMinutes = parsed.data.selectedMinutes ?? 15;
    const orderIds = [...new Set(parsed.data.orderIds)];

    const restaurant = await db.restaurant.findUnique({
      where: { id: auth.restaurantId },
      select: { dineInPaymentTiming: true },
    });
    const requirePaidBeforeKitchen = isDineInPayBeforeKitchen(
      restaurant?.dineInPaymentTiming
    );

    const orders = await db.order.findMany({
      where: {
        id: { in: orderIds },
        restaurantId: auth.restaurantId,
        diningTableId: { not: null },
        status: {
          notIn: ['canceled', 'cancelled', 'failed', 'cancel'],
        },
      },
      select: {
        id: true,
        branchId: true,
        items: {
          select: {
            quantity: true,
            productName: true,
            menuItem: { select: { name: true } },
            modifiers: { select: { name: true, quantity: true, menuItemId: true } },
          },
        },
        kitchenTickets: {
          where: {
            status: { notIn: ['canceled', 'cancelled'] },
          },
          select: { id: true },
          take: 1,
        },
        payments: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No matching table orders' }, { status: 404 });
    }

    if (requirePaidBeforeKitchen) {
      const unpaid = orders.filter(
        (o) => !o.payments.some((p) => p.status === 'completed')
      );
      if (unpaid.length > 0) {
        return NextResponse.json(
          {
            error:
              'This restaurant requires payment before sending table orders to the kitchen.',
            unpaidOrderIds: unpaid.map((o) => o.id),
          },
          { status: 400 }
        );
      }
    }

    const created: string[] = [];
    const skipped: string[] = [];

    await db.$transaction(async (tx) => {
      for (const order of orders) {
        if (order.kitchenTickets.length > 0) {
          skipped.push(order.id);
          continue;
        }
        const rows = buildKitchenRows(order.items);
        if (rows.length === 0) {
          skipped.push(order.id);
          continue;
        }
        const ticket = await tx.kitchenTicket.create({
          data: {
            restaurantId: auth.restaurantId,
            orderId: order.id,
            status: 'making',
            selectedMinutes,
            startedAt: new Date(),
          },
        });
        await tx.kitchenTicketItem.createMany({
          data: rows.map((r) => ({
            kitchenTicketId: ticket.id,
            productName: r.productName,
            quantity: r.quantity,
          })),
        });
        created.push(order.id);
      }
    });

    const branchId = orders[0]?.branchId ?? null;
    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId,
      exclude: [
        'kiosk.pending_cash',
        'dashboard.analytics',
        'pos.recent_orders',
        'sales.orders',
        'inventory.stock',
      ],
    });

    return NextResponse.json({
      data: {
        sentOrderIds: created,
        skippedOrderIds: skipped,
        selectedMinutes,
      },
    });
  } catch (e) {
    console.error('table-orders send-kitchen POST', e);
    return NextResponse.json(
      { error: 'Failed to send orders to kitchen' },
      { status: 500 }
    );
  }
}
