import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';

const bodySchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(50),
  selectedMinutes: z.number().int().min(1).max(240).optional(),
});

function buildKitchenRows(
  lines: {
    quantity: number;
    menuItem: { name: string };
    modifiers: { name: string; quantity: number }[];
  }[]
): { productName: string; quantity: number }[] {
  const rows: { productName: string; quantity: number }[] = [];
  for (const line of lines) {
    rows.push({
      productName: line.menuItem.name,
      quantity: line.quantity,
    });
    for (const mod of line.modifiers) {
      const modName = String(mod.name || '').trim();
      if (!modName) continue;
      rows.push({
        productName: `+ ${modName}`,
        quantity: mod.quantity,
      });
    }
  }
  return rows;
}

/**
 * Create kitchen tickets for unsent open table orders (payment stays pending).
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
            menuItem: { select: { name: true } },
            modifiers: { select: { name: true, quantity: true } },
          },
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
      return NextResponse.json({ error: 'No matching table orders' }, { status: 404 });
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
