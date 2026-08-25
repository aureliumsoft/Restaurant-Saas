import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getRestaurantStripeRuntimeConfigBySlug,
} from '@/lib/restaurant-payment-credentials';
import {
  markExistingOrderPaidFromSession,
  processOrderIntentFromSession,
  resolveBaseUrlFromHeaders,
} from '@/lib/stripe-order-intent-sync';
import { retrieveRestaurantStripeCheckoutSession } from '@/lib/restaurant-stripe-client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId =
    req.nextUrl.searchParams.get('session_id')?.trim() ||
    req.nextUrl.searchParams.get('token')?.trim();
  const restaurantSlug = req.nextUrl.searchParams.get('restaurantSlug')?.trim();

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }
  if (!restaurantSlug) {
    return NextResponse.json({ error: 'Missing restaurantSlug' }, { status: 400 });
  }

  const row = await getRestaurantStripeRuntimeConfigBySlug(restaurantSlug);
  if (!row) {
    return NextResponse.json(
      { error: 'Stripe is not configured for this restaurant.' },
      { status: 403 }
    );
  }

  try {
    const session = await retrieveRestaurantStripeCheckoutSession(
      row.config,
      sessionId
    );
    const baseUrl = resolveBaseUrlFromHeaders(req.headers);
    let orderSync:
      | 'skipped'
      | 'completed'
      | 'already_completed'
      | 'failed' = 'skipped';
    let orderId: string | undefined;
    let shortOrderId: string | undefined;
    let ticketNumber: number | null | undefined;
    let orderError: string | undefined;

    if (session.payment_status === 'paid') {
      const existing = await markExistingOrderPaidFromSession(session);
      if (existing === 'already_completed') {
        orderSync = 'already_completed';
      } else if (existing === 'updated') {
        orderSync = 'completed';
      }

      const intentResult = await processOrderIntentFromSession(session, baseUrl);
      if (intentResult.status !== 'skipped') {
        orderSync = intentResult.status;
        orderId = intentResult.orderId;
        shortOrderId = intentResult.shortOrderId;
        ticketNumber = intentResult.ticketNumber ?? null;
        orderError = intentResult.error;
      }
    }

    return NextResponse.json({
      paid: session.payment_status === 'paid',
      status: session.payment_status === 'paid' ? 'completed' : 'pending',
      orderSync,
      orderId,
      shortOrderId,
      ticketNumber,
      error: orderError,
      metadata: session.metadata ?? {},
    });
  } catch (e) {
    console.error('Stripe verify-order-session failed:', e);
    return NextResponse.json(
      { error: 'Could not verify Stripe checkout session.' },
      { status: 502 }
    );
  }
}
