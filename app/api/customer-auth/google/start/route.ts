import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildCustomerGoogleAuthUrl } from '@/lib/customer-auth/google-oauth';
import { requestOrigin } from '@/lib/public-app-origin-server';

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
      : `/${encodeURIComponent(restaurantSlug)}`;

  const url = buildCustomerGoogleAuthUrl({
    restaurantSlug,
    returnTo,
    origin: requestOrigin(req),
  });

  if (!url) {
    return NextResponse.json(
      { error: 'Google sign-in is not configured.' },
      { status: 503 }
    );
  }

  return NextResponse.redirect(url);
}
