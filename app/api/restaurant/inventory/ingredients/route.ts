import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';
import { ingredientCreateSchema } from '@/lib/inventory/validation';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publishInventoryStockUpdate } from '@/lib/realtime/publish';

function lazyImageUrl(id: string): string {
  return `/api/restaurant/inventory/ingredients/${encodeURIComponent(id)}/image`;
}

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['inventory', 'product'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const activeOnly = req.nextUrl.searchParams.get('active') !== '0';
  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const where: Prisma.IngredientWhereInput = {
    restaurantId: auth.restaurant.id,
    ...(activeOnly ? { isActive: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const total = await db.ingredient.count({ where });
  const safePage = clampPage(page, total, pageSize);
  const rows = await db.ingredient.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      description: true,
      quantity: true,
      unit: true,
      isMajor: true,
      sku: true,
      minQuantity: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const withImage = await db.ingredient.findMany({
    where: {
      id: { in: rows.map((r) => r.id) },
      AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
    },
    select: { id: true },
  });
  const hasImage = new Set(withImage.map((r) => r.id));

  return NextResponse.json(
    {
      data: rows.map((r) => ({
        ...r,
        hasImage: hasImage.has(r.id),
        imageUrl: hasImage.has(r.id) ? lazyImageUrl(r.id) : null,
      })),
      meta: buildPaginationMeta(safePage, pageSize, total),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'inventory',
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

  const parsed = ingredientCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  try {
    const row = await db.ingredient.create({
      data: {
        restaurantId: auth.restaurant.id,
        name,
        description: parsed.data.description?.trim() || null,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        isMajor: parsed.data.isMajor ?? false,
        imageUrl: parsed.data.imageUrl?.trim() || null,
        sku: parsed.data.sku?.trim() || null,
        minQuantity: parsed.data.minQuantity ?? null,
      },
    });
    publishInventoryStockUpdate(auth.restaurant.id);
    return NextResponse.json(
      {
        data: {
          ...row,
          hasImage: Boolean(row.imageUrl),
          imageUrl: row.imageUrl ? lazyImageUrl(row.id) : null,
        },
      },
      { status: 201 }
    );
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
    console.error('[inventory] create ingredient', e);
    return NextResponse.json(
      { error: 'Could not create ingredient.' },
      { status: 500 }
    );
  }
}
