import { NextResponse } from 'next/server';

import { isHttpImageUrl } from '@/lib/image-data-url';

function sniffContentType(buffer: Buffer, fallback: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (buffer.toString('utf8', 0, Math.min(buffer.length, 64)).includes('<svg')) {
    return 'image/svg+xml';
  }
  return fallback;
}

function decodeBase64Image(b64: string): Buffer | null {
  const normalized = b64
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalized) return null;
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : `${normalized}${'='.repeat(4 - (normalized.length % 4))}`;
  try {
    const buffer = Buffer.from(padded, 'base64');
    return buffer.length >= 24 ? buffer : null;
  } catch {
    return null;
  }
}

function imageResponse(
  buffer: Buffer,
  contentType: string,
  options?: { etag?: string; ifNoneMatch?: string | null }
): NextResponse {
  const type = sniffContentType(buffer, contentType);
  const etag = options?.etag;
  if (etag && options?.ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 });
  }
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      ...(etag ? { ETag: etag } : {}),
    },
  });
}

/** Decode a DB image value (data URL, raw base64, or http URL) into image bytes. */
export async function responseFromStoredImage(
  raw: string | null | undefined,
  options?: { etag?: string; ifNoneMatch?: string | null }
): Promise<NextResponse> {
  if (!raw?.trim()) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        // Browser/CDN can cache “no image” so POS does not re-hit auth on every render.
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  const value = raw.trim();
  if (isHttpImageUrl(value)) {
    try {
      const upstream = await fetch(value, { redirect: 'follow' });
      if (!upstream.ok) {
        return new NextResponse(null, {
          status: 404,
          headers: { 'Cache-Control': 'private, max-age=120' },
        });
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length < 24) {
        return new NextResponse(null, {
          status: 404,
          headers: { 'Cache-Control': 'private, max-age=120' },
        });
      }
      const upstreamType = upstream.headers.get('content-type') || 'image/jpeg';
      return imageResponse(buffer, upstreamType, options);
    } catch {
      return NextResponse.redirect(value, 302);
    }
  }

  let contentType = 'image/jpeg';
  let b64 = value;

  if (/^data:/i.test(value)) {
    const commaIdx = value.indexOf(',');
    if (commaIdx <= 0) return new NextResponse(null, { status: 404 });
    const meta = value.slice(0, commaIdx);
    contentType = meta.match(/^data:([^;]+)/i)?.[1]?.trim() || 'image/jpeg';
    b64 = value.slice(commaIdx + 1);
  }

  const buffer = decodeBase64Image(b64);
  if (!buffer) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'private, max-age=120' },
    });
  }

  return imageResponse(buffer, contentType, options);
}

export function hasStoredImage(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function publicRestaurantImageUrls(
  slug: string,
  row: {
    logoUrl?: string | null;
    mainBannerUrl?: string | null;
    menuBannerUrls?: string[] | null;
  }
) {
  const base = (kind: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({ slug, kind });
    if (extra) {
      for (const [key, value] of Object.entries(extra)) params.set(key, value);
    }
    return `/api/customer/restaurant/media?${params.toString()}`;
  };

  return {
    logoUrl: hasStoredImage(row.logoUrl) ? base('logo') : null,
    mainBannerUrl: hasStoredImage(row.mainBannerUrl) ? base('mainBanner') : null,
    menuBannerUrls: (row.menuBannerUrls ?? [])
      .map((url, index) =>
        hasStoredImage(url) ? base('menuBanner', { index: String(index) }) : null
      )
      .filter((url): url is string => Boolean(url)),
  };
}

export function customerCategoryImageUrl(
  categoryId: string,
  query: { slug?: string | null; subdomain?: string | null }
): string {
  const params = new URLSearchParams();
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  const qs = params.toString();
  return `/api/customer/menu/categories/${encodeURIComponent(categoryId)}/image${
    qs ? `?${qs}` : ''
  }`;
}
