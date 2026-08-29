import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import {
  stockBlockErrorForRestaurant,
  stockLinesFromUnknownCart,
} from '@/lib/inventory/assert-payment-stock';
import { branchIdFromOrderPayload } from '@/lib/inventory/branch-stock';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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

  const lines = stockLinesFromUnknownCart(json);
  if (!lines) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.userId,
    auth.restaurantId
  );
  const branchId =
    branchIdFromOrderPayload(json) ?? branchScope?.activeBranchId ?? null;

  try {
    const stockError = await stockBlockErrorForRestaurant(
      auth.restaurantId,
      lines,
      branchId
    );
    if (stockError) {
      return NextResponse.json({ error: stockError }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Could not check ingredient stock' },
      { status: 500 }
    );
  }
}
