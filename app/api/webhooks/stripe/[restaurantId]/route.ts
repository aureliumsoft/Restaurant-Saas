import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getRestaurantStripeRuntimeConfigByRestaurantId,
} from '@/lib/restaurant-payment-credentials';
import {
  markExistingOrderPaidFromSession,
  processOrderIntentFromSession,
  resolveBaseUrlFromHeaders,
} from '@/lib/stripe-order-intent-sync';
import { verifyRestaurantStripeWebhook } from '@/lib/restaurant-stripe-client';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await ctx.params;
  const config = await getRestaurantStripeRuntimeConfigByRestaurantId(restaurantId);
  if (!config) {
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 404 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature.' }, { status: 400 });
  }

  const payload = await req.text();
  let event;
  try {
    event = verifyRestaurantStripeWebhook(config, payload, signature);
  } catch (e) {
    console.error('Stripe webhook verification failed:', e);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const baseUrl = resolveBaseUrlFromHeaders(req.headers);
    try {
      await markExistingOrderPaidFromSession(session);
      await processOrderIntentFromSession(session, baseUrl);
    } catch (e) {
      console.error('Stripe webhook order sync failed:', e);
      return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
