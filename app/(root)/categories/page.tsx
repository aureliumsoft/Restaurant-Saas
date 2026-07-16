'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import { CategoriesTab } from '@/components/dashboard/menu-manager/categories-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import type { MenuCategoryRow } from '@/components/dashboard/menu-manager/types';
import ErrorBoundary from '@/components/toaster/toaster';
import type { PaginationMeta } from '@/lib/pagination';

const CATEGORIES_PAGE_SIZE = 4;

export default function CategoriesPage() {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
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
      const res = await axios.get<{
        data: { categories: MenuCategoryRow[]; pagination: PaginationMeta };
      }>('/api/restaurant/menu/categories', {
        params: {
          mode: 'management',
          page,
          limit: CATEGORIES_PAGE_SIZE,
        },
      });

      if (requestId !== requestIdRef.current) return false;

      const next = res.data.data.categories ?? [];
      const nextPagination = res.data.data.pagination;
      setCategories((prev) => {
        if (!append) return next;
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...next.filter((c) => !seen.has(c.id))];
      });
      setPagination(nextPagination);
      pageRef.current = nextPagination.page;
      hasMoreRef.current = nextPagination.hasNextPage;
      return nextPagination.hasNextPage;
    },
    []
  );

  const prefetchCategoryChain = useCallback(
    async (requestId: number) => {
      if (prefetchingRef.current || !hasMoreRef.current) return;
      prefetchingRef.current = true;
      setLoadingMore(true);
      try {
        while (hasMoreRef.current && requestId === requestIdRef.current) {
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

  const load = useCallback(async () => {
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
    void load();
  }, [load]);

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Categories"
          description="Create menu sections (categories). Use Show in front for items customers browse on web, kiosk, and POS. Turn it off for add-on categories used only in Recommendations."
          loading={false}
        >
          <CategoriesTab
            categories={categories}
            onRefresh={load}
            loading={loading}
            loadingMore={loadingMore}
          />
          {pagination ? (
            <p className="mt-2 px-2 text-xs text-muted-foreground">
              Showing {categories.length} of {pagination.total}
              {loadingMore && pagination.hasNextPage
                ? ' · loading more in background...'
                : ''}
            </p>
          ) : null}
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
