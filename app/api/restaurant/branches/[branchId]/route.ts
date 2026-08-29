import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const openingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string().trim().max(5).optional().default(''),
  closeTime: z.string().trim().max(5).optional().default(''),
});

const updateBranchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  phone: z.string().trim().max(60).optional().or(z.literal('')),
  openingHours: z.array(openingHourSchema).optional().default([]),
  slotDurationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional().default(30),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ branchId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'branched',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { branchId } = await resolveRouteParams(ctx.params, ['branchId']);
    const json = await req.json().catch(() => null);
    const parsed = updateBranchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await db.branch.updateMany({
      where: {
        id: branchId,
        restaurantId: auth.restaurantId,
      },
      data: {
        name: parsed.data.name.trim(),
        address: parsed.data.address?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        openingHours: parsed.data.openingHours,
        slotDurationMinutes: parsed.data.slotDurationMinutes,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const branch = await db.branch.findUnique({
      where: { id: branchId },
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

    return NextResponse.json({ data: branch }, { status: 200 });
  } catch (error) {
    console.error('update restaurant branch', error);
    return NextResponse.json(
      { error: 'Failed to update branch.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ branchId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(_req, {
      moduleKey: 'branched',
      action: 'delete',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { branchId } = await resolveRouteParams(ctx.params, ['branchId']);
    const totalBranches = await db.branch.count({
      where: { restaurantId: auth.restaurantId },
    });
    if (totalBranches <= 1) {
      return NextResponse.json(
        { error: 'You must keep at least one branch.' },
        { status: 400 }
      );
    }

    const deleted = await db.branch.deleteMany({
      where: {
        id: branchId,
        restaurantId: auth.restaurantId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('delete restaurant branch', error);
    return NextResponse.json(
      { error: 'Failed to delete branch.' },
      { status: 500 }
    );
  }
}
