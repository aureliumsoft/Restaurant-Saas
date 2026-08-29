import { publicId } from '@/lib/public-id';
import { pathSegmentId } from '@/lib/url-id-path';

/** Build a path/query segment for a database id (encrypted when possible). */
export function urlSegment(id: string, urlId?: string | null): string {
  if (urlId?.trim()) return publicId(id, urlId);
  return pathSegmentId(id);
}
