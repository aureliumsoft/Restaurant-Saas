import { NextResponse } from 'next/server';

import {
  createPartnerReferral,
  getPayPalPartnerConfigError,
} from '@/lib/paypal-partner';
import { isPayPalPartnerConfigured } from '@/lib/paypal-server';
import { requireRestaurantSession } from '@/lib/restaurant/require-session';
import { getRequestOrigin } from '@/lib/request-origin';
import { ensurePayPalIntegrationRow } from '@/lib/restaurant-paypal-integration';

export const runtime = 'nodejs';

export async function POST() {
  if (!isPayPalPartnerConfigured()) {
    return NextResponse.json(
      {
        error:
          getPayPalPartnerConfigError() ??
          'PayPal partner is not configured on the platform.',
      },
      { status: 503 }
    );
  }

  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  const { restaurant } = session.ctx;
  await ensurePayPalIntegrationRow(restaurant.id);

  const origin = await getRequestOrigin();
  const returnUrl = `${origin}/settings/paypal/return`;

  try {
    const referral = await createPartnerReferral({
      trackingId: restaurant.id,
      returnUrl,
      restaurantName: restaurant.name,
    });
    return NextResponse.json({
      data: {
        actionUrl: referral.actionUrl,
        partnerReferralId: referral.partnerReferralId,
      },
    });
  } catch (e) {
    console.error('PayPal onboard failed:', e);
    return NextResponse.json(
      { error: 'Could not start PayPal onboarding' },
      { status: 502 }
    );
  }
}
