import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const shapeSchema = z.enum(['CIRCLE', 'SQUARE', 'RECTANGLE']);

const patchSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  shape: shapeSchema.optional(),
  gridRow: z.number().int().min(0).max(39).optional(),
  gridCol: z.number().int().min(0).max(39).optional(),
  gridRowSpan: z.number().int().min(1).max(4).optional(),
  gridColSpan: z.number().int().min(1).max(4).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ tableId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'tables',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { tableId } = await resolveRouteParams(ctx.params, ['tableId']);

  const existing = await db.diningTable.findFirst({
    where: { id: tableId, restaurantId: auth.restaurant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
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

  const data = parsed.data;
  if (
    data.name === undefined &&
    data.sortOrder === undefined &&
    data.shape === undefined &&
    data.gridRow === undefined &&
    data.gridCol === undefined &&
    data.gridRowSpan === undefined &&
    data.gridColSpan === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const updated = await db.diningTable.update({
      where: { id: tableId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.shape !== undefined ? { shape: data.shape } : {}),
        ...(data.gridRow !== undefined ? { gridRow: data.gridRow } : {}),
        ...(data.gridCol !== undefined ? { gridCol: data.gridCol } : {}),
        ...(data.gridRowSpan !== undefined
          ? { gridRowSpan: data.gridRowSpan }
          : {}),
        ...(data.gridColSpan !== undefined
          ? { gridColSpan: data.gridColSpan }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        branchId: true,
        shape: true,
        gridRow: true,
        gridCol: true,
        gridRowSpan: true,
        gridColSpan: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'A table with this name already exists at this branch' },
        { status: 409 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ tableId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(undefined, {
    moduleKey: 'tables',
    action: 'delete',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { tableId } = await resolveRouteParams(ctx.params, ['tableId']);

  const existing = await db.diningTable.findFirst({
    where: { id: tableId, restaurantId: auth.restaurant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  await db.diningTable.delete({ where: { id: tableId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
