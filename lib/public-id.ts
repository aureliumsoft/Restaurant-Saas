import { isEncodedUrlId } from '@/lib/url-id-shared';

/** Prefer `urlId` from API when building public URLs. */
export function publicId(
  id: string,
  urlId?: string | null | undefined
): string {
  const enc = urlId?.trim();
  if (enc) return enc;
  const trimmed = id.trim();
  if (isEncodedUrlId(trimmed)) return trimmed;
  return trimmed;
}

export function publicQueryParam(
  name: string,
  id: string,
  urlId?: string | null
): string {
  return `${name}=${encodeURIComponent(publicId(id, urlId))}`;
}
