import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';
import { responseFromStoredImage } from '@/lib/stored-image-response';

export const runtime = 'nodejs';

async function resolveRestaurantId(
  slug?: string | null,
  subdomain?: string | null
): Promise<string | null> {
  const s = slug?.trim();
  if (s) {
    const row = await db.restaurant.findUnique({
      where: { slug: s },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  const sub = subdomain?.trim();
  if (sub) {
    const row = await db.restaurant.findUnique({
      where: { subdomain: sub },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  return null;
}

type RouteContext = { params: Promise<{ categoryId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { categoryId } = await context.params;
  if (!categoryId?.trim()) {
    return NextResponse.json({ error: 'Missing category id' }, { status: 400 });
  }

  const resolved = resolveCustomerMenuQuery(req);
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  try {
    const restaurantId = await resolveRestaurantId(
      resolved.slug,
      resolved.subdomain
    );
    if (!restaurantId) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const category = await db.menuCategory.findFirst({
      where: { id: categoryId.trim(), restaurantId },
      select: { imageUrl: true, updatedAt: true },
    });

    const etag = category
      ? `"${category.updatedAt.getTime().toString(36)}-${categoryId}"`
      : undefined;
    return await responseFromStoredImage(category?.imageUrl, {
      etag,
      ifNoneMatch: req.headers.get('if-none-match'),
    });
  } catch (error) {
    console.error('customer category image GET failed', error);
    return NextResponse.json({ error: 'Failed to load image.' }, { status: 500 });
  }
}
