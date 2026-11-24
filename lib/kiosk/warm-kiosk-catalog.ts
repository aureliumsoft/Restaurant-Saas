import {
  fetchCustomerMenuProductDetail,
  KIOSK_DETAIL_CACHE_TTL_MS,
  retainCustomerMenuProductDetail,
  type CustomerMenuQuery,
} from '@/lib/menu/fetch-menu-product-detail';

export type KioskWarmProgress = {
  loaded: number;
  total: number;
};

const WARM_CONCURRENCY = 4;
const NEST_DEPTH = 4;

function collectNestedProductIds(detail: unknown): string[] {
  if (!detail || typeof detail !== 'object') return [];
  const groups =
    (detail as { attributeGroups?: unknown[] }).attributeGroups ?? [];
  const ids: string[] = [];
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    const row = group as {
      linkedProduct?: { id?: string; needsNestedSheet?: boolean } | null;
      linkedCategory?: {
        items?: Array<{ id?: string; needsNestedSheet?: boolean }>;
      } | null;
    };
    if (row.linkedProduct?.needsNestedSheet && row.linkedProduct.id) {
      ids.push(row.linkedProduct.id);
    }
    for (const item of row.linkedCategory?.items ?? []) {
      if (item?.needsNestedSheet && item.id) ids.push(item.id);
    }
  }
  return ids;
}

/**
 * Load every menu product, including sizes and recommendation trees, before
 * the kiosk opens. Later taps read this cache and do not wait on the network.
 */
export async function warmKioskCatalog(options: {
  categories: Array<{ id: string; productIds: string[] }>;
  query: CustomerMenuQuery;
  signal: { cancelled: () => boolean };
  onProgress: (progress: KioskWarmProgress) => void;
}): Promise<void> {
  const groups = options.categories.map((category) => ({
    id: category.id,
    productIds: [...new Set(category.productIds.filter(Boolean))],
  }));
  const total = groups.length;
  const pendingByCategory = new Map(
    groups.map((group) => [group.id, new Set(group.productIds)])
  );
  const menuSet = new Set(groups.flatMap((group) => group.productIds));
  const seen = new Set<string>();
  let loaded = 0;
  let frontier = [...menuSet];

  for (const [categoryId, pending] of pendingByCategory) {
    if (pending.size === 0) {
      loaded += 1;
      pendingByCategory.delete(categoryId);
    }
  }

  const report = () => {
    options.onProgress({ loaded: Math.min(loaded, total), total });
  };
  const markProduct = (id: string) => {
    if (!menuSet.has(id)) return;
    let changed = false;
    for (const [categoryId, pending] of pendingByCategory) {
      if (!pending.delete(id)) continue;
      changed = true;
      if (pending.size === 0) {
        loaded += 1;
        pendingByCategory.delete(categoryId);
      }
    }
    if (changed) report();
  };
  report();

  for (let depth = 0; depth < NEST_DEPTH && frontier.length > 0; depth += 1) {
    if (options.signal.cancelled()) return;
    const wave = [...new Set(frontier.filter((id) => !seen.has(id)))];
    if (wave.length === 0) return;
    for (const id of wave) seen.add(id);

    const nested: string[] = [];
    let cursor = 0;
    const workers = Math.min(WARM_CONCURRENCY, wave.length);

    await Promise.all(
      Array.from({ length: workers }, async () => {
        while (!options.signal.cancelled()) {
          const id = wave[cursor];
          cursor += 1;
          if (!id) return;
          try {
            const detail = await fetchCustomerMenuProductDetail(id, options.query, {
              ttlMs: KIOSK_DETAIL_CACHE_TTL_MS,
            });
            retainCustomerMenuProductDetail(
              id,
              options.query,
              KIOSK_DETAIL_CACHE_TTL_MS
            );
            nested.push(...collectNestedProductIds(detail));
          } catch {
            // A failed dish still counts so startup can finish.
          }
          markProduct(id);
        }
      })
    );

    frontier = nested.filter((id) => id && !seen.has(id));
  }
}
