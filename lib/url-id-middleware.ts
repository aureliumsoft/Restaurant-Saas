import {
  decodeUrlId,
  isEncodedUrlId,
  URL_ID_QUERY_PARAM_KEYS,
} from '@/lib/url-id';

function safeDecodeURIComponent(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Online order flow keeps the encrypted session id visible in the browser URL. */
function isOrderFlowIdSegment(pathname: string, filteredIndex: number): boolean {
  if (filteredIndex !== 2) return false;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'order') return false;
  const type = parts[1]?.toLowerCase().replace(/-/g, '') ?? '';
  return type === 'delivery' || type === 'pickup';
}

function rewritePathSegment(
  pathname: string,
  filteredIndex: number,
  segment: string
): string {
  if (!segment) return segment;
  const decoded = safeDecodeURIComponent(segment);
  if (!isEncodedUrlId(decoded)) return segment;
  if (isOrderFlowIdSegment(pathname, filteredIndex)) return segment;
  try {
    return encodeURIComponent(decodeUrlId(decoded));
  } catch {
    return segment;
  }
}

export function rewritePathnameForUrlIds(pathname: string): string {
  const parts = pathname.split('/');
  const filteredIndices: number[] = [];
  parts.forEach((part, index) => {
    if (part) filteredIndices.push(index);
  });

  return parts
    .map((part, index) => {
      if (!part) return part;
      const filteredIndex = filteredIndices.indexOf(index);
      return rewritePathSegment(pathname, filteredIndex, part);
    })
    .join('/');
}

export function rewriteSearchParamsForUrlIds(
  searchParams: URLSearchParams
): boolean {
  let changed = false;
  for (const key of URL_ID_QUERY_PARAM_KEYS) {
    const value = searchParams.get(key);
    if (!value || !isEncodedUrlId(value)) continue;
    try {
      searchParams.set(key, decodeUrlId(value));
      changed = true;
    } catch {
      // leave invalid token as-is
    }
  }
  return changed;
}
