import { encodeUrlId, isEncodedUrlId } from '@/lib/url-id';

/**
 * Prepare an id for a URL path segment.
 * On the server, plain database ids are encrypted. On the client, pass through
 * (callers should use ids already encoded by the API or `/api/url-id/encode`).
 */
export function pathSegmentId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  if (isEncodedUrlId(trimmed)) return trimmed;
  if (typeof window !== 'undefined') return trimmed;
  return encodeUrlId(trimmed);
}
