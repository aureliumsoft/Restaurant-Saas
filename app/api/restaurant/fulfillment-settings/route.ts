import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  parseRestaurantFulfillmentSettings,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} from '@/lib/restaurant-fulfillment-settings';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const patchSchema = z
  .object({
    deliveryEnabled: z.boolean().optional(),
    dineInEnabled: z.boolean().optional(),
    cardPaymentsEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.deliveryEnabled !== undefined ||
      data.dineInEnabled !== undefined ||
      data.cardPaymentsEnabled !== undefined,
    { message: 'At least one setting must be provided.' }
  );

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
      select: RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
    });

    return NextResponse.json({
      data: parseRestaurantFulfillmentSettings(row ?? undefined),
    });
  } catch (error) {
    console.error('fulfillment-settings GET', error);
    return NextResponse.json(
      { error: 'Failed to load fulfillment settings.' },
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
      data: parsed.data,
      select: RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
    });

    return NextResponse.json({
      data: parseRestaurantFulfillmentSettings(updated),
    });
  } catch (error) {
    console.error('fulfillment-settings PATCH', error);
    return NextResponse.json(
      { error: 'Failed to update fulfillment settings.' },
      { status: 500 }
    );
  }
}
