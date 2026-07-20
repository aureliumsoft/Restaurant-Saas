'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import type { MenuCategoryRow } from '@/components/dashboard/menu-manager/types';
import type { PaginationMeta } from '@/lib/pagination';

const CATEGORIES_PAGE_SIZE = 4;

type CategoriesApiResponse = {
  data: {
    categories: MenuCategoryRow[];
    pagination: PaginationMeta;
  };
};

/** Lightweight category list for configurations — no full menu payload. */
export function useRecommendationsCatalog() {
  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const prefetchingRef = useRef(false);

  const loadCategoryPage = useCallback(
    async (
      page: number,
      append: boolean,
      requestId: number
    ): Promise<boolean> => {
      const res = await axios.get<CategoriesApiResponse>(
        '/api/restaurant/menu/categories',
        {
          params: {
            mode: 'management',
            page,
            limit: CATEGORIES_PAGE_SIZE,
          },
        }
      );

      if (requestId !== requestIdRef.current) return false;

      const next = (res.data.data.categories ?? []).map((c) => ({
        ...c,
        items: c.items ?? [],
      }));
      const pagination = res.data.data.pagination;

      setCategories((prev) => {
        if (!append) return next;
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...next.filter((c) => !seen.has(c.id))];
      });

      pageRef.current = pagination.page;
      hasMoreRef.current = pagination.hasNextPage;
      return pagination.hasNextPage;
    },
    []
  );

  const prefetchCategoryChain = useCallback(
    async (requestId: number) => {
      if (prefetchingRef.current || !hasMoreRef.current) return;
      prefetchingRef.current = true;
      setLoadingMore(true);
      try {
        while (
          hasMoreRef.current &&
          requestId === requestIdRef.current
        ) {
          const nextPage = pageRef.current + 1;
          const hasMore = await loadCategoryPage(nextPage, true, requestId);
          if (!hasMore || requestId !== requestIdRef.current) break;
        }
      } finally {
        if (requestId === requestIdRef.current) {
          prefetchingRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [loadCategoryPage]
  );

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    prefetchingRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    try {
      const hasMore = await loadCategoryPage(1, false, requestId);
      if (hasMore && requestId === requestIdRef.current) {
        void prefetchCategoryChain(requestId);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [loadCategoryPage, prefetchCategoryChain]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    categories,
    loading,
    loadingMore,
    refresh,
  };
}
