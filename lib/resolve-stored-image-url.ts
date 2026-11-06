import { isHttpImageUrl } from '@/lib/image-data-url';

/**
 * Turn a DB image column into a browser-ready src.
 * Prefer public http(s) / Supabase URLs inline (no extra API hop).
 * Fall back to a lazy `/image` proxy only for legacy base64 still in the DB,
 * or when the caller only knows presence (empty `stored` + proxy).
 */
export function resolveStoredImageUrl(
  stored: string | null | undefined,
  fallbackProxy?: string | null
): string | null {
  const value = stored?.trim() ?? '';
  if (value && isHttpImageUrl(value)) return value;
  const proxy = fallbackProxy?.trim() || null;
  if (!value) return proxy;
  // Legacy base64 / data URL — never embed in JSON; use proxy when available.
  return proxy;
}

export function hasStoredImageValue(stored: string | null | undefined): boolean {
  return Boolean(stored?.trim());
}

/** True when the column already points at a CDN/public URL (not base64). */
export function isDirectStoredImageUrl(
  stored: string | null | undefined
): boolean {
  const value = stored?.trim() ?? '';
  return Boolean(value) && isHttpImageUrl(value);
}
