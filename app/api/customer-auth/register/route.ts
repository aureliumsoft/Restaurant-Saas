import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hashPassword, isStrongPassword } from '@/lib/auth/password';
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
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    if (!isStrongPassword(parsed.data.password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const ip = clientIpFromRequest(req) ?? 'unknown';
    if (!consumeCustomerAuthRateLimit(`register:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
    }

    const restaurant = await resolveRestaurantIdBySlug(parsed.data.restaurantSlug);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
    }

    const email = parsed.data.email.trim();
    const emailNormalized = normalizeCustomerEmail(email);
    const name = parsed.data.name.trim();
    const phone = parsed.data.phone?.trim() || null;

    const existing = await db.customerAccount.findUnique({
      where: {
        restaurantId_emailNormalized: {
          restaurantId: restaurant.id,
          emailNormalized,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const account = await db.customerAccount.create({
      data: {
        restaurantId: restaurant.id,
        email,
        emailNormalized,
        passwordHash,
        name,
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        restaurantId: true,
      },
    });

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
    console.error('customer-auth register', error);
    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
  }
}
