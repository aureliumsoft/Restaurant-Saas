import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { resolveRouteId } from '@/lib/resolve-route-id';
import { responseFromStoredImage } from '@/lib/stored-image-response';

/**
 * Serves a category image on demand (lazy).
 * Keeps list/JSON endpoints small by not embedding base64 in category lists.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ categoryId: string }> }
) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const categoryId = resolveRouteId((await ctx.params).categoryId);
  if (!categoryId) {
    return NextResponse.json({ error: 'Missing category id' }, { status: 400 });
  }

  try {
    const category = await db.menuCategory.findFirst({
      where: { id: categoryId, restaurantId: auth.restaurant.id },
      select: { imageUrl: true, updatedAt: true },
    });

    const raw = category?.imageUrl?.trim();
    if (!raw) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'private, max-age=300' },
      });
    }

    const etag = category
      ? `"${category.updatedAt.getTime().toString(36)}-${categoryId}"`
      : undefined;
    return await responseFromStoredImage(raw, {
      etag,
      ifNoneMatch: req.headers.get('if-none-match'),
    });
  } catch (error) {
    console.error('restaurant category image GET failed', error);
    return NextResponse.json({ error: 'Failed to load image.' }, { status: 500 });
  }
}
