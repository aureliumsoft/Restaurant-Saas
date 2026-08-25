import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';
import { responseFromStoredImage } from '@/lib/stored-image-response';

export const runtime = 'nodejs';

async function resolveRestaurantId(
  slug?: string | null,
  subdomain?: string | null
): Promise<{ id: string; updatedAt: Date } | null> {
  const s = slug?.trim();
  if (s) {
    return db.restaurant.findUnique({
      where: { slug: s },
      select: { id: true, updatedAt: true },
    });
  }
  const sub = subdomain?.trim();
  if (sub) {
    return db.restaurant.findUnique({
      where: { subdomain: sub },
      select: { id: true, updatedAt: true },
    });
  }
  return null;
}

/** Decode stored logo/banner base64 (data URLs) into a real image response. */
export async function GET(req: NextRequest) {
  const resolved = resolveCustomerMenuQuery(req);
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const kind = req.nextUrl.searchParams.get('kind')?.trim() || 'logo';
  const index = Number(req.nextUrl.searchParams.get('index') ?? '0');

  try {
    const restaurant = await resolveRestaurantId(resolved.slug, resolved.subdomain);
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const row = await db.restaurant.findUnique({
      where: { id: restaurant.id },
      select: {
        logoUrl: true,
        mainBannerUrl: true,
        menuBannerUrls: true,
        updatedAt: true,
      },
    });
    if (!row) {
      return new NextResponse(null, { status: 404 });
    }

    let raw: string | null = null;
    if (kind === 'logo') raw = row.logoUrl;
    else if (kind === 'mainBanner') raw = row.mainBannerUrl;
    else if (kind === 'menuBanner') {
      const urls = Array.isArray(row.menuBannerUrls) ? row.menuBannerUrls : [];
      raw = typeof urls[index] === 'string' ? urls[index] : null;
    } else {
      return NextResponse.json({ error: 'Unknown image kind.' }, { status: 400 });
    }

    const etag = `"${row.updatedAt.getTime().toString(36)}-${kind}-${index}"`;
    return await responseFromStoredImage(raw, {
      etag,
      ifNoneMatch: req.headers.get('if-none-match'),
    });
  } catch (error) {
    console.error('customer restaurant media GET failed', error);
    return NextResponse.json({ error: 'Failed to load image.' }, { status: 500 });
  }
}
