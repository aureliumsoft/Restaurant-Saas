import { buildCustomerAttributeGroup } from '@/lib/menu/build-customer-attribute-group';
import type { AttributeGroup } from '@/components/order/product-customize-dialog';
import type { PersonalizeGroup } from '@/components/order/personalize-options-section';
import type { UiLanguage } from '@/lib/i18n/resources';

export type CustomerMenuQuery = {
  slug?: string | null;
  subdomain?: string | null;
  branchId?: string | null;
};

export type OptionNestedSheetPayload = {
  nestedAttributeGroups: AttributeGroup[];
  personalizeGroups: PersonalizeGroup[];
};

type DetailCacheEntry = {
  data: unknown;
  expiresAt: number;
};

/** Short TTL shared by prefetch and customize open. Live browse prices overlay on top. */
const DETAIL_CACHE_TTL_MS = 120_000;
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
  options?: { fresh?: boolean; shell?: boolean }
): string | null {
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (!slug && !subdomain) return null;
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  if (query.branchId?.trim()) params.set('branchId', query.branchId.trim());
  if (options?.fresh) params.set('fresh', '1');
  if (options?.shell) params.set('shell', '1');
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}?${params}`;
}

export function buildCustomerMenuItemGroupUrl(
  itemId: string,
  groupId: string,
  query: CustomerMenuQuery
): string | null {
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (!slug && !subdomain) return null;
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  if (query.branchId?.trim()) params.set('branchId', query.branchId.trim());
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}/groups/${encodeURIComponent(groupId)}?${params}`;
}

export type ProductDetailGroupHydrate = {
  groupId: string;
  sourceType?: string | null;
  linkedCategory?: {
    id?: string;
    name?: string;
    items?: unknown[];
  } | null;
  linkedProduct?: {
    id?: string;
    name?: string;
    attributeGroups?: unknown[] | null;
  } | null;
};

export type ProgressiveProductDetailShape = {
  attributeGroups?: Array<{
    id?: string;
    required?: boolean;
    sourceType?: string | null;
    linkedCategory?: {
      id?: string;
      name?: string;
      items?: unknown[] | null;
    } | null;
    linkedProduct?: {
      id?: string;
      name?: string;
      attributeGroups?: unknown[] | null;
      needsNestedSheet?: boolean;
    } | null;
  }> | null;
  progressiveShell?: boolean;
};

export type ProgressiveHydrateMeta = {
  hydratedGroupIds: string[];
  /** All required recommendation groups have been hydrated. */
  requiredComplete: boolean;
  /** Every shell group has been hydrated. */
  allComplete: boolean;
};

/** Merge one hydrated group into a progressive shell product. */
export function mergeProductDetailGroup<T extends ProgressiveProductDetailShape>(
  product: T,
  hydrate: ProductDetailGroupHydrate
): T {
  const groups = product.attributeGroups ?? [];
  return {
    ...product,
    progressiveShell: false,
    attributeGroups: groups.map((group) => {
      if (group.id !== hydrate.groupId) return group;
      if (hydrate.sourceType === 'PRODUCT' || hydrate.linkedProduct) {
        return {
          ...group,
          linkedProduct: hydrate.linkedProduct ?? group.linkedProduct,
        };
      }
      return {
        ...group,
        linkedCategory: hydrate.linkedCategory ?? group.linkedCategory,
      };
    }),
  };
}

/** Required groups first, then optional — keeps Add unblocked sooner. */
export function orderGroupsForProgressiveHydrate<
  T extends { id?: string; required?: boolean },
>(groups: T[] | null | undefined): T[] {
  const list = groups ?? [];
  const required = list.filter((g) => Boolean(g.required));
  const optional = list.filter((g) => !g.required);
  return [...required, ...optional];
}

export function isProgressiveRequiredComplete(
  groups: ProgressiveProductDetailShape['attributeGroups'],
  hydratedGroupIds: Iterable<string>
): boolean {
  const done = new Set(hydratedGroupIds);
  for (const g of groups ?? []) {
    if (!g.required || !g.id) continue;
    if (!done.has(g.id)) return false;
  }
  return true;
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
    if (data) cacheSet(customerDetailCache, url, data);
    return data;
  })().finally(() => {
    customerInflight.delete(url);
  });

  customerInflight.set(url, request);
  return request;
}

/** Shell only — never treated as a complete detail cache hit. */
export async function fetchCustomerMenuProductDetailShell<T>(
  itemId: string,
  query: CustomerMenuQuery
): Promise<T | null> {
  const url = buildCustomerMenuItemDetailUrl(itemId, query, { shell: true });
  if (!url) return null;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: T };
  return body.data ?? null;
}

export async function fetchCustomerMenuProductGroup(
  itemId: string,
  groupId: string,
  query: CustomerMenuQuery
): Promise<ProductDetailGroupHydrate | null> {
  const url = buildCustomerMenuItemGroupUrl(itemId, groupId, query);
  if (!url) return null;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    data?: ProductDetailGroupHydrate;
  };
  return body.data ?? null;
}

type ProgressiveLoadOptions<T extends ProgressiveProductDetailShape> = {
  force?: boolean;
  signal?: { cancelled: () => boolean };
  onShell?: (shell: T) => void;
  onGroup?: (
    product: T,
    hydrate: ProductDetailGroupHydrate,
    meta: ProgressiveHydrateMeta
  ) => void;
  /** Fires once when every required group has been hydrated. */
  onRequiredComplete?: (product: T) => void;
};

async function runProgressiveGroupHydrate<T extends ProgressiveProductDetailShape>(
  shell: T,
  fetchGroup: (groupId: string) => Promise<ProductDetailGroupHydrate | null>,
  options?: ProgressiveLoadOptions<T>
): Promise<T | null> {
  options?.onShell?.(shell);

  const ordered = orderGroupsForProgressiveHydrate(shell.attributeGroups);
  const hydratedGroupIds: string[] = [];
  let requiredNotified = false;
  let current: T = shell;

  for (const group of ordered) {
    if (options?.signal?.cancelled()) return null;
    const groupId = group.id;
    if (!groupId) continue;
    const hydrate = await fetchGroup(groupId);
    if (options?.signal?.cancelled()) return null;
    if (!hydrate) continue;
    current = mergeProductDetailGroup(current, hydrate);
    hydratedGroupIds.push(groupId);
    const requiredComplete = isProgressiveRequiredComplete(
      shell.attributeGroups,
      hydratedGroupIds
    );
    const allComplete = hydratedGroupIds.length >= ordered.length;
    const meta: ProgressiveHydrateMeta = {
      hydratedGroupIds: [...hydratedGroupIds],
      requiredComplete,
      allComplete,
    };
    options?.onGroup?.(current, hydrate, meta);
    if (requiredComplete && !requiredNotified) {
      requiredNotified = true;
      options?.onRequiredComplete?.(current);
    }
  }

  if (!requiredNotified) {
    options?.onRequiredComplete?.(current);
  }

  return current;
}

/**
 * Open customize fast: shell → hydrate required groups first, then optional.
 * Nested option trees stay deferred until nest-sheet open.
 */
export async function loadCustomerMenuProductDetailProgressive<
  T extends ProgressiveProductDetailShape,
>(
  itemId: string,
  query: CustomerMenuQuery,
  options?: ProgressiveLoadOptions<T>
): Promise<T | null> {
  const force = Boolean(options?.force);
  const fullUrl = buildCustomerMenuItemDetailUrl(itemId, query, {
    fresh: force,
  });

  const shell = await fetchCustomerMenuProductDetailShell<T>(itemId, query);
  if (!shell) return null;
  if (options?.signal?.cancelled()) return null;

  const current = await runProgressiveGroupHydrate(
    shell,
    (groupId) => fetchCustomerMenuProductGroup(itemId, groupId, query),
    options
  );
  if (!current || options?.signal?.cancelled()) return null;

  if (fullUrl) {
    const { progressiveShell: _shellFlag, ...rest } = current as T & {
      progressiveShell?: boolean;
    };
    void _shellFlag;
    const complete = { ...rest, progressiveShell: undefined } as T;
    cacheSet(customerDetailCache, fullUrl, complete);
    return complete;
  }

  return current;
}

export async function fetchRestaurantMenuProductDetailShell<T>(
  itemId: string
): Promise<T | null> {
  const res = await fetch(
    `/api/restaurant/menu/items/${encodeURIComponent(itemId)}?shell=1`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: T };
  return body.data ?? null;
}

export async function fetchRestaurantMenuProductGroup(
  itemId: string,
  groupId: string
): Promise<ProductDetailGroupHydrate | null> {
  const res = await fetch(
    `/api/restaurant/menu/items/${encodeURIComponent(itemId)}/groups/${encodeURIComponent(groupId)}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    data?: ProductDetailGroupHydrate;
  };
  return body.data ?? null;
}

/** POS progressive customize: shell → required groups → optional groups. */
export async function loadRestaurantMenuProductDetailProgressive<
  T extends ProgressiveProductDetailShape,
>(
  itemId: string,
  options?: ProgressiveLoadOptions<T>
): Promise<T | null> {
  const shell = await fetchRestaurantMenuProductDetailShell<T>(itemId);
  if (!shell) return null;
  if (options?.signal?.cancelled()) return null;

  const current = await runProgressiveGroupHydrate(
    shell,
    (groupId) => fetchRestaurantMenuProductGroup(itemId, groupId),
    options
  );
  if (!current || options?.signal?.cancelled()) return null;

  const key = `lite:v3:${itemId}`;
  const { progressiveShell: _shellFlag, ...rest } = current as T & {
    progressiveShell?: boolean;
  };
  void _shellFlag;
  const complete = { ...rest, progressiveShell: undefined } as T;
  cacheSet(restaurantDetailCache, key, complete);
  return complete;
}

export async function fetchRestaurantMenuProductDetail<T>(
  itemId: string,
  options?: { force?: boolean }
): Promise<T | null> {
  // Progressive shell→group cache (replaces heavy lite=1 blob for customize).
  const key = `lite:v3:${itemId}`;
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
    const data = await loadRestaurantMenuProductDetailProgressive<
      T & ProgressiveProductDetailShape
    >(itemId);
    return (data as T | null) ?? null;
  })().finally(() => {
    restaurantInflight.delete(key);
  });

  restaurantInflight.set(key, request);
  return request;
}

/** Prefetch is background-only — never starve a user-opened customize fetch. */
const PREFETCH_MAX_CONCURRENT = 1;
let prefetchActive = 0;
const prefetchWaiters: Array<() => void> = [];

function acquirePrefetchSlot(): Promise<void> {
  if (prefetchActive < PREFETCH_MAX_CONCURRENT) {
    prefetchActive += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    prefetchWaiters.push(() => {
      prefetchActive += 1;
      resolve();
    });
  });
}

function releasePrefetchSlot() {
  prefetchActive = Math.max(0, prefetchActive - 1);
  const next = prefetchWaiters.shift();
  if (next) next();
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
  void (async () => {
    await acquirePrefetchSlot();
    try {
      // Re-check after waiting — another warm may have finished.
      if (cacheGet(customerDetailCache, url) || customerInflight.has(url)) {
        return;
      }
      await fetchCustomerMenuProductDetail(itemId, query);
    } finally {
      releasePrefetchSlot();
    }
  })();
}

function buildNestedSheetPayload(
  optionId: string,
  detail: {
    attributeGroups?: Parameters<typeof buildCustomerAttributeGroup>[0][];
    personalizeGroups?: PersonalizeGroup[];
  },
  imageUrlForItem: (menuItemId: string) => string,
  lang: UiLanguage
): OptionNestedSheetPayload {
  const nestedAttributeGroups = (detail.attributeGroups ?? [])
    .filter((g) => Boolean(g?.id) && Boolean(g?.selectionType))
    .map((g) =>
      buildCustomerAttributeGroup(g, optionId, imageUrlForItem, lang)
    );

  return {
    nestedAttributeGroups,
    personalizeGroups: detail.personalizeGroups ?? [],
  };
}

/**
 * Load nested recommendation groups for one option card (on sheet open).
 * Progressive: category shells first, then each group's option cards.
 * Deeper nests stay deferred until that option is opened.
 */
export async function fetchOptionNestedSheetPayload(
  optionId: string,
  query: CustomerMenuQuery,
  imageUrlForItem: (menuItemId: string) => string,
  lang: UiLanguage = 'es',
  options?: {
    signal?: { cancelled: () => boolean };
    onProgress?: (payload: OptionNestedSheetPayload) => void;
  }
): Promise<OptionNestedSheetPayload | null> {
  const detail = await loadCustomerMenuProductDetailProgressive<{
    attributeGroups?: Parameters<typeof buildCustomerAttributeGroup>[0][];
    personalizeGroups?: PersonalizeGroup[];
  }>(optionId, query, {
    signal: options?.signal,
    onShell: (shell) => {
      options?.onProgress?.(
        buildNestedSheetPayload(optionId, shell, imageUrlForItem, lang)
      );
    },
    onGroup: (product) => {
      options?.onProgress?.(
        buildNestedSheetPayload(optionId, product, imageUrlForItem, lang)
      );
    },
  });
  if (!detail) return null;

  return buildNestedSheetPayload(optionId, detail, imageUrlForItem, lang);
}

/** POS nested recommendation sheet — same progressive category→cards path. */
export async function fetchRestaurantOptionNestedSheetPayload(
  optionId: string,
  imageUrlForItem: (menuItemId: string) => string,
  lang: UiLanguage = 'es',
  options?: {
    signal?: { cancelled: () => boolean };
    onProgress?: (payload: OptionNestedSheetPayload) => void;
  }
): Promise<OptionNestedSheetPayload | null> {
  const detail = await loadRestaurantMenuProductDetailProgressive<{
    attributeGroups?: Parameters<typeof buildCustomerAttributeGroup>[0][];
    personalizeGroups?: PersonalizeGroup[];
  }>(optionId, {
    signal: options?.signal,
    onShell: (shell) => {
      options?.onProgress?.(
        buildNestedSheetPayload(optionId, shell, imageUrlForItem, lang)
      );
    },
    onGroup: (product) => {
      options?.onProgress?.(
        buildNestedSheetPayload(optionId, product, imageUrlForItem, lang)
      );
    },
  });
  if (!detail) return null;

  return buildNestedSheetPayload(optionId, detail, imageUrlForItem, lang);
}

/** Warm the POS customize cache (hover / focus) without blocking UI. */
export function prefetchRestaurantMenuProductDetail(itemId: string): void {
  if (!itemId) return;
  const key = `lite:v3:${itemId}`;
  if (cacheGet(restaurantDetailCache, key)) return;
  if (restaurantInflight.has(key)) return;
  void (async () => {
    await acquirePrefetchSlot();
    try {
      if (cacheGet(restaurantDetailCache, key) || restaurantInflight.has(key)) {
        return;
      }
      await loadRestaurantMenuProductDetailProgressive(itemId);
    } finally {
      releasePrefetchSlot();
    }
  })();
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
