import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getBranchScopeFromRequest, validateBranchForRestaurant } from '@/lib/branch/branch-scope';
import {
  buildPosShiftPayload,
  buildPosShiftSummary,
  closePosShift,
  getOpenPosShift,
} from '@/lib/pos-shift';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      auth.restaurantId
    );
    const branchIdFromQuery = req.nextUrl.searchParams.get('branchId')?.trim();
    let branchId = branchScope?.activeBranchId ?? null;
    if (branchIdFromQuery) {
      const valid = await validateBranchForRestaurant(
        branchIdFromQuery,
        auth.restaurantId
      );
      if (!valid) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      if (
        branchScope &&
        !branchScope.allowedBranchIds.includes(branchIdFromQuery)
      ) {
        return NextResponse.json(
          { error: 'You do not have access to this branch.' },
          { status: 403 }
        );
      }
      branchId = branchIdFromQuery;
    }

    const summaryOnly =
      req.nextUrl.searchParams.get('summary') === '1' ||
      req.nextUrl.searchParams.get('summary') === 'true';

    if (summaryOnly) {
      const data = await buildPosShiftSummary({
        restaurantId: auth.restaurantId,
        branchId,
      });
      return NextResponse.json({ data });
    }

    const openShift = await getOpenPosShift({
      restaurantId: auth.restaurantId,
      branchId,
    });
    if (!openShift) {
      return NextResponse.json({ data: null });
    }
    const data = await buildPosShiftPayload(openShift.id, {
      restaurantId: auth.restaurantId,
      branchId,
    });
    if (!data) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('pos-shift GET', error);
    return NextResponse.json(
      { error: 'Failed to load POS shift' },
      { status: 500 }
    );
  }
}

const endShiftSchema = z.object({
  shiftId: z.string().uuid(),
  closingCashInLocker: z.number().min(0),
  notes: z.string().max(500).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = endShiftSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const closed = await closePosShift({
      shiftId: parsed.data.shiftId,
      restaurantId: auth.restaurantId,
      userId: auth.userId,
      closingCashInLocker: parsed.data.closingCashInLocker,
      notes: parsed.data.notes,
    });
    if (!closed) {
      return NextResponse.json(
        { error: 'Open shift not found or already closed.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        closedShift: closed,
      },
    });
  } catch (error) {
    console.error('pos-shift POST', error);
    return NextResponse.json(
      { error: 'Failed to end POS shift' },
      { status: 500 }
    );
  }
}
