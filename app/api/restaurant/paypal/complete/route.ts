import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRestaurantSession } from '@/lib/restaurant/require-session';
import { completePayPalOnboardingFromReturn } from '@/lib/restaurant-paypal-integration';

export const runtime = 'nodejs';

const bodySchema = z.object({
  merchantIdInPayPal: z.string().optional(),
  permissionsGranted: z.boolean().optional(),
  accountStatus: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireRestaurantSession();
  if (!session.ok) return session.response;

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

  try {
    const data = await completePayPalOnboardingFromReturn({
      restaurantId: session.ctx.restaurant.id,
      merchantIdInPayPal: parsed.data.merchantIdInPayPal,
      permissionsGranted: parsed.data.permissionsGranted,
      accountStatus: parsed.data.accountStatus,
    });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('PayPal complete onboarding failed:', e);
    return NextResponse.json(
      { error: 'Could not complete PayPal onboarding' },
      { status: 502 }
    );
  }
}
