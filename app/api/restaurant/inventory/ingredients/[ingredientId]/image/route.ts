import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { isDataImageUrl, isHttpImageUrl } from '@/lib/image-data-url';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

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
  const item = await db.ingredient.findFirst({
    where: { id: ingredientId, restaurantId: auth.restaurant.id },
    select: { imageUrl: true, updatedAt: true },
  });

  const raw = item?.imageUrl?.trim();
  if (!raw) {
    return new NextResponse(null, { status: 404 });
  }

  if (isHttpImageUrl(raw)) {
    return NextResponse.redirect(raw, 302);
  }

  if (isDataImageUrl(raw) || raw.startsWith('data:image/')) {
    const commaIdx = raw.indexOf(',');
    if (commaIdx <= 0) {
      return new NextResponse(null, { status: 404 });
    }
    const meta = raw.slice(0, commaIdx);
    const b64 = raw.slice(commaIdx + 1).replace(/\s+/g, '');
    const contentType =
      meta.match(/^data:([^;]+)/i)?.[1]?.trim() || 'image/jpeg';
    const buffer = Buffer.from(b64, 'base64');
    const etag = `"${item!.updatedAt.getTime().toString(36)}-${buffer.length.toString(36)}"`;
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304 });
    }
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
        ETag: etag,
      },
    });
  }

  return new NextResponse(null, { status: 404 });
}
