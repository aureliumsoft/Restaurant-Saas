import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const patchSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
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

  const { tableId } = await ctx.params;

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

  if (parsed.data.name === undefined && parsed.data.sortOrder === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const updated = await db.diningTable.update({
      where: { id: tableId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      },
      select: { id: true, name: true, sortOrder: true, createdAt: true, updatedAt: true },
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

  const { tableId } = await ctx.params;

  const existing = await db.diningTable.findFirst({
    where: { id: tableId, restaurantId: auth.restaurant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  await db.diningTable.delete({ where: { id: tableId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
