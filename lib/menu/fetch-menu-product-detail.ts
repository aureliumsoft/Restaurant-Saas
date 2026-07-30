export type CustomerMenuQuery = {
  slug?: string | null;
  subdomain?: string | null;
};

type DetailCacheEntry = {
  data: unknown;
  expiresAt: number;
};

const DETAIL_CACHE_TTL_MS = 60_000;
const customerDetailCache = new Map<string, DetailCacheEntry>();
const restaurantDetailCache = new Map<string, DetailCacheEntry>();

function cacheGet<T>(
  map: Map<string, DetailCacheEntry>,
  key: string
): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    map.delete(key);
    return null;
  }
  return hit.data as T;
}

function cacheSet(
  map: Map<string, DetailCacheEntry>,
  key: string,
  data: unknown
) {
  map.set(key, { data, expiresAt: Date.now() + DETAIL_CACHE_TTL_MS });
}

export function buildCustomerMenuItemDetailUrl(
  itemId: string,
  query: CustomerMenuQuery
): string | null {
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (!slug && !subdomain) return null;
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}?${params}`;
}

export async function fetchCustomerMenuProductDetail<T>(
  itemId: string,
  query: CustomerMenuQuery
): Promise<T | null> {
  const url = buildCustomerMenuItemDetailUrl(itemId, query);
  if (!url) return null;
  const cached = cacheGet<T>(customerDetailCache, url);
  if (cached) return cached;
  const res = await fetch(url, { cache: 'default' });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: T };
  const data = body.data ?? null;
  if (data) cacheSet(customerDetailCache, url, data);
  return data;
}

export async function fetchRestaurantMenuProductDetail<T>(
  itemId: string
): Promise<T | null> {
  const key = `lite:${itemId}`;
  const cached = cacheGet<T>(restaurantDetailCache, key);
  if (cached) return cached;
  const res = await fetch(
    `/api/restaurant/menu/items/${encodeURIComponent(itemId)}?lite=1`,
    { cache: 'default' }
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: T };
  const data = body.data ?? null;
  if (data) cacheSet(restaurantDetailCache, key, data);
  return data;
}

export function productNeedsDetailFetch(product: {
  attributeGroups?: Array<{
    sourceType?: string | null;
    required?: boolean;
    linkedProduct?: { id?: string; name?: string } | null;
    linkedCategory?: { items?: unknown[] | null } | null;
  }> | null;
  personalizeGroups?: Array<{ parentName?: string; options?: unknown[] }> | null;
}): boolean {
  if ((product.personalizeGroups?.length ?? 0) > 0) {
    if (!product.personalizeGroups?.[0]?.parentName) return true;
  }
  for (const g of product.attributeGroups ?? []) {
    if (g.sourceType === 'CATEGORY') {
      if (!g.linkedCategory?.items?.length) return true;
    }
    if (g.sourceType === 'PRODUCT' && g.required && !g.linkedProduct?.name) {
      return true;
    }
  }
  return false;
}
