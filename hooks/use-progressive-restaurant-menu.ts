'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PosCustomizeIndex } from '@/lib/menu/assemble-pos-customize';
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';
import { readCachedPosBranchId } from '@/lib/pos-branch-memory';

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
  dineInPaymentTiming?: string | null;
  fulfillmentSettings?: {
    deliveryEnabled?: boolean;
    dineInEnabled?: boolean;
    cardPaymentsEnabled?: boolean;
  };
};

type PosMenuCachePayload<TItem> = {
  meta: RestaurantMenuMeta;
  categories: ProgressiveMenuCategory<TItem>[];
  customizeIndex?: PosCustomizeIndex | null;
};

type UseProgressiveRestaurantMenuOptions = {
  enabled?: boolean;
};

export function useProgressiveRestaurantMenu<TItem extends { id: string }>({
  enabled = true,
}: UseProgressiveRestaurantMenuOptions = {}) {
  const { activeBranchId } = useBranchContext();
  const menuBranchId = activeBranchId || readCachedPosBranchId();
  const [meta, setMeta] = useState<RestaurantMenuMeta | null>(null);
  const [categories, setCategories] = useState<
    ProgressiveMenuCategory<TItem>[]
  >([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [customizeIndex, setCustomizeIndex] = useState<PosCustomizeIndex | null>(
    null
  );
  const [menuComplete, setMenuComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromOfflineCache, setFromOfflineCache] = useState(false);
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    setMeta(null);
    setCategories([]);
    setCustomizeIndex(null);
    setCategoriesLoading(false);
    setMenuComplete(false);
    setError(null);
    setFromOfflineCache(false);
  }, []);

  useEffect(() => {
    if (!enabled || !menuBranchId) {
      reset();
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;
    const isStale = () => cancelled || runId !== runIdRef.current;

    (async () => {
      setError(null);
      setFromOfflineCache(false);

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
        setCustomizeIndex(cached.customizeIndex ?? null);
        setCategoriesLoading(false);
        setMenuComplete(true);
        setFromOfflineCache(true);
        setError(null);
        return true;
      };

      // Paint cached menu immediately, then refresh in background.
      const hadCache = await applyCache();
      if (isStale()) return;

      if (!hadCache) {
        setCategoriesLoading(true);
        setMenuComplete(false);
      }

      try {
        if (isBrowserOffline()) {
          if (!hadCache && !isStale()) {
            setError('You are offline and no cached POS menu is available.');
            setCategoriesLoading(false);
          }
          return;
        }

        const catalogRes = await fetch(
          withBranchQuery(
            '/api/restaurant/menu/categories?catalog=1',
            menuBranchId
          ),
          { cache: 'default' }
        );
        const catalogBody = (await catalogRes.json().catch(() => ({}))) as {
          data?: {
            themePrimaryColor?: string | null;
            serviceCharges?: unknown;
            dineInPaymentTiming?: string | null;
            fulfillmentSettings?: {
              deliveryEnabled?: boolean;
              dineInEnabled?: boolean;
              cardPaymentsEnabled?: boolean;
            };
            menus?: Array<{
              id: string;
              name: string;
              imageUrl?: string | null;
              items?: TItem[];
            }>;
            customizeIndex?: PosCustomizeIndex;
          };
          error?: string;
        };
        if (isStale()) return;

        if (!catalogRes.ok || !catalogBody.data) {
          if (!hadCache) {
            setError(
              typeof catalogBody.error === 'string'
                ? catalogBody.error
                : 'Failed to load menu categories.'
            );
            setCategoriesLoading(false);
          }
          return;
        }

        const menus = catalogBody.data.menus ?? [];
        const nextMeta: RestaurantMenuMeta = {
          themePrimaryColor: catalogBody.data.themePrimaryColor,
          serviceCharges: catalogBody.data.serviceCharges,
          dineInPaymentTiming: catalogBody.data.dineInPaymentTiming,
          fulfillmentSettings: catalogBody.data.fulfillmentSettings,
        };

        const loadedCategories: ProgressiveMenuCategory<TItem>[] = menus.map(
          (c) => ({
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl ?? null,
            items: Array.isArray(c.items) ? c.items : [],
            loaded: true,
            loading: false,
          })
        );

        setMeta(nextMeta);
        setCategories(loadedCategories);
        setCustomizeIndex(catalogBody.data.customizeIndex ?? null);
        setCategoriesLoading(false);
        setMenuComplete(true);
        setFromOfflineCache(false);
        setError(null);

        void setOfflineCache(OFFLINE_CACHE_KEYS.posMenu, {
          meta: nextMeta,
          categories: loadedCategories,
          customizeIndex: catalogBody.data.customizeIndex ?? null,
        } satisfies PosMenuCachePayload<TItem>);
      } catch {
        if (isStale()) return;
        if (!hadCache) {
          const ok = await applyCache();
          if (!ok) {
            setError('Failed to load menu products for POS.');
            setCategoriesLoading(false);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menuBranchId, enabled, reset]);

  return {
    meta,
    categories,
    customizeIndex,
    categoriesLoading,
    menuComplete,
    error,
    fromOfflineCache,
    anyCategoryLoading: categories.some((c) => c.loading),
  };
}
