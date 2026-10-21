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
    websiteEnabled: z.boolean().optional(),
    kioskEnabled: z.boolean().optional(),
    kdsEnabled: z.boolean().optional(),
    orderDisplayEnabled: z.boolean().optional(),
    onscreenKeyboardEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.deliveryEnabled !== undefined ||
      data.dineInEnabled !== undefined ||
      data.cardPaymentsEnabled !== undefined ||
      data.websiteEnabled !== undefined ||
      data.kioskEnabled !== undefined ||
      data.kdsEnabled !== undefined ||
      data.orderDisplayEnabled !== undefined ||
      data.onscreenKeyboardEnabled !== undefined,
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

    const { getRestaurantEntitlements, moduleLimitFlag } = await import(
      '@/lib/entitlements'
    );
    const { subscriptionPlanDeniedResponse } = await import(
      '@/lib/subscription-plan-enforcement'
    );
    const entitlements = await getRestaurantEntitlements(auth.restaurant.id);
    if (moduleLimitFlag(entitlements, 'basicSettings', 'orderChannelsLocked')) {
      const turningOn = Object.values(parsed.data).some((v) => v === true);
      if (turningOn) {
        return subscriptionPlanDeniedResponse('Order channels');
      }
    }
    const channelChecks: Array<{
      enabled: boolean | undefined;
      flag: string;
      label: string;
    }> = [
      { enabled: parsed.data.dineInEnabled, flag: 'dineInChannel', label: 'Dine-in' },
      {
        enabled: parsed.data.deliveryEnabled,
        flag: 'deliveryChannel',
        label: 'Delivery',
      },
      { enabled: parsed.data.kdsEnabled, flag: 'kdsChannel', label: 'KDS' },
      {
        enabled: parsed.data.websiteEnabled,
        flag: 'websiteChannel',
        label: 'Website',
      },
      {
        enabled: parsed.data.orderDisplayEnabled,
        flag: 'orderDisplayChannel',
        label: 'Order display',
      },
      {
        enabled: parsed.data.cardPaymentsEnabled,
        flag: 'cardPaymentChannel',
        label: 'Card payments',
      },
      {
        enabled: parsed.data.kioskEnabled,
        flag: 'kioskUrl',
        label: 'Kiosk',
      },
      {
        enabled: parsed.data.onscreenKeyboardEnabled,
        flag: 'onscreenKeyboard',
        label: 'On-screen keyboard',
      },
    ];
    for (const check of channelChecks) {
      if (check.enabled !== true) continue;
      const flagValue =
        entitlements.modules.basicSettings.limits?.[check.flag];
      if (typeof flagValue === 'boolean' && !flagValue) {
        return subscriptionPlanDeniedResponse(check.label);
      }
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
