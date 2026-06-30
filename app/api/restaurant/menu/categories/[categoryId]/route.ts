import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { estimateDataUrlBytes, isAcceptedImageValue } from '@/lib/image-data-url';
import { loadRestaurantMenuCategoryItems } from '@/lib/menu/load-restaurant-menu-progressive';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

type RouteContext = { params: Promise<{ categoryId: string }> };

const patchCategorySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    showInFront: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.imageUrl === undefined) return;
    const image = val.imageUrl?.trim();
    if (!image) return;
    if (!isAcceptedImageValue(image)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Image must be an http/https URL or base64 image',
        path: ['imageUrl'],
      });
      return;
    }
    if (
      image.startsWith('data:image/') &&
      estimateDataUrlBytes(image) > 2 * 1024 * 1024
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Base64 image must be <= 2MB',
        path: ['imageUrl'],
      });
    }
  });

async function findOwnedCategory(restaurantId: string, categoryId: string) {
  return db.menuCategory.findFirst({
    where: { id: categoryId, restaurantId },
    select: { id: true, name: true },
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { categoryId } = await context.params;
    const trimmed = categoryId?.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Missing category id.' }, { status: 400 });
    }

    const data = await loadRestaurantMenuCategoryItems(
      auth.restaurant.id,
      trimmed
    );
    if (!data) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load category products' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'product',
    action: 'edit',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { categoryId } = await context.params;
  const trimmed = categoryId?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'Missing category id.' }, { status: 400 });
  }

  const existing = await findOwnedCategory(auth.restaurant.id, trimmed);
  if (!existing) {
    return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchCategorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: {
    name?: string;
    showInFront?: boolean;
    sortOrder?: number;
    imageUrl?: string | null;
  } = {};

  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name.trim();
  }
  if (parsed.data.showInFront !== undefined) {
    data.showInFront = parsed.data.showInFront;
  }
  if (parsed.data.sortOrder !== undefined) {
    data.sortOrder = parsed.data.sortOrder;
  }
  if (parsed.data.imageUrl !== undefined) {
    data.imageUrl =
      parsed.data.imageUrl && parsed.data.imageUrl.trim().length > 0
        ? parsed.data.imageUrl.trim()
        : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  try {
    const updated = await db.menuCategory.update({
      where: { id: trimmed },
      data,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        showInFront: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'product',
    action: 'delete',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { categoryId } = await context.params;
  const trimmed = categoryId?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'Missing category id.' }, { status: 400 });
  }

  const existing = await findOwnedCategory(auth.restaurant.id, trimmed);
  if (!existing) {
    return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  }

  const [linkCount, primaryItemCount] = await Promise.all([
    db.menuItemCategory.count({ where: { categoryId: trimmed } }),
    db.menuItem.count({
      where: { restaurantId: auth.restaurant.id, categoryId: trimmed },
    }),
  ]);

  if (linkCount > 0 || primaryItemCount > 0) {
    return NextResponse.json(
      {
        error:
          'Cannot delete a category that still has products. Reassign or remove products first.',
      },
      { status: 409 }
    );
  }

  try {
    await db.menuCategory.delete({ where: { id: trimmed } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
