import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getBranchScopeFromRequest,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import {
  buildPosShiftPayload,
  getOpenPosShift,
  openPosShift,
} from '@/lib/pos-shift';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export async function POST(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      auth.restaurantId
    );

    let body: { branchId?: string | null } = {};
    try {
      body = (await req.json()) as { branchId?: string | null };
    } catch {
      // optional body
    }

    const branchIdFromBody =
      typeof body.branchId === 'string' ? body.branchId.trim() : '';
    let branchId = branchScope?.activeBranchId ?? null;
    if (branchIdFromBody) {
      const valid = await validateBranchForRestaurant(
        branchIdFromBody,
        auth.restaurantId
      );
      if (!valid) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      if (
        branchScope &&
        !branchScope.allowedBranchIds.includes(branchIdFromBody)
      ) {
        return NextResponse.json(
          { error: 'You do not have access to this branch.' },
          { status: 403 }
        );
      }
      branchId = branchIdFromBody;
    }

    const existing = await getOpenPosShift({
      restaurantId: auth.restaurantId,
      branchId,
    });
    if (existing) {
      const data = await buildPosShiftPayload(existing.id, {
        restaurantId: auth.restaurantId,
        branchId,
      });
      return NextResponse.json({ data });
    }

    const shift = await openPosShift({
      restaurantId: auth.restaurantId,
      branchId,
      userId: auth.userId,
    });
    if (!shift) {
      return NextResponse.json(
        { error: 'A shift is already open for this branch.' },
        { status: 409 }
      );
    }

    const data = await buildPosShiftPayload(shift.id, {
      restaurantId: auth.restaurantId,
      branchId,
    });
    if (!data) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('pos-shift start POST', error);
    return NextResponse.json(
      { error: 'Failed to start POS shift' },
      { status: 500 }
    );
  }
}
