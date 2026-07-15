import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifyPassword } from '@/lib/auth/password';
import {
  clientIpFromRequest,
  consumeCustomerAuthRateLimit,
  createCustomerAccountSession,
  normalizeCustomerEmail,
  resolveRestaurantIdBySlug,
  setCustomerSessionCookie,
  upsertCustomerProfileForAccount,
} from '@/lib/customer-auth/session';
import { db } from '@/lib/db';

const bodySchema = z.object({
  restaurantSlug: z.string().min(1).max(200),
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const ip = clientIpFromRequest(req) ?? 'unknown';
    if (!consumeCustomerAuthRateLimit(`login:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
    }

    const restaurant = await resolveRestaurantIdBySlug(parsed.data.restaurantSlug);
    if (!restaurant) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const emailNormalized = normalizeCustomerEmail(parsed.data.email);
    const account = await db.customerAccount.findUnique({
      where: {
        restaurantId_emailNormalized: {
          restaurantId: restaurant.id,
          emailNormalized,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        restaurantId: true,
        passwordHash: true,
        disabledAt: true,
      },
    });

    if (!account || account.disabledAt) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(parsed.data.password, account.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    await upsertCustomerProfileForAccount({
      restaurantId: restaurant.id,
      accountId: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
    });

    const session = await createCustomerAccountSession({
      accountId: account.id,
      userAgent: req.headers.get('user-agent'),
      ipAddress: ip,
    });

    const res = NextResponse.json({
      data: {
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          phone: account.phone,
          restaurantId: account.restaurantId,
          restaurantSlug: restaurant.slug,
        },
      },
    });
    setCustomerSessionCookie(res, session.token, session.expiresAt);
    return res;
  } catch (error) {
    console.error('customer-auth login', error);
    return NextResponse.json({ error: 'Could not log in.' }, { status: 500 });
  }
}
