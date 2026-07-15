import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

export const CUSTOMER_SESSION_COOKIE = 'rs_customer_session';
export const CUSTOMER_SESSION_DAYS = 30;

export type CustomerAccountSession = {
  sessionId: string;
  accountId: string;
  restaurantId: string;
  email: string;
  name: string;
  phone: string | null;
};

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashCustomerSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createCustomerSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function customerSessionExpiryDate(from = new Date()): Date {
  return new Date(from.getTime() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export function readCustomerSessionCookie(req: NextRequest): string | null {
  const raw = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function setCustomerSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date
) {
  res.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export function clearCustomerSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}

export async function resolveRestaurantIdBySlug(
  slug: string | null | undefined
): Promise<{ id: string; slug: string; name: string } | null> {
  const trimmed = slug?.trim();
  if (!trimmed) return null;
  return db.restaurant.findUnique({
    where: { slug: trimmed },
    select: { id: true, slug: true, name: true },
  });
}

export async function getCustomerAccountSession(
  req: NextRequest,
  options?: { restaurantId?: string | null }
): Promise<CustomerAccountSession | null> {
  const token = readCustomerSessionCookie(req);
  if (!token) return null;

  const tokenHash = hashCustomerSessionToken(token);
  const now = new Date();

  const session = await db.customerSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      account: {
        select: {
          id: true,
          restaurantId: true,
          email: true,
          name: true,
          phone: true,
          disabledAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= now || session.account.disabledAt) {
    if (session) {
      await db.customerSession.delete({ where: { id: session.id } }).catch(() => null);
    }
    return null;
  }

  if (
    options?.restaurantId &&
    session.account.restaurantId !== options.restaurantId
  ) {
    return null;
  }

  return {
    sessionId: session.id,
    accountId: session.account.id,
    restaurantId: session.account.restaurantId,
    email: session.account.email,
    name: session.account.name,
    phone: session.account.phone,
  };
}

export async function createCustomerAccountSession(options: {
  accountId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = createCustomerSessionToken();
  const tokenHash = hashCustomerSessionToken(token);
  const expiresAt = customerSessionExpiryDate();

  await db.customerSession.create({
    data: {
      accountId: options.accountId,
      tokenHash,
      expiresAt,
      userAgent: options.userAgent?.slice(0, 500) || null,
      ipAddress: options.ipAddress?.slice(0, 80) || null,
    },
  });

  return { token, expiresAt };
}

export async function destroyCustomerAccountSession(req: NextRequest) {
  const token = readCustomerSessionCookie(req);
  if (!token) return;
  const tokenHash = hashCustomerSessionToken(token);
  await db.customerSession.deleteMany({ where: { tokenHash } });
}

export async function upsertCustomerProfileForAccount(options: {
  restaurantId: string;
  accountId: string;
  name: string;
  email: string;
  phone?: string | null;
}) {
  const phone =
    options.phone?.trim() && options.phone.trim().length > 0
      ? options.phone.trim()
      : 'N/A';

  const existing = await db.customer.findFirst({
    where: {
      restaurantId: options.restaurantId,
      accountId: options.accountId,
    },
  });

  if (existing) {
    return db.customer.update({
      where: { id: existing.id },
      data: {
        name: options.name.trim() || existing.name,
        email: options.email.trim() || existing.email,
        phone,
      },
    });
  }

  return db.customer.create({
    data: {
      restaurantId: options.restaurantId,
      accountId: options.accountId,
      name: options.name.trim() || 'Customer',
      email: options.email.trim(),
      phone,
    },
  });
}

/** Simple in-memory rate limit (per process). Enough for basic abuse protection. */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function consumeCustomerAuthRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function clientIpFromRequest(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip');
}
