import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  shortLabel: z.string().max(20).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ variationId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'variations',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { variationId } = await resolveRouteParams(ctx.params, ['variationId']);

  const existing = await db.restaurantVariation.findFirst({
    where: { id: variationId, restaurantId: auth.restaurant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db.restaurantVariation.update({
    where: { id: variationId },
    data: {
      ...(parsed.data.name !== undefined
        ? { name: parsed.data.name.trim() }
        : {}),
      ...(parsed.data.shortLabel !== undefined
        ? {
            shortLabel:
              parsed.data.shortLabel?.trim() &&
              parsed.data.shortLabel.trim().length > 0
                ? parsed.data.shortLabel.trim()
                : null,
          }
        : {}),
      ...(parsed.data.sortOrder !== undefined
        ? { sortOrder: parsed.data.sortOrder }
        : {}),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ variationId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'variations',
    action: 'delete',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { variationId } = await resolveRouteParams(ctx.params, ['variationId']);

  const existing = await db.restaurantVariation.findFirst({
    where: { id: variationId, restaurantId: auth.restaurant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
  }

  await db.restaurantVariation.delete({ where: { id: variationId } });

  return NextResponse.json({ ok: true });
}
