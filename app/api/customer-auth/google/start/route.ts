import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildCustomerGoogleAuthUrl } from '@/lib/customer-auth/google-oauth';
import { getBaseUrl } from '@/lib/public-app-origin-server';

export async function GET(req: NextRequest) {
  const restaurantSlug = req.nextUrl.searchParams.get('restaurantSlug')?.trim();
  const returnToRaw = req.nextUrl.searchParams.get('returnTo')?.trim();

  if (!restaurantSlug) {
    return NextResponse.json({ error: 'Restaurant is required.' }, { status: 400 });
  }

  const returnTo =
    returnToRaw &&
    returnToRaw.startsWith('/') &&
    !returnToRaw.startsWith('//')
      ? returnToRaw
      : `/kiosk/${encodeURIComponent(restaurantSlug)}`;

  const origin = req.nextUrl.origin?.trim() || getBaseUrl();

  const url = buildCustomerGoogleAuthUrl({
    origin,
    restaurantSlug,
    returnTo,
  });

  if (!url) {
    return NextResponse.json(
      { error: 'Google sign-in is not configured.' },
      { status: 503 }
    );
  }

  return NextResponse.redirect(url);
}
