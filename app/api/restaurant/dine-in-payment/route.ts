import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  DINE_IN_PAYMENT_TIMING_VALUES,
  parseRestaurantDineInPayment,
  RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
} from '@/lib/restaurant-dine-in-payment';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const patchSchema = z
  .object({
    dineInPaymentTiming: z.enum(DINE_IN_PAYMENT_TIMING_VALUES),
  })
  .strict();

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
      select: RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
    });

    return NextResponse.json({
      data: parseRestaurantDineInPayment(row ?? undefined),
    });
  } catch (error) {
    console.error('dine-in-payment GET', error);
    return NextResponse.json(
      { error: 'Failed to load dine-in payment setting.' },
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

    const updated = await db.restaurant.update({
      where: { id: auth.restaurant.id },
      data: {
        dineInPaymentTiming: parsed.data.dineInPaymentTiming,
      },
      select: RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
    });

    return NextResponse.json({
      data: parseRestaurantDineInPayment(updated),
    });
  } catch (error) {
    console.error('dine-in-payment PATCH', error);
    return NextResponse.json(
      { error: 'Failed to update dine-in payment setting.' },
      { status: 500 }
    );
  }
}
