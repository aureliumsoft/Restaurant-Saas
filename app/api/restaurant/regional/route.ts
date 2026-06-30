import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  defaultCountryForCurrency,
  defaultCurrencyForCountry,
  isRestaurantCountryCode,
  isRestaurantCurrencyCode,
  parseRestaurantRegionalSettings,
  RESTAURANT_REGIONAL_DB_SELECT,
} from '@/lib/restaurant-regional';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publishConfigUpdate } from '@/lib/realtime/publish';

const regionalPatchSchema = z
  .object({
    currencyCode: z.string().min(3).max(3),
    countryCode: z.string().length(2),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!isRestaurantCurrencyCode(val.currencyCode)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Currency must be EUR or PKR.',
        path: ['currencyCode'],
      });
    }
    if (!isRestaurantCountryCode(val.countryCode)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Country must be Spain (ES) or Pakistan (PK).',
        path: ['countryCode'],
      });
    }
  });

async function syncPaymentCredentialsRegional(
  restaurantId: string,
  currencyCode: string,
  countryCode: string
) {
  const currency = currencyCode.toUpperCase();
  const country = countryCode.toUpperCase();

  await db.restaurantPayPalCredentials.updateMany({
    where: { restaurantId },
    data: { currency, countryCode: country },
  });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantForOwnerRequest(req);
    if ('error' in auth) {
      if (auth.status === 404) {
        return NextResponse.json({ data: null }, { status: 200 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const row = await db.restaurant.findUnique({
      where: { id: auth.restaurant.id },
      select: RESTAURANT_REGIONAL_DB_SELECT,
    });

    return NextResponse.json(
      { data: parseRestaurantRegionalSettings(row) },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching restaurant regional settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch regional settings.' },
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
    const parsed = regionalPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let currencyCode = parsed.data.currencyCode.trim().toUpperCase();
    let countryCode = parsed.data.countryCode.trim().toUpperCase();

    const countryCurrency = defaultCurrencyForCountry(countryCode);
    const currencyCountry = defaultCountryForCurrency(currencyCode);
    if (currencyCode === 'EUR' && countryCode === 'PK') {
      countryCode = 'ES';
    } else if (currencyCode === 'PKR' && countryCode === 'ES') {
      countryCode = 'PK';
    } else if (countryCurrency !== currencyCode) {
      countryCode = currencyCountry;
    }

    const updated = await db.restaurant.update({
      where: { id: auth.restaurant.id },
      data: { currencyCode, countryCode },
      select: RESTAURANT_REGIONAL_DB_SELECT,
    });

    await syncPaymentCredentialsRegional(
      auth.restaurant.id,
      currencyCode,
      countryCode
    );

    publishConfigUpdate('config.regional', auth.restaurant.id);

    return NextResponse.json(
      { data: parseRestaurantRegionalSettings(updated) },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating restaurant regional settings:', error);
    return NextResponse.json(
      { error: 'Failed to update regional settings.' },
      { status: 500 }
    );
  }
}
