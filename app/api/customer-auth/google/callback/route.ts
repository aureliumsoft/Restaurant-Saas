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
import { db } from '@/lib/db';
import { upsertNewsletterSubscriber } from '@/lib/newsletter/subscribe';
import { absoluteAppUrl } from '@/lib/public-app-origin-server';

function redirectToApp(
  req: NextRequest,
  returnTo: string,
  stateOrigin?: string | null
) {
  return NextResponse.redirect(
    absoluteAppUrl(returnTo, { req, stateOrigin })
  );
}

function redirectWithError(
  req: NextRequest,
  returnTo: string,
  code: string,
  stateOrigin?: string | null
) {
  const dest = new URL(absoluteAppUrl(returnTo, { req, stateOrigin }));
  dest.searchParams.set('customerAuthError', code);
  return NextResponse.redirect(dest);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim();
  const stateRaw = req.nextUrl.searchParams.get('state')?.trim();
  const oauthError = req.nextUrl.searchParams.get('error')?.trim();

  const state = decodeCustomerGoogleOAuthState(stateRaw);
  const fallbackReturn = state?.returnTo ?? '/';

  if (oauthError || !code || !state) {
    return redirectWithError(
      req,
      fallbackReturn,
      oauthError || 'invalid_state',
      state?.origin
    );
  }

  const restaurant = await resolveRestaurantIdBySlug(state.restaurantSlug);
  if (!restaurant) {
    return redirectWithError(
      req,
      fallbackReturn,
      'restaurant_not_found',
      state.origin
    );
  }

  const redirectUri = customerGoogleOAuthRedirectUri();
  const profile = await exchangeGoogleAuthCode(code, redirectUri);
  if (!profile?.email?.trim()) {
    return redirectWithError(req, state.returnTo, 'google_profile', state.origin);
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
    return redirectWithError(req, state.returnTo, 'account_disabled', state.origin);
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

  await upsertNewsletterSubscriber({
    email: account.email,
    name: account.name,
    source: 'google',
  });

  const ip = clientIpFromRequest(req) ?? 'unknown';
  const session = await createCustomerAccountSession({
    accountId: account.id,
    userAgent: req.headers.get('user-agent'),
    ipAddress: ip,
  });

  const res = redirectToApp(req, state.returnTo, state.origin);
  setCustomerSessionCookie(res, session.token, session.expiresAt);
  return res;
}
