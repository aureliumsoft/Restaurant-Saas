import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { isDataImageUrl, isHttpImageUrl } from '@/lib/image-data-url';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';

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
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          ETag: etag,
        },
      });
    }

    return new NextResponse(null, { status: 404 });
  } catch (e) {
    console.error('customer menu item image GET failed', e);
    return NextResponse.json(
      { error: 'Failed to load image' },
      { status: 500 }
    );
  }
}
