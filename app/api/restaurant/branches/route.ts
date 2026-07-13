import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { branchCapacityAllows } from '@/lib/subscription-plan-features';
import { getRestaurantPlanFeatures, subscriptionPlanDeniedResponse } from '@/lib/subscription-plan-enforcement';

const openingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string().trim().max(5).optional().default(''),
  closeTime: z.string().trim().max(5).optional().default(''),
});

const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  phone: z.string().trim().max(60).optional().or(z.literal('')),
  openingHours: z.array(openingHourSchema).optional().default([]),
  slotDurationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional().default(30),
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

    const branches = await db.branch.findMany({
      where: { restaurantId: auth.restaurantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        openingHours: true,
        slotDurationMinutes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: branches }, { status: 200 });
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
    const planFeatures = await getRestaurantPlanFeatures(auth.restaurantId);
    if (!branchCapacityAllows(existingCount, 1, planFeatures)) {
      return subscriptionPlanDeniedResponse(
        `Your plan allows up to ${Number.isFinite(planFeatures.maxBranches) ? planFeatures.maxBranches : 'unlimited'} branch(es).`
      );
    }

    const branch = await db.branch.create({
      data: {
        restaurantId: auth.restaurantId,
        name: parsed.data.name.trim(),
        address: parsed.data.address?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        openingHours: parsed.data.openingHours,
        slotDurationMinutes: parsed.data.slotDurationMinutes,
      },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        openingHours: true,
        slotDurationMinutes: true,
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
