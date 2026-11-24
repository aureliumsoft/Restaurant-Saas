'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ProgressiveMenuCategory<TItem> = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items: TItem[];
  loaded: boolean;
  loading: boolean;
  failed?: boolean;
};

type UseProgressiveCustomerMenuOptions = {
  categoriesUrl: string | null;
  /** Build URL for a category page. page is 1-based. */
  categoryItemsUrl: (
    categoryId: string,
    page: number,
    limit: number
  ) => string | null;
  enabled?: boolean;
  /** Products per request batch (default 24). */
  batchSize?: number;
  /** How many categories to fetch at once (default 1). */
  categoryConcurrency?: number;
  /**
   * When set, the menu is one request. Category-by-category fetching is the
   * fallback when this is omitted.
   */
  browseUrl?: string | null;
  /**
   * When set, a finished menu is kept for the visit and reused on the next
   * mount instead of downloading every category again.
   */
  retainKey?: string | null;
};

const DEFAULT_BATCH = 24;
const RETAIN_PREFIX = 'foodluk-menu-retain:';

type RetainedMenu<TItem> = {
  restaurantMeta: Record<string, unknown> | null;
  categories: ProgressiveMenuCategory<TItem>[];
  complete: true;
};

const retainedMenus = new Map<string, RetainedMenu<unknown>>();

function readRetainedMenu<TItem>(
  key: string | null | undefined
): RetainedMenu<TItem> | null {
  if (!key) return null;
  const memory = retainedMenus.get(key) as RetainedMenu<TItem> | undefined;
  if (memory?.complete) return memory;
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RETAIN_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RetainedMenu<TItem>;
    if (!parsed?.complete || !Array.isArray(parsed.categories)) return null;
    retainedMenus.set(key, parsed as RetainedMenu<unknown>);
    return parsed;
  } catch {
    return null;
  }
}

function writeRetainedMenu<TItem>(key: string, value: RetainedMenu<TItem>) {
  retainedMenus.set(key, value as RetainedMenu<unknown>);
  try {
    sessionStorage.setItem(RETAIN_PREFIX + key, JSON.stringify(value));
  } catch {
    // A full store still leaves the in-memory copy for this page.
  }
}

export function useProgressiveCustomerMenu<TItem>({
  categoriesUrl,
  categoryItemsUrl,
  enabled = true,
  batchSize = DEFAULT_BATCH,
  categoryConcurrency = 1,
  browseUrl = null,
  retainKey = null,
}: UseProgressiveCustomerMenuOptions) {
  const [reloadKey, setReloadKey] = useState(0);
  const [restaurantMeta, setRestaurantMeta] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [categories, setCategories] = useState<ProgressiveMenuCategory<TItem>[]>(
    []
  );
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [menuComplete, setMenuComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    setRestaurantMeta(null);
    setCategories([]);
    setCategoriesLoading(false);
    setMenuComplete(false);
    setError(null);
  }, []);

  useLayoutEffect(() => {
    const retained = readRetainedMenu<TItem>(retainKey);
    if (!retained) return;
    setRestaurantMeta(retained.restaurantMeta);
    setCategories(retained.categories);
    setMenuComplete(true);
    setCategoriesLoading(false);
    setError(null);
  }, [retainKey]);

  useEffect(() => {
    if (!enabled || (!categoriesUrl && !browseUrl)) {
      reset();
      return;
    }

    const retained = readRetainedMenu<TItem>(retainKey);
    if (retained) {
      setRestaurantMeta(retained.restaurantMeta);
      setCategories(retained.categories);
      setMenuComplete(true);
      setCategoriesLoading(false);
      setError(null);
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;

    const isStale = () => cancelled || runId !== runIdRef.current;

    (async () => {
      reset();
      setCategoriesLoading(true);
      setError(null);

      if (browseUrl) {
        try {
          const browseRes = await fetch(browseUrl, { cache: 'default' });
          const browseBody = (await browseRes.json().catch(() => ({}))) as {
            data?: Record<string, unknown> | null;
            error?: string;
          };
          if (isStale()) return;
          if (!browseRes.ok || !browseBody.data) {
            setError(
              typeof browseBody.error === 'string'
                ? browseBody.error
                : 'Could not load menu.'
            );
            setCategoriesLoading(false);
            return;
          }
          const menus = Array.isArray(browseBody.data.menus)
            ? (browseBody.data.menus as Array<{
                id: string;
                name: string;
                imageUrl?: string | null;
                items?: TItem[];
              }>)
            : [];
          const { menus: _menus, ...meta } = browseBody.data;
          const loaded: ProgressiveMenuCategory<TItem>[] = menus.map((c) => ({
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl ?? null,
            items: Array.isArray(c.items) ? c.items : [],
            loaded: true,
            loading: false,
          }));
          setRestaurantMeta(meta);
          setCategories(loaded);
          setCategoriesLoading(false);
          if (retainKey) {
            writeRetainedMenu(retainKey, {
              restaurantMeta: meta,
              categories: loaded,
              complete: true,
            });
          }
          setMenuComplete(true);
        } catch {
          if (!isStale()) {
            setError('Could not load menu.');
            setCategoriesLoading(false);
          }
        }
        return;
      }

      if (!categoriesUrl) return;

      try {
        const metaRes = await fetch(categoriesUrl, { cache: 'default' });
        const metaBody = (await metaRes.json().catch(() => ({}))) as {
          data?: Record<string, unknown> | null;
          error?: string;
        };
        if (isStale()) return;

        if (!metaRes.ok || !metaBody.data) {
          setError(
            typeof metaBody.error === 'string'
              ? metaBody.error
              : 'Could not load menu categories.'
          );
          setCategoriesLoading(false);
          return;
        }

        const menus = Array.isArray(metaBody.data.menus)
          ? (metaBody.data.menus as Array<{
              id: string;
              name: string;
              imageUrl?: string | null;
            }>)
          : [];

        const { menus: _menus, ...meta } = metaBody.data;
        setRestaurantMeta(meta);

        const initial: ProgressiveMenuCategory<TItem>[] = menus.map((c) => ({
          id: c.id,
          name: c.name,
          imageUrl: c.imageUrl ?? null,
          items: [],
          loaded: false,
          loading: false,
        }));
        setCategories(initial);
        setCategoriesLoading(false);
        const loadedById = new Map<string, ProgressiveMenuCategory<TItem>>();

        const loadCategory = async (
          category: ProgressiveMenuCategory<TItem>
        ) => {
          if (isStale()) return;

          setCategories((prev) =>
            prev.map((c) =>
              c.id === category.id ? { ...c, loading: true } : c
            )
          );

          let page = 1;
          let hasMore = true;
          let failed = false;
          let accumulated: TItem[] = [];
          const remember = (loaded: boolean, loading: boolean) => {
            loadedById.set(category.id, {
              ...category,
              items: accumulated,
              loaded,
              loading,
            });
          };

          while (hasMore) {
            if (isStale()) return;

            const itemsUrl = categoryItemsUrl(category.id, page, batchSize);
            if (!itemsUrl) {
              hasMore = false;
              break;
            }

            try {
              const itemsRes = await fetch(itemsUrl, { cache: 'default' });
              const itemsBody = (await itemsRes.json().catch(() => ({}))) as {
                data?: {
                  items?: TItem[];
                  hasMore?: boolean;
                  total?: number;
                };
                error?: string;
              };
              if (isStale()) return;
              if (!itemsRes.ok) {
                failed = true;
                hasMore = false;
                break;
              }

              const batch = Array.isArray(itemsBody.data?.items)
                ? itemsBody.data!.items!
                : [];
              accumulated = [...accumulated, ...batch];
              hasMore = Boolean(itemsBody.data?.hasMore) && batch.length > 0;

              remember(!hasMore, hasMore);
              setCategories((prev) =>
                prev.map((c) =>
                  c.id === category.id
                    ? {
                        ...c,
                        items: accumulated,
                        loaded: !hasMore,
                        loading: hasMore,
                      }
                    : c
                )
              );

              page += 1;
              if (batch.length === 0) hasMore = false;
            } catch {
              if (isStale()) return;
              failed = true;
              hasMore = false;
            }
          }

          if (isStale()) return;
          remember(!failed, false);
          setCategories((prev) =>
            prev.map((c) =>
              c.id === category.id
                ? {
                    ...c,
                    items: accumulated,
                    loaded: !failed,
                    loading: false,
                    failed,
                  }
                : c
            )
          );
        };

        const workers = Math.max(
          1,
          Math.min(categoryConcurrency, initial.length || 1)
        );
        let cursor = 0;
        await Promise.all(
          Array.from({ length: workers }, async () => {
            while (!isStale()) {
              const category = initial[cursor];
              cursor += 1;
              if (!category) return;
              await loadCategory(category);
            }
          })
        );

        if (!isStale()) {
          if (retainKey) {
            writeRetainedMenu(retainKey, {
              restaurantMeta: meta,
              categories: initial.map(
                (category) =>
                  loadedById.get(category.id) ?? {
                    ...category,
                    loaded: true,
                    loading: false,
                  }
              ),
              complete: true,
            });
          }
          setMenuComplete(true);
        }
      } catch {
        if (!isStale()) {
          setError('Could not load menu.');
          setCategoriesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    categoriesUrl,
    categoryItemsUrl,
    enabled,
    reset,
    batchSize,
    categoryConcurrency,
    browseUrl,
    retainKey,
    reloadKey,
  ]);

  return {
    restaurantMeta,
    categories,
    categoriesLoading,
    menuComplete,
    error,
    reload: () => setReloadKey((value) => value + 1),
    anyCategoryLoading: categories.some((c) => c.loading),
  };
}
