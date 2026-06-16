import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { applyPayPalPostCapture } from '@/lib/paypal-post-capture';
import { getRestaurantPayPalRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';

export const runtime = 'nodejs';

const bodySchema = z.object({
  id: z.string().min(3).max(200),
  restaurantSlug: z.string().optional(),
});

/**
 * Captures a PayPal order created by the inline JS-SDK Buttons flow and
 * propagates the result to local order records.
 */
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const restaurantSlug = parsed.data.restaurantSlug?.trim();
  if (!restaurantSlug) {
    return NextResponse.json(
      { error: 'restaurantSlug is required for customer payments.' },
      { status: 400 }
    );
  }

  const row = await getRestaurantPayPalRuntimeConfigBySlug(restaurantSlug);
  if (!row) {
    return NextResponse.json(
      { error: 'Restaurant PayPal is not configured.' },
      { status: 403 }
    );
  }

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  try {
    const result = await applyPayPalPostCapture({
      orderToken: parsed.data.id,
      baseUrl,
      restaurantSlug,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error('PayPal capture-order failed:', e);
    return NextResponse.json(
      { error: 'Could not capture PayPal payment' },
      { status: 502 }
    );
  }
}
