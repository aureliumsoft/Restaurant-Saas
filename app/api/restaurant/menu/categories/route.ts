import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { estimateDataUrlBytes, isAcceptedImageValue } from '@/lib/image-data-url';
import { loadRestaurantMenuCategoriesMeta } from '@/lib/menu/load-restaurant-menu-progressive';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const createCategorySchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    showInFront: z.boolean().optional(),
    imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
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

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const data = await loadRestaurantMenuCategoriesMeta(auth.restaurant.id);
    if (!data) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load menu categories' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKey: 'product',
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

  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const imageUrl =
    parsed.data.imageUrl && parsed.data.imageUrl.trim().length > 0
      ? parsed.data.imageUrl.trim()
      : null;

  try {
    const created = await db.menuCategory.create({
      data: {
        name: parsed.data.name.trim(),
        showInFront: parsed.data.showInFront ?? true,
        imageUrl,
        restaurantId: auth.restaurant.id,
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        showInFront: true,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
