/** Normalize updatedAt / revision values into a stable cache-bust token. */
export function imageCacheVersion(
  value: Date | string | number | null | undefined
): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? String(ms) : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum > 0) return String(Math.trunc(asNum));
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

/** Append `v=<revision>` so browsers fetch a new image after uploads. */
export function withImageCacheBust(
  url: string,
  version: Date | string | number | null | undefined
): string {
  const v = imageCacheVersion(version);
  if (!v || !url) return url;
  if (/[?&]v=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}
