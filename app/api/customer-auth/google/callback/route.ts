import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { hashPassword } from '@/lib/auth/password';
import {
  customerGoogleOAuthRedirectUri,
  decodeCustomerGoogleOAuthState,
  exchangeGoogleAuthCode,
} from '@/lib/customer-auth/google-oauth';
import {
  clientIpFromRequest,
  createCustomerAccountSession,
  normalizeCustomerEmail,
  resolveRestaurantIdBySlug,
  setCustomerSessionCookie,
  upsertCustomerProfileForAccount,
} from '@/lib/customer-auth/session';
import { getBaseUrl } from '@/lib/public-app-origin-server';
import { db } from '@/lib/db';

function redirectWithError(returnTo: string, code: string) {
  const sep = returnTo.includes('?') ? '&' : '?';
  return NextResponse.redirect(`${returnTo}${sep}customerAuthError=${encodeURIComponent(code)}`);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim();
  const stateRaw = req.nextUrl.searchParams.get('state')?.trim();
  const oauthError = req.nextUrl.searchParams.get('error')?.trim();

  const state = decodeCustomerGoogleOAuthState(stateRaw);
  const fallbackReturn = state?.returnTo ?? '/';

  if (oauthError || !code || !state) {
    return redirectWithError(fallbackReturn, oauthError || 'invalid_state');
  }

  const restaurant = await resolveRestaurantIdBySlug(state.restaurantSlug);
  if (!restaurant) {
    return redirectWithError(fallbackReturn, 'restaurant_not_found');
  }

  const origin = req.nextUrl.origin?.trim() || getBaseUrl();
  const redirectUri = customerGoogleOAuthRedirectUri(origin);
  const profile = await exchangeGoogleAuthCode(code, redirectUri);
  if (!profile?.email?.trim()) {
    return redirectWithError(state.returnTo, 'google_profile');
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
    return redirectWithError(state.returnTo, 'account_disabled');
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

  const ip = clientIpFromRequest(req) ?? 'unknown';
  const session = await createCustomerAccountSession({
    accountId: account.id,
    userAgent: req.headers.get('user-agent'),
    ipAddress: ip,
  });

  const res = NextResponse.redirect(state.returnTo);
  setCustomerSessionCookie(res, session.token, session.expiresAt);
  return res;
}
