import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import {
  listBranchStockForIngredients,
  setBranchIngredientQuantity,
} from '@/lib/inventory/branch-stock';
import { ingredientPatchSchema } from '@/lib/inventory/validation';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publishInventoryStockUpdate } from '@/lib/realtime/publish';
import { resolveRouteParams } from '@/lib/resolve-route-id';
import { ingredientApiPath } from '@/lib/dashboard-paths';

function lazyImageUrl(id: string): string {
  return `${ingredientApiPath(id)}/image`;
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

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const branchId = branchScope?.activeBranchId ?? null;

  const { ingredientId } = await resolveRouteParams(ctx.params, ['ingredientId']);
  const row = await db.ingredient.findFirst({
    where: { id: ingredientId, restaurantId: auth.restaurant.id },
  });
  if (!row) {
    return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
  }

  let quantity = row.quantity;
  let minQuantity = row.minQuantity;
  if (branchId) {
    const stock = await listBranchStockForIngredients(branchId, [row.id]);
    const branchRow = stock.get(row.id);
    quantity = branchRow?.quantity ?? 0;
    minQuantity = branchRow?.minQuantity ?? row.minQuantity;
  }

  return NextResponse.json({
    data: {
      ...row,
      quantity,
      minQuantity,
      branchId,
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

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.user.id,
    auth.restaurant.id
  );
  const branchId = branchScope?.activeBranchId ?? null;

  const { ingredientId } = await resolveRouteParams(ctx.params, ['ingredientId']);
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

  if (
    (parsed.data.quantity !== undefined || parsed.data.minQuantity !== undefined) &&
    !branchId
  ) {
    return NextResponse.json(
      { error: 'Select a branch to adjust stock.' },
      { status: 400 }
    );
  }

  try {
    const row = await db.$transaction(async (tx) => {
      if (parsed.data.quantity !== undefined && branchId) {
        await setBranchIngredientQuantity(
          tx,
          branchId,
          ingredientId,
          parsed.data.quantity
        );
      }
      if (parsed.data.minQuantity !== undefined && branchId) {
        await tx.branchIngredientStock.upsert({
          where: {
            branchId_ingredientId: { branchId, ingredientId },
          },
          create: {
            branchId,
            ingredientId,
            quantity: 0,
            minQuantity: parsed.data.minQuantity,
          },
          update: { minQuantity: parsed.data.minQuantity },
        });
      }

      return tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description?.trim() || null }
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
          ...(parsed.data.isActive !== undefined
            ? { isActive: parsed.data.isActive }
            : {}),
          ...(parsed.data.minQuantity !== undefined && !branchId
            ? { minQuantity: parsed.data.minQuantity }
            : {}),
        },
      });
    });

    let quantity = row.quantity;
    if (branchId && parsed.data.quantity !== undefined) {
      quantity = parsed.data.quantity;
    } else if (branchId) {
      const stock = await listBranchStockForIngredients(branchId, [ingredientId]);
      quantity = stock.get(ingredientId)?.quantity ?? 0;
    }

    publishInventoryStockUpdate(auth.restaurant.id, branchId);
    return NextResponse.json({
      data: {
        ...row,
        quantity,
        branchId,
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

  const { ingredientId } = await resolveRouteParams(ctx.params, ['ingredientId']);
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
