import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { resolveRouteId } from '@/lib/resolve-route-id';
import { responseFromStoredImage } from '@/lib/stored-image-response';

/**
 * Serves a single product image on demand (lazy).
 * Keeps list/JSON endpoints small by not embedding base64 in product lists.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const itemId = resolveRouteId((await ctx.params).itemId);
  if (!itemId) {
    return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
  }

  try {
    const item = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId: auth.restaurant.id },
      select: { imageUrl: true, updatedAt: true },
    });

    const raw = item?.imageUrl?.trim();
    if (!raw) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    const etag = item
      ? `"${item.updatedAt.getTime().toString(36)}-${itemId}"`
      : undefined;
    return await responseFromStoredImage(raw, {
      etag,
      ifNoneMatch: req.headers.get('if-none-match'),
    });
  } catch (e) {
    console.error('menu item image GET failed', e);
    return NextResponse.json(
      { error: 'Failed to load image' },
      { status: 500 }
    );
  }
}
