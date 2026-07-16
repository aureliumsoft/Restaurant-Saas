'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ProgressiveMenuCategory<TItem> = {
  id: string;
  name: string;
  imageUrl?: string | null;
  items: TItem[];
  loaded: boolean;
  loading: boolean;
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
};

const DEFAULT_BATCH = 24;

export function useProgressiveCustomerMenu<TItem>({
  categoriesUrl,
  categoryItemsUrl,
  enabled = true,
  batchSize = DEFAULT_BATCH,
}: UseProgressiveCustomerMenuOptions) {
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

  useEffect(() => {
    if (!enabled || !categoriesUrl) {
      reset();
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;

    const isStale = () => cancelled || runId !== runIdRef.current;

    (async () => {
      reset();
      setCategoriesLoading(true);
      setError(null);

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

        // Categories sequentially; within each category, batches of products.
        for (const category of initial) {
          if (isStale()) return;

          setCategories((prev) =>
            prev.map((c) =>
              c.id === category.id ? { ...c, loading: true } : c
            )
          );

          let page = 1;
          let hasMore = true;
          let accumulated: TItem[] = [];

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

              const batch = Array.isArray(itemsBody.data?.items)
                ? itemsBody.data!.items!
                : [];
              accumulated = [...accumulated, ...batch];
              hasMore = Boolean(itemsBody.data?.hasMore) && batch.length > 0;

              // Paint after each batch so the UI populates progressively.
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
              hasMore = false;
            }
          }

          if (isStale()) return;
          setCategories((prev) =>
            prev.map((c) =>
              c.id === category.id
                ? { ...c, items: accumulated, loaded: true, loading: false }
                : c
            )
          );
        }

        if (!isStale()) setMenuComplete(true);
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
  }, [categoriesUrl, categoryItemsUrl, enabled, reset, batchSize]);

  return {
    restaurantMeta,
    categories,
    categoriesLoading,
    menuComplete,
    error,
    anyCategoryLoading: categories.some((c) => c.loading),
  };
}
