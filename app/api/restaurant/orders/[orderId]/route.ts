import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const auth = await getRestaurantIdForRequest(_req, {
      moduleKey: 'sales',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const order = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: auth.restaurantId,
      },
      select: {
        id: true,
        shortOrderId: true,
        total: true,
        status: true,
        sourceType: true,
        address: true,
        cutleryRequested: true,
        customerComment: true,
        tableLabel: true,
        taxAmount: true,
        discountAmount: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            menuItemId: true,
            productName: true,
            menuItem: { select: { id: true, name: true } },
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
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        menuItem: {
          id: item.menuItem?.id ?? item.menuItemId ?? '',
          name: orderItemDisplayName(item),
        },
        modifiers: item.modifiers,
      })),
      payments: order.payments.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load order' },
      { status: 500 }
    );
  }
}
