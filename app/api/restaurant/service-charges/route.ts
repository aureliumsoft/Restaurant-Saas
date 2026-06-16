import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  normalizeServiceChargeAmount,
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
} from '@/lib/restaurant-service-charge';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const channelSchema = z.object({
  enabled: z.boolean(),
  amount: z.number().finite().nonnegative().max(999.99),
});

const patchSchema = z
  .object({
    pos: channelSchema.optional(),
    kiosk: channelSchema.optional(),
    online: channelSchema.optional(),
  })
  .strict()
  .refine((data) => data.pos || data.kiosk || data.online, {
    message: 'At least one channel must be provided.',
  });

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantForOwnerRequest(req, {
      moduleKey: 'settings',
      action: 'access',
    });
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const row = await db.restaurant.findUnique({
      where: { id: auth.restaurant.id },
      select: RESTAURANT_SERVICE_CHARGE_DB_SELECT,
    });

    return NextResponse.json({
      data: parseRestaurantServiceCharges(row ?? undefined),
    });
  } catch (error) {
    console.error('service-charges GET', error);
    return NextResponse.json(
      { error: 'Failed to load service charges.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getRestaurantForOwnerRequest(req, {
      moduleKey: 'settings',
      action: 'edit',
    });
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const json = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data: Record<string, boolean | number> = {};
    if (parsed.data.pos) {
      data.posServiceChargeEnabled = parsed.data.pos.enabled;
      data.posServiceChargeAmount = normalizeServiceChargeAmount(
        parsed.data.pos.amount
      );
    }
    if (parsed.data.kiosk) {
      data.kioskServiceChargeEnabled = parsed.data.kiosk.enabled;
      data.kioskServiceChargeAmount = normalizeServiceChargeAmount(
        parsed.data.kiosk.amount
      );
    }
    if (parsed.data.online) {
      data.onlineServiceChargeEnabled = parsed.data.online.enabled;
      data.onlineServiceChargeAmount = normalizeServiceChargeAmount(
        parsed.data.online.amount
      );
    }

    const updated = await db.restaurant.update({
      where: { id: auth.restaurant.id },
      data,
      select: RESTAURANT_SERVICE_CHARGE_DB_SELECT,
    });

    return NextResponse.json({
      data: parseRestaurantServiceCharges(updated),
    });
  } catch (error) {
    console.error('service-charges PATCH', error);
    return NextResponse.json(
      { error: 'Failed to update service charges.' },
      { status: 500 }
    );
  }
}
