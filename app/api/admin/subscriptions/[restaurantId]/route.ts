import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';
import { applyAdminSubscriptionUpdate } from '@/lib/subscription-admin-update';

const patchSchema = z.object({
  plan: z.enum(['STARTER', 'GROWTH', 'SCALE']),
  status: z.enum(['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED']),
  trialEndsAt: z.string().max(40).nullable().optional(),
  currentPeriodEnd: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

function parseDate(s: string | null | undefined): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === null || s === '') return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { restaurantId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const { trialEndsAt, currentPeriodEnd, notes, plan, status } = parsed.data;

  try {
    const result = await applyAdminSubscriptionUpdate(restaurantId, {
      plan: plan as SubscriptionPlan,
      status: status as SubscriptionStatus,
      trialEndsAt: parseDate(trialEndsAt),
      currentPeriodEnd: parseDate(currentPeriodEnd),
      notes: notes === undefined ? undefined : notes,
    });

    return NextResponse.json(
      {
        data: result.subscription,
        sync: {
          paypal: result.paypal,
          paymentPeriodEndUpdated: result.paymentPeriodEndUpdated,
          periodEndChanged: result.periodEndChanged,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
