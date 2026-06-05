import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  shortLabel: z.string().max(20).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'product',
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rows = await db.restaurantVariation.findMany({
    where: { restaurantId: auth.restaurant.id },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'variations',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const maxOrder = await db.restaurantVariation.aggregate({
    where: { restaurantId: auth.restaurant.id },
    _max: { sortOrder: true },
  });

  const created = await db.restaurantVariation.create({
    data: {
      restaurantId: auth.restaurant.id,
      name: parsed.data.name.trim(),
      shortLabel:
        parsed.data.shortLabel?.trim() && parsed.data.shortLabel.trim().length > 0
          ? parsed.data.shortLabel.trim()
          : null,
      sortOrder:
        parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
