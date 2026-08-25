import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')?.trim();
  const restaurantSlug = req.nextUrl.searchParams.get('restaurantSlug')?.trim();
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const baseSelect = {
    id: true,
    shortOrderId: true,
    ticketNumber: true,
    status: true,
    total: true,
    address: true,
    createdAt: true,
    updatedAt: true,
    customer: {
      select: { id: true, name: true, phone: true, email: true },
    },
    payments: {
      orderBy: { createdAt: 'desc' as const },
      select: { id: true, amount: true, status: true, method: true, createdAt: true },
    },
    kitchenTickets: {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      select: { status: true },
    },
    branch: {
      select: { name: true, address: true },
    },
    items: {
      select: {
        id: true,
        quantity: true,
        price: true,
        productName: true,
        menuItem: { select: { name: true } },
      },
    },
  };

  const order = await db.order.findFirst({
    where: restaurantSlug
      ? {
          OR: [{ id: orderId }, { shortOrderId: orderId.toUpperCase() }],
          restaurant: { slug: restaurantSlug },
        }
      : { OR: [{ id: orderId }, { shortOrderId: orderId.toUpperCase() }] },
    select: baseSelect,
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const fulfillment =
    typeof order.address === 'string' &&
    order.address.includes('Fulfillment: Delivery')
      ? 'delivery'
      : 'pickUp';

  return NextResponse.json({
    data: {
      id: order.id,
      shortOrderId: order.shortOrderId,
      ticketNumber: order.ticketNumber,
      status: order.status,
      kitchenStatus: order.kitchenTickets[0]?.status ?? order.status,
      fulfillment,
      total: order.total,
      address: order.address,
      branchName: order.branch?.name ?? null,
      branchAddress: order.branch?.address ?? null,
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
      })),
    },
  });
}
