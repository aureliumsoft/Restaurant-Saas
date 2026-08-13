import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getBranchScopeFromRequest,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import {
  loadOpenTableOrderCards,
  openTableOrdersWhere,
} from '@/lib/table-open-orders';
import { db } from '@/lib/db';

/**
 * Open table tabs: dine-in orders not fully settled (unpaid and/or not in kitchen).
 * Used by the POS table sheet (POS + kiosk sources).
 */
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

    const countOnly =
      req.nextUrl.searchParams.get('count') === '1' ||
      req.nextUrl.searchParams.get('count') === 'true';

    if (countOnly) {
      const count = await db.order.count({
        where: openTableOrdersWhere(auth.restaurantId, branchId),
      });
      return NextResponse.json({ count });
    }

    const cards = await loadOpenTableOrderCards({
      restaurantId: auth.restaurantId,
      branchId,
    });

    return NextResponse.json({
      data: cards,
      branchId,
    });
  } catch (e) {
    console.error('table-orders open GET', e);
    return NextResponse.json(
      { error: 'Failed to load open table orders' },
      { status: 500 }
    );
  }
}
