import { decodeUrlId, isEncodedUrlId } from '@/lib/url-id';

/**
 * Decode an encrypted URL id from a route param or query value.
 * Plain UUIDs/cuids are returned unchanged (legacy links).
 */
export function resolveRouteId(value: string | undefined | null): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';

  let segment = trimmed;
  try {
    segment = decodeURIComponent(trimmed);
  } catch {
    segment = trimmed;
  }

  if (!isEncodedUrlId(segment)) return segment;

  try {
    return decodeUrlId(segment);
  } catch {
    return segment;
  }
}

/** Decode multiple route params in one call. */
export async function resolveRouteParams<
  P extends Record<string, string | undefined>,
>(params: Promise<P>, keys?: (keyof P)[]): Promise<P> {
  const raw = await params;
  const out = { ...raw };
  const toResolve = keys ?? (Object.keys(raw) as (keyof P)[]);
  for (const key of toResolve) {
    const value = raw[key];
    if (typeof value === 'string') {
      (out as Record<string, string>)[key as string] = resolveRouteId(value);
    }
  }
  return out;
}

export function resolveRouteIdsList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => resolveRouteId(part.trim()))
    .filter(Boolean);
}

export function resolveQueryParam(
  searchParams: URLSearchParams,
  key: string
): string | null {
  const value = searchParams.get(key)?.trim();
  if (!value) return null;
  return resolveRouteId(value);
}

export async function resolveRouteParam(
  params: Promise<Record<string, string | undefined>>,
  key: string
): Promise<string> {
  const resolved = await params;
  return resolveRouteId(resolved[key]);
}
