import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import { db } from '@/lib/db';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { orderId: rawId } = await context.params;
    const orderId = rawId?.trim();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order id.' }, { status: 400 });
    }

    const slug = req.nextUrl.searchParams.get('restaurantSlug')?.trim();
    if (!slug) {
      return NextResponse.json(
        { error: 'restaurantSlug is required.' },
        { status: 400 }
      );
    }

    const restaurant = await resolveRestaurantIdBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
    }

    const session = await getCustomerAccountSession(req, {
      restaurantId: restaurant.id,
    });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await db.order.findFirst({
      where: {
        id: orderId,
        customerAccountId: session.accountId,
        restaurantId: restaurant.id,
      },
      select: {
        id: true,
        shortOrderId: true,
        status: true,
        total: true,
        taxAmount: true,
        discountAmount: true,
        serviceChargeAmount: true,
        address: true,
        cutleryRequested: true,
        customerComment: true,
        createdAt: true,
        orderScheduleMode: true,
        orderScheduleSlot: true,
        orderScheduleAt: true,
        branch: {
          select: { id: true, name: true, address: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            method: true,
            amount: true,
            createdAt: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            productName: true,
            menuItem: { select: { id: true, name: true, imageUrl: true } },
            modifiers: {
              select: {
                id: true,
                name: true,
                unitPrice: true,
                quantity: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const fulfillment =
      typeof order.address === 'string' &&
      order.address.includes('Fulfillment: Delivery')
        ? 'delivery'
        : 'pickUp';

    return NextResponse.json({
      data: {
        restaurant: {
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        },
        order: {
          id: order.id,
          shortOrderId: order.shortOrderId,
          status: order.status,
          total: order.total,
          taxAmount: order.taxAmount,
          discountAmount: order.discountAmount,
          serviceChargeAmount: order.serviceChargeAmount,
          addressSnapshot: order.address,
          cutleryRequested: order.cutleryRequested,
          customerComment: order.customerComment,
          createdAt: order.createdAt.toISOString(),
          fulfillment,
          scheduleMode: order.orderScheduleMode,
          scheduleSlot: order.orderScheduleSlot,
          scheduleAt: order.orderScheduleAt?.toISOString() ?? null,
          branch: order.branch,
          payments: order.payments.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
          })),
          items: order.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            unitPrice: item.price,
            name: orderItemDisplayName(item),
            imageUrl: item.menuItem?.imageUrl ?? null,
            modifiers: item.modifiers,
          })),
        },
      },
    });
  } catch (error) {
    console.error('customer me order detail', error);
    return NextResponse.json(
      { error: 'Could not load order.' },
      { status: 500 }
    );
  }
}
