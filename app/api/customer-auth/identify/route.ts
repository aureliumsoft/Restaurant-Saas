import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  clientIpFromRequest,
  consumeCustomerAuthRateLimit,
  normalizeCustomerEmail,
  resolveRestaurantIdBySlug,
} from '@/lib/customer-auth/session';
import { db } from '@/lib/db';

const bodySchema = z.object({
  restaurantSlug: z.string().min(1).max(200),
  email: z.string().email().max(320),
});

/** Check whether an account exists for this restaurant + email (no PII beyond boolean). */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const ip = clientIpFromRequest(req) ?? 'unknown';
    if (!consumeCustomerAuthRateLimit(`identify:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
    }

    const restaurant = await resolveRestaurantIdBySlug(parsed.data.restaurantSlug);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
    }

    const emailNormalized = normalizeCustomerEmail(parsed.data.email);
    const existing = await db.customerAccount.findUnique({
      where: {
        restaurantId_emailNormalized: {
          restaurantId: restaurant.id,
          emailNormalized,
        },
      },
      select: { id: true, disabledAt: true },
    });

    if (existing?.disabledAt) {
      return NextResponse.json({
        data: { exists: false, email: emailNormalized },
      });
    }

    return NextResponse.json({
      data: {
        exists: Boolean(existing),
        email: emailNormalized,
      },
    });
  } catch (error) {
    console.error('customer-auth identify', error);
    return NextResponse.json({ error: 'Could not check account.' }, { status: 500 });
  }
}
