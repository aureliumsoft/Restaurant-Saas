'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProgressiveMenuCategory } from '@/hooks/use-progressive-customer-menu';

type RestaurantMenuMeta = {
  themePrimaryColor?: string | null;
  serviceCharges?: unknown;
};

type UseProgressiveRestaurantMenuOptions = {
  enabled?: boolean;
};

export function useProgressiveRestaurantMenu<TItem extends { id: string }>({
  enabled = true,
}: UseProgressiveRestaurantMenuOptions = {}) {
  const [meta, setMeta] = useState<RestaurantMenuMeta | null>(null);
  const [categories, setCategories] = useState<
    ProgressiveMenuCategory<TItem>[]
  >([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [menuComplete, setMenuComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    setMeta(null);
    setCategories([]);
    setCategoriesLoading(false);
    setMenuComplete(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;
    const isStale = () => cancelled || runId !== runIdRef.current;

    (async () => {
      reset();
      setCategoriesLoading(true);

      try {
        const metaRes = await fetch('/api/restaurant/menu/categories', {
          cache: 'default',
        });
        const metaBody = (await metaRes.json().catch(() => ({}))) as {
          data?: {
            themePrimaryColor?: string | null;
            serviceCharges?: unknown;
            menus?: Array<{
              id: string;
              name: string;
              imageUrl?: string | null;
            }>;
          };
          error?: string;
        };
        if (isStale()) return;

        if (!metaRes.ok || !metaBody.data) {
          setError(
            typeof metaBody.error === 'string'
              ? metaBody.error
              : 'Failed to load menu categories.'
          );
          return;
        }

        const menus = metaBody.data.menus ?? [];
        setMeta({
          themePrimaryColor: metaBody.data.themePrimaryColor,
          serviceCharges: metaBody.data.serviceCharges,
        });

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

        // One category at a time — progressive paint, faster per-request work on server.
        for (const category of initial) {
          if (isStale()) return;

          setCategories((prev) =>
            prev.map((c) =>
              c.id === category.id ? { ...c, loading: true } : c
            )
          );

          try {
            const itemsRes = await fetch(
              `/api/restaurant/menu/categories/${encodeURIComponent(category.id)}`,
              { cache: 'default' }
            );
            const itemsBody = (await itemsRes.json().catch(() => ({}))) as {
              data?: { items?: TItem[] };
            };
            if (isStale()) return;

            const items = Array.isArray(itemsBody.data?.items)
              ? itemsBody.data!.items!
              : [];

            setCategories((prev) =>
              prev.map((c) =>
                c.id === category.id
                  ? { ...c, items, loaded: true, loading: false }
                  : c
              )
            );
          } catch {
            if (isStale()) return;
            setCategories((prev) =>
              prev.map((c) =>
                c.id === category.id
                  ? { ...c, loaded: true, loading: false }
                  : c
              )
            );
          }
        }

        if (!isStale()) setMenuComplete(true);
      } catch {
        if (!isStale()) {
          setError('Failed to load menu products for POS.');
          setCategoriesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, reset]);

  return {
    meta,
    categories,
    categoriesLoading,
    menuComplete,
    error,
    anyCategoryLoading: categories.some((c) => c.loading),
  };
}
