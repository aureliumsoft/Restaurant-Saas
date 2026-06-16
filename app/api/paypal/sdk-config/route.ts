import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getPayPalPlatformConfig,
  isPayPalConfigured,
} from '@/lib/paypal-server';
import { getRestaurantPayPalRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';

export const runtime = 'nodejs';

/**
 * Public PayPal SDK configuration for inline Buttons.
 * - With `restaurantSlug`: restaurant-owned credentials.
 * - Without slug: platform-only (SaaS subscription buttons).
 */
export async function GET(req: NextRequest) {
  const restaurantSlug = req.nextUrl.searchParams.get('restaurantSlug')?.trim();

  if (restaurantSlug) {
    const row = await getRestaurantPayPalRuntimeConfigBySlug(restaurantSlug);
    if (!row) {
      return NextResponse.json(
        {
          error:
            'This restaurant has not configured PayPal yet. Online payments are unavailable.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        clientId: row.config.clientId,
        currency: row.config.currency,
        mode: row.config.mode,
        buyerCountry: row.config.countryCode,
        multiparty: false,
      },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  }

  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: 'PayPal is not configured (missing PAYPAL_CLIENT_ID).' },
      { status: 503 }
    );
  }

  const config = getPayPalPlatformConfig();
  return NextResponse.json(
    {
      clientId: config.clientId,
      currency: config.currency,
      mode: config.mode,
      multiparty: false,
    },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  );
}
