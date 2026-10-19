import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { z } from 'zod';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';
import {
  CUSTOM_SELECTABLE_MODULE_IDS,
  toPricingModuleIds,
} from '@/lib/entitlements/pricing-module-ids';
import { applyAdminSubscriptionUpdate } from '@/lib/subscription-admin-update';
import { parseSubscriptionDateInput } from '@/lib/subscription-timezone';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const selectableSet = new Set(CUSTOM_SELECTABLE_MODULE_IDS);

const patchSchema = z.object({
  plan: z.enum(['FREE', 'BASIC', 'GROWTH', 'SCALE', 'PRO', 'CUSTOM']),
  status: z.enum(['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED']),
  trialEndsAt: z.string().max(40).nullable().optional(),
  currentPeriodEnd: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  customSelectedModules: z.array(z.string().trim().min(1).max(64)).max(40).optional(),
});

function parseDate(s: string | null | undefined): Date | null | undefined {
  return parseSubscriptionDateInput(s);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { restaurantId } = await resolveRouteParams(ctx.params, ['restaurantId']);

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

  const { trialEndsAt, currentPeriodEnd, notes, plan, status, customSelectedModules } =
    parsed.data;

  const normalizedModules =
    plan === 'CUSTOM'
      ? toPricingModuleIds(customSelectedModules ?? []).filter((id) =>
          selectableSet.has(id)
        )
      : [];

  try {
    const result = await applyAdminSubscriptionUpdate(restaurantId, {
      plan: plan as SubscriptionPlan,
      status: status as SubscriptionStatus,
      trialEndsAt: parseDate(trialEndsAt),
      currentPeriodEnd: parseDate(currentPeriodEnd),
      notes: notes === undefined ? undefined : notes,
      customSelectedModules: normalizedModules,
    });

    return NextResponse.json(
      {
        data: result.subscription,
        sync: {
          paypal: result.paypal,
          paymentPeriodEndUpdated: result.paymentPeriodEndUpdated,
          periodEndChanged: result.periodEndChanged,
          adminTimezone: result.adminTimezone,
          paypalBillingTimezone: result.paypalBillingTimezone,
          paypalPeriodEndAt: result.paypalPeriodEndAt,
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
