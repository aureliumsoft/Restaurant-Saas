import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import {
  createCustomerOrder,
  customerOrderPostSchema,
  parseOrderIdempotencyKey,
} from '@/lib/orders/create-customer-order';

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = customerOrderPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const restaurant = await resolveRestaurantIdBySlug(parsed.data.restaurantSlug);
  const session = restaurant
    ? await getCustomerAccountSession(req, { restaurantId: restaurant.id })
    : null;

  const result = await createCustomerOrder({
    data: parsed.data,
    customerAccountId: session?.accountId ?? null,
    idempotencyKey: parseOrderIdempotencyKey(req),
  });

  if (!result.ok) {
    if (result.response) return result.response;
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      data: {
        orderId: result.orderId,
        shortOrderId: result.shortOrderId,
        restaurantId: result.restaurantId,
        ticketNumber: result.ticketNumber,
      },
    },
    { status: 201 }
  );
}
