import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import { db } from '@/lib/db';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')?.trim();
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: {
      OR: [{ id: orderId }, { shortOrderId: orderId.toUpperCase() }],
      sourceType: OrderSourceType.KIOSK,
    },
    select: {
      id: true,
      shortOrderId: true,
      ticketNumber: true,
      status: true,
      total: true,
      address: true,
      tableLabel: true,
      diningTable: { select: { name: true } },
      createdAt: true,
      updatedAt: true,
      customer: {
        select: { id: true, name: true, phone: true, email: true },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, status: true, method: true, createdAt: true },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          productName: true,
          menuItem: { select: { name: true } },
          modifiers: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: order.id,
      shortOrderId: order.shortOrderId,
      ticketNumber: order.ticketNumber,
      status: order.status,
      total: order.total,
      address: order.address,
      tableLabel: order.tableLabel,
      tableName: order.diningTable?.name ?? order.tableLabel,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      customer: order.customer,
      payment: order.payments[0]
        ? {
            ...order.payments[0],
            createdAt: order.payments[0].createdAt.toISOString(),
          }
        : null,
      items: order.items.map((it) => ({
        id: it.id,
        quantity: it.quantity,
        price: it.price,
        name: orderItemDisplayName(it),
        modifiers: it.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          quantity: m.quantity,
          unitPrice: m.unitPrice,
        })),
      })),
    },
  });
}
