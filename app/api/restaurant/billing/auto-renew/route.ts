import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRestaurantSession } from '@/lib/restaurant/require-session';
import { setRestaurantAutoRenew } from '@/lib/subscription-lifecycle';

export const runtime = 'nodejs';

const bodySchema = z.object({
  autoRenew: z.boolean(),
});

export async function PATCH(req: Request) {
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await setRestaurantAutoRenew(
      session.ctx.restaurant.id,
      parsed.data.autoRenew
    );
    return NextResponse.json({
      data: {
        autoRenew: result.subscription.autoRenew,
        status: result.subscription.status,
        currentPeriodEnd:
          result.subscription.currentPeriodEnd?.toISOString() ?? null,
        message: result.paypalMessage,
      },
    });
  } catch (e) {
    console.error('Auto-renew update failed:', e);
    return NextResponse.json(
      { error: 'Could not update auto-renew setting' },
      { status: 500 }
    );
  }
}
