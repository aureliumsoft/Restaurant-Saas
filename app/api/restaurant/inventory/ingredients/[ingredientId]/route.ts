import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { ingredientPatchSchema } from '@/lib/inventory/validation';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publishInventoryStockUpdate } from '@/lib/realtime/publish';

function lazyImageUrl(id: string): string {
  return `/api/restaurant/inventory/ingredients/${encodeURIComponent(id)}/image`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ingredientId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['inventory', 'product'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ingredientId } = await ctx.params;
  const row = await db.ingredient.findFirst({
    where: { id: ingredientId, restaurantId: auth.restaurant.id },
  });
  if (!row) {
    return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...row,
      hasImage: Boolean(row.imageUrl),
      imageUrl: row.imageUrl ? lazyImageUrl(row.id) : null,
      imageData: row.imageUrl,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ ingredientId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'inventory',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ingredientId } = await ctx.params;
  const existing = await db.ingredient.findFirst({
    where: { id: ingredientId, restaurantId: auth.restaurant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ingredientPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const row = await db.ingredient.update({
      where: { id: ingredientId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description?.trim() || null }
          : {}),
        ...(parsed.data.quantity !== undefined
          ? { quantity: parsed.data.quantity }
          : {}),
        ...(parsed.data.unit !== undefined ? { unit: parsed.data.unit } : {}),
        ...(parsed.data.isMajor !== undefined
          ? { isMajor: parsed.data.isMajor }
          : {}),
        ...(parsed.data.imageUrl !== undefined
          ? { imageUrl: parsed.data.imageUrl?.trim() || null }
          : {}),
        ...(parsed.data.sku !== undefined
          ? { sku: parsed.data.sku?.trim() || null }
          : {}),
        ...(parsed.data.minQuantity !== undefined
          ? { minQuantity: parsed.data.minQuantity }
          : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
      },
    });
    publishInventoryStockUpdate(auth.restaurant.id);
    return NextResponse.json({
      data: {
        ...row,
        hasImage: Boolean(row.imageUrl),
        imageUrl: row.imageUrl ? lazyImageUrl(row.id) : null,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'An ingredient with this name already exists.' },
        { status: 409 }
      );
    }
    console.error('[inventory] patch ingredient', e);
    return NextResponse.json(
      { error: 'Could not update ingredient.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ ingredientId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'inventory',
    action: 'delete',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ingredientId } = await ctx.params;
  const existing = await db.ingredient.findFirst({
    where: { id: ingredientId, restaurantId: auth.restaurant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
  }

  await db.ingredient.delete({ where: { id: ingredientId } });
  publishInventoryStockUpdate(auth.restaurant.id);
  return NextResponse.json({ ok: true });
}
