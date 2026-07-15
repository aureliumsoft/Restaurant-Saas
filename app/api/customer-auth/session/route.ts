import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getCustomerAccountSession,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('restaurantSlug')?.trim() || null;
    const restaurant = slug ? await resolveRestaurantIdBySlug(slug) : null;

    const session = await getCustomerAccountSession(req, {
      restaurantId: restaurant?.id,
    });

    if (!session) {
      return NextResponse.json({ data: { account: null } });
    }

    // If no slug given, still return session but include restaurant slug.
    const account = await db.customerAccount.findUnique({
      where: { id: session.accountId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        restaurantId: true,
        restaurant: { select: { slug: true } },
      },
    });

    if (!account) {
      return NextResponse.json({ data: { account: null } });
    }

    if (restaurant && account.restaurantId !== restaurant.id) {
      return NextResponse.json({ data: { account: null } });
    }

    return NextResponse.json({
      data: {
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          phone: account.phone,
          restaurantId: account.restaurantId,
          restaurantSlug: account.restaurant.slug,
        },
      },
    });
  } catch (error) {
    console.error('customer-auth session', error);
    return NextResponse.json({ error: 'Could not load session.' }, { status: 500 });
  }
}
