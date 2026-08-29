import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import {
  stockBlockErrorForRestaurant,
  stockLinesFromUnknownCart,
} from '@/lib/inventory/assert-payment-stock';
import { branchIdFromOrderPayload } from '@/lib/inventory/branch-stock';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const slug =
    json && typeof json === 'object'
      ? String((json as { restaurantSlug?: unknown }).restaurantSlug ?? '').trim()
      : '';
  if (!slug) {
    return NextResponse.json(
      { error: 'restaurantSlug is required' },
      { status: 400 }
    );
  }

  const lines = stockLinesFromUnknownCart(json);
  if (!lines) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const branchId = branchIdFromOrderPayload(json);

  try {
    const stockError = await stockBlockErrorForRestaurant(
      restaurant.id,
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
