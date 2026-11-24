import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { assertCreateCap } from '@/lib/subscription-plan-enforcement';
import { isValidIanaTimeZone, resolveBranchTimeZone } from '@/lib/branch-timezone';
import { normalizeOpeningHours } from '@/lib/order-time-slots';
import { Prisma } from '@prisma/client';

const openingHourSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string().trim().optional(),
  closeTime: z.string().trim().optional(),
});

const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  phone: z.string().trim().max(60).optional().or(z.literal('')),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  deliveryRadiusKm: z.number().min(0).max(100).optional().nullable(),
  openingHours: z
    .array(openingHourSchema)
    .optional()
    .default([])
    .transform((rows) => normalizeOpeningHours(rows)),
  timeZone: z.string().trim().max(80).optional().default(''),
});

export async function GET(_req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(_req, {
      moduleKeys: ['branched', 'pos'],
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const sellableOnly =
      _req.nextUrl.searchParams.get('sellableOnly') === '1';

    const branches = await db.branch.findMany({
      where: {
        restaurantId: auth.restaurantId,
        ...(sellableOnly ? { isActive: true } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
        deliveryRadiusKm: true,
        openingHours: true,
        timeZone: true,
        isActive: true,
        planQuotaLocked: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        data: branches.map((branch) => ({
          ...branch,
          openingHours: normalizeOpeningHours(branch.openingHours),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('restaurant branches', error);
    return NextResponse.json(
      { error: 'Failed to load branches.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'branched',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const json = await req.json().catch(() => null);
    const parsed = createBranchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existingCount = await db.branch.count({
      where: { restaurantId: auth.restaurantId },
    });
    const limitDenied = await assertCreateCap(
      auth.restaurantId,
      'branches',
      existingCount,
      'Branches'
    );
    if (limitDenied) return limitDenied;

    if (parsed.data.timeZone && !isValidIanaTimeZone(parsed.data.timeZone)) {
      return NextResponse.json({ error: 'Invalid timezone.' }, { status: 400 });
    }
    const restaurant = await db.restaurant.findUnique({
      where: { id: auth.restaurantId },
      select: { countryCode: true },
    });
    const timeZone = resolveBranchTimeZone(
      parsed.data.timeZone,
      restaurant?.countryCode
    );

    const branch = await db.branch.create({
      data: {
        restaurantId: auth.restaurantId,
        name: parsed.data.name.trim(),
        address: parsed.data.address?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        deliveryRadiusKm: parsed.data.deliveryRadiusKm ?? null,
        openingHours: parsed.data.openingHours as Prisma.InputJsonValue,
        timeZone,
      },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
        deliveryRadiusKm: true,
        openingHours: true,
        timeZone: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: branch }, { status: 201 });
  } catch (error) {
    console.error('create restaurant branch', error);
    return NextResponse.json(
      { error: 'Failed to create branch.' },
      { status: 500 }
    );
  }
}
