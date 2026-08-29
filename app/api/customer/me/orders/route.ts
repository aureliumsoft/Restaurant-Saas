import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import { db } from '@/lib/db';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';
import { encodeUrlId } from '@/lib/url-id';

export async function GET(req: NextRequest) {
  try {
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

    const cursor = req.nextUrl.searchParams.get('cursor')?.trim() || null;
    const take = Math.min(
      50,
      Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 20) || 20)
    );

    const orders = await db.order.findMany({
      where: {
        customerAccountId: session.accountId,
        restaurantId: restaurant.id,
        sourceType: 'ONLINE',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        shortOrderId: true,
        status: true,
        total: true,
        address: true,
        createdAt: true,
        orderScheduleMode: true,
        orderScheduleSlot: true,
        branch: { select: { id: true, name: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, method: true },
        },
        items: {
          select: {
            quantity: true,
            productName: true,
            menuItem: { select: { name: true } },
          },
          take: 4,
        },
        _count: { select: { items: true } },
      },
    });

    const hasMore = orders.length > take;
    const page = hasMore ? orders.slice(0, take) : orders;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return NextResponse.json({
      data: {
        restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
        orders: page.map((order) => {
          const fulfillment =
            typeof order.address === 'string' &&
            order.address.includes('Fulfillment: Delivery')
              ? 'delivery'
              : 'pickUp';
          return {
            id: order.id,
            urlId: encodeUrlId(order.id),
            shortOrderId: order.shortOrderId,
            status: order.status,
            total: order.total,
            createdAt: order.createdAt.toISOString(),
            fulfillment,
            scheduleMode: order.orderScheduleMode,
            scheduleSlot: order.orderScheduleSlot,
            branchName: order.branch?.name ?? null,
            paymentStatus: order.payments[0]?.status ?? null,
            paymentMethod: order.payments[0]?.method ?? null,
            itemCount: order._count.items,
            itemPreview: order.items.map(
              (item) => `${item.quantity}× ${orderItemDisplayName(item)}`
            ),
          };
        }),
        nextCursor,
      },
    });
  } catch (error) {
    console.error('customer me orders list', error);
    return NextResponse.json(
      { error: 'Could not load orders.' },
      { status: 500 }
    );
  }
}
