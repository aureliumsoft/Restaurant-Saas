import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';
import { responseFromStoredImage } from '@/lib/stored-image-response';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ itemId: string }> };

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

/** Public lazy image for kiosk / online menus. */
export async function GET(req: NextRequest, context: RouteContext) {
  const { itemId } = await context.params;
  if (!itemId?.trim()) {
    return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
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

    const item = await db.menuItem.findFirst({
      where: { id: itemId.trim(), restaurantId },
      select: { imageUrl: true, updatedAt: true },
    });

    const raw = item?.imageUrl?.trim();
    const etag = item
      ? `"${item.updatedAt.getTime().toString(36)}-${itemId}"`
      : undefined;
    return await responseFromStoredImage(raw, {
      etag,
      ifNoneMatch: req.headers.get('if-none-match'),
    });
  } catch (e) {
    console.error('customer menu item image GET failed', e);
    return NextResponse.json(
      { error: 'Failed to load image' },
      { status: 500 }
    );
  }
}
