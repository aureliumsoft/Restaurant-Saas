export type CustomerMenuQuery = {
  slug?: string | null;
  subdomain?: string | null;
  branchId?: string | null;
};

type DetailCacheEntry = {
  data: unknown;
  expiresAt: number;
};

/** Prefetch-only TTL. Customize open always force-refreshes so add-on prices stay current. */
const DETAIL_CACHE_TTL_MS = 15_000;
const customerDetailCache = new Map<string, DetailCacheEntry>();
const restaurantDetailCache = new Map<string, DetailCacheEntry>();
const restaurantInflight = new Map<string, Promise<unknown>>();
const customerInflight = new Map<string, Promise<unknown>>();

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

function cacheDeleteMatching(
  map: Map<string, DetailCacheEntry>,
  match: (key: string) => boolean
) {
  for (const key of map.keys()) {
    if (match(key)) map.delete(key);
  }
}

export function buildCustomerMenuItemDetailUrl(
  itemId: string,
  query: CustomerMenuQuery,
  options?: { fresh?: boolean }
): string | null {
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (!slug && !subdomain) return null;
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  if (query.branchId?.trim()) params.set('branchId', query.branchId.trim());
  if (options?.fresh) params.set('fresh', '1');
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}?${params}`;
}

export function invalidateCustomerMenuProductDetail(itemId?: string) {
  if (!itemId) {
    customerDetailCache.clear();
    return;
  }
  const needle = encodeURIComponent(itemId);
  cacheDeleteMatching(customerDetailCache, (key) => key.includes(needle));
}

export function invalidateRestaurantMenuProductDetail(itemId?: string) {
  if (!itemId) {
    restaurantDetailCache.clear();
    return;
  }
  cacheDeleteMatching(restaurantDetailCache, (key) => key.includes(itemId));
}

export async function fetchCustomerMenuProductDetail<T>(
  itemId: string,
  query: CustomerMenuQuery,
  options?: { force?: boolean }
): Promise<T | null> {
  const force = Boolean(options?.force);
  const url = buildCustomerMenuItemDetailUrl(itemId, query, { fresh: force });
  if (!url) return null;

  // Drop any prior warm (non-fresh) entry for this item.
  if (force) {
    invalidateCustomerMenuProductDetail(itemId);
  } else {
    const cached = cacheGet<T>(customerDetailCache, url);
    if (cached) return cached;
  }

  const existing = customerInflight.get(url) as Promise<T | null> | undefined;
  if (existing && !force) return existing;

  const request = (async () => {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: force ? { 'Cache-Control': 'no-cache' } : undefined,
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { data?: T };
    const data = body.data ?? null;
    // Only warm the short TTL cache for prefetch; force responses are not reused.
    if (data && !force) cacheSet(customerDetailCache, url, data);
    return data;
  })().finally(() => {
    customerInflight.delete(url);
  });

  customerInflight.set(url, request);
  return request;
}

export async function fetchRestaurantMenuProductDetail<T>(
  itemId: string,
  options?: { force?: boolean }
): Promise<T | null> {
  // Bump key when lite select shape changes so stale nests are not reused.
  const key = `lite:v2:${itemId}`;
  const force = Boolean(options?.force);

  if (force) {
    restaurantDetailCache.delete(key);
  } else {
    const cached = cacheGet<T>(restaurantDetailCache, key);
    if (cached) return cached;
  }

  const existing = restaurantInflight.get(key) as Promise<T | null> | undefined;
  if (existing && !force) return existing;

  const request = (async () => {
    const res = await fetch(
      `/api/restaurant/menu/items/${encodeURIComponent(itemId)}?lite=1`,
      {
        cache: 'no-store',
        headers: force ? { 'Cache-Control': 'no-cache' } : undefined,
      }
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { data?: T };
    const data = body.data ?? null;
    if (data && !force) cacheSet(restaurantDetailCache, key, data);
    return data;
  })().finally(() => {
    restaurantInflight.delete(key);
  });

  restaurantInflight.set(key, request);
  return request;
}

/** Warm the customer menu customize cache (hover / focus / touch) without blocking UI. */
export function prefetchCustomerMenuProductDetail(
  itemId: string,
  query: CustomerMenuQuery
): void {
  if (!itemId) return;
  const url = buildCustomerMenuItemDetailUrl(itemId, query);
  if (!url) return;
  if (cacheGet(customerDetailCache, url)) return;
  if (customerInflight.has(url)) return;
  void fetchCustomerMenuProductDetail(itemId, query);
}

/** Warm the POS customize cache (hover / focus) without blocking UI. */
export function prefetchRestaurantMenuProductDetail(itemId: string): void {
  if (!itemId) return;
  const key = `lite:v2:${itemId}`;
  if (cacheGet(restaurantDetailCache, key)) return;
  if (restaurantInflight.has(key)) return;
  void fetchRestaurantMenuProductDetail(itemId);
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
    if (g.sourceType === 'PRODUCT') {
      if (!g.linkedProduct?.name) return true;
      const nested = (
        g.linkedProduct as { attributeGroups?: unknown[] | null }
      ).attributeGroups;
      if (!Array.isArray(nested)) return true;
    }
  }
  return false;
}

/**
 * Overlay live catalog prices onto recommendation / nested add-on items so Add
 * buttons match the storefront grid when browse data is already loaded.
 */
export function overlayLiveCatalogPrices<
  T extends {
    items?: Array<{
      menuItemId: string;
      price: number;
      salePrice: number | null;
      nestedAttributeGroups?: T[] | null;
    }>;
  },
>(
  groups: T[],
  priceById: Map<string, { price: number; salePrice: number | null }>
): T[] {
  if (priceById.size === 0) return groups;
  return groups.map((group) => ({
    ...group,
    items: (group.items ?? []).map((item) => {
      const live = priceById.get(item.menuItemId);
      return {
        ...item,
        price: live?.price ?? item.price,
        salePrice: live ? live.salePrice : item.salePrice,
        nestedAttributeGroups: item.nestedAttributeGroups
          ? overlayLiveCatalogPrices(item.nestedAttributeGroups, priceById)
          : item.nestedAttributeGroups,
      };
    }),
  }));
}
