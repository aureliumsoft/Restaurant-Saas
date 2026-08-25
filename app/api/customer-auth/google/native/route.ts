import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hashPassword } from '@/lib/auth/password';
import { verifyGoogleIdToken } from '@/lib/customer-auth/google-oauth';
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

export const runtime = 'nodejs';

const bodySchema = z.object({
  restaurantSlug: z.string().min(1).max(200),
  idToken: z.string().min(20).max(8000),
});

/**
 * Native Google Sign-In for white-label restaurant apps.
 * Verifies the ID token, upserts the customer account, and sets the session cookie.
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const ip = clientIpFromRequest(req) ?? 'unknown';
    if (!consumeCustomerAuthRateLimit(`google-native:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
    }

    const restaurant = await resolveRestaurantIdBySlug(parsed.data.restaurantSlug);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
    }

    const profile = await verifyGoogleIdToken(parsed.data.idToken);
    if (!profile?.email?.trim()) {
      return NextResponse.json(
        { error: 'Google sign-in could not be verified.' },
        { status: 401 }
      );
    }

    const email = profile.email.trim();
    const emailNormalized = normalizeCustomerEmail(email);
    const name =
      profile.name?.trim() ||
      profile.given_name?.trim() ||
      email.split('@')[0] ||
      'Customer';

    let account = await db.customerAccount.findUnique({
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
        disabledAt: true,
      },
    });

    if (account?.disabledAt) {
      return NextResponse.json(
        { error: 'This account is disabled.' },
        { status: 403 }
      );
    }

    if (!account) {
      const passwordHash = await hashPassword(
        randomBytes(48).toString('base64url')
      );
      account = await db.customerAccount.create({
        data: {
          restaurantId: restaurant.id,
          email,
          emailNormalized,
          passwordHash,
          name,
          emailVerifiedAt: profile.email_verified ? new Date() : null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          restaurantId: true,
          disabledAt: true,
        },
      });
    } else if (!account.name?.trim() && name) {
      account = await db.customerAccount.update({
        where: { id: account.id },
        data: { name },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          restaurantId: true,
          disabledAt: true,
        },
      });
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
    console.error('customer-auth google native', error);
    return NextResponse.json(
      { error: 'Could not sign in with Google.' },
      { status: 500 }
    );
  }
}
