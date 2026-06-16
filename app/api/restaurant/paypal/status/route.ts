import { NextResponse } from 'next/server';

import { requireRestaurantSession } from '@/lib/restaurant/require-session';
import {
  getPayPalIntegrationByRestaurantId,
  syncPayPalIntegrationFromPayPal,
} from '@/lib/restaurant-paypal-integration';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

  const { restaurant } = session.ctx;
  const refresh = new URL(req.url).searchParams.get('refresh') === '1';

  let integration = await getPayPalIntegrationByRestaurantId(restaurant.id);

  if (refresh && integration?.paypalMerchantId) {
    try {
      integration = await syncPayPalIntegrationFromPayPal(
        restaurant.id,
        integration.paypalMerchantId
      );
    } catch (e) {
      console.error('PayPal status refresh failed:', e);
    }
  }

  return NextResponse.json({
    data: integration,
    partnerConfigured: Boolean(process.env.PAYPAL_PARTNER_MERCHANT_ID?.trim()),
  });
}
