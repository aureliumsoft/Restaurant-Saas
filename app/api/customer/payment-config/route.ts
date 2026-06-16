import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getPublicRestaurantPaymentConfigBySlug } from '@/lib/restaurant-payment-credentials';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const restaurantSlug = req.nextUrl.searchParams.get('restaurantSlug')?.trim();
  if (!restaurantSlug) {
    return NextResponse.json(
      { error: 'restaurantSlug is required.' },
      { status: 400 }
    );
  }

  const data = await getPublicRestaurantPaymentConfigBySlug(restaurantSlug);
  if (!data) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
  }

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  );
}
