'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProgressiveMenuCategory } from '@/hooks/use-progressive-customer-menu';
import { isBrowserOffline } from '@/lib/offline/db';
import {
  getOfflineCache,
  OFFLINE_CACHE_KEYS,
  setOfflineCache,
} from '@/lib/offline/local-cache';

type RestaurantMenuMeta = {
  themePrimaryColor?: string | null;
  serviceCharges?: unknown;
};

type PosMenuCachePayload<TItem> = {
  meta: RestaurantMenuMeta;
  categories: ProgressiveMenuCategory<TItem>[];
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
  const [fromOfflineCache, setFromOfflineCache] = useState(false);
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    setMeta(null);
    setCategories([]);
    setCategoriesLoading(false);
    setMenuComplete(false);
    setError(null);
    setFromOfflineCache(false);
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

      const applyCache = async () => {
        const cached = await getOfflineCache<PosMenuCachePayload<TItem>>(
          OFFLINE_CACHE_KEYS.posMenu
        );
        if (!cached || isStale()) return false;
        setMeta(cached.meta);
        setCategories(
          cached.categories.map((c) => ({
            ...c,
            loaded: true,
            loading: false,
          }))
        );
        setCategoriesLoading(false);
        setMenuComplete(true);
        setFromOfflineCache(true);
        setError(null);
        return true;
      };

      try {
        if (isBrowserOffline()) {
          const ok = await applyCache();
          if (!ok && !isStale()) {
            setError('You are offline and no cached POS menu is available.');
            setCategoriesLoading(false);
          }
          return;
        }

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
          const ok = await applyCache();
          if (!ok) {
            setError(
              typeof metaBody.error === 'string'
                ? metaBody.error
                : 'Failed to load menu categories.'
            );
          }
          return;
        }

        const menus = metaBody.data.menus ?? [];
        const nextMeta: RestaurantMenuMeta = {
          themePrimaryColor: metaBody.data.themePrimaryColor,
          serviceCharges: metaBody.data.serviceCharges,
        };
        setMeta(nextMeta);

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

        const loadedCategories: ProgressiveMenuCategory<TItem>[] = [];

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

            const nextCat: ProgressiveMenuCategory<TItem> = {
              ...category,
              items,
              loaded: true,
              loading: false,
            };
            loadedCategories.push(nextCat);

            setCategories((prev) =>
              prev.map((c) => (c.id === category.id ? nextCat : c))
            );
          } catch {
            if (isStale()) return;
            const nextCat: ProgressiveMenuCategory<TItem> = {
              ...category,
              items: [],
              loaded: true,
              loading: false,
            };
            loadedCategories.push(nextCat);
            setCategories((prev) =>
              prev.map((c) => (c.id === category.id ? nextCat : c))
            );
          }
        }

        if (!isStale()) {
          setMenuComplete(true);
          void setOfflineCache(OFFLINE_CACHE_KEYS.posMenu, {
            meta: nextMeta,
            categories: loadedCategories,
          } satisfies PosMenuCachePayload<TItem>);
        }
      } catch {
        if (isStale()) return;
        const ok = await applyCache();
        if (!ok) {
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
    fromOfflineCache,
    anyCategoryLoading: categories.some((c) => c.loading),
  };
}
