'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { CategoriesTab } from '@/components/dashboard/menu-manager/categories-tab';
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import type { MenuCategoryRow } from '@/components/dashboard/menu-manager/types';
import ErrorBoundary from '@/components/toaster/toaster';
import type { PaginationMeta } from '@/lib/pagination';

const CATEGORIES_PAGE_SIZE = 4;

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState('');
  const requestIdRef = useRef(0);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const prefetchingRef = useRef(false);
  const searchRef = useRef('');

  const loadCategoryPage = useCallback(
    async (
      page: number,
      append: boolean,
      requestId: number,
      searchValue: string
    ): Promise<boolean> => {
      const res = await axios.get<{
        data: { categories: MenuCategoryRow[]; pagination: PaginationMeta };
      }>('/api/restaurant/menu/categories', {
        params: {
          mode: 'management',
          page,
          limit: CATEGORIES_PAGE_SIZE,
          ...(searchValue ? { search: searchValue } : {}),
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
    async (requestId: number, searchValue: string) => {
      if (prefetchingRef.current || !hasMoreRef.current) return;
      prefetchingRef.current = true;
      setLoadingMore(true);
      try {
        while (hasMoreRef.current && requestId === requestIdRef.current) {
          const nextPage = pageRef.current + 1;
          const hasMore = await loadCategoryPage(
            nextPage,
            true,
            requestId,
            searchValue
          );
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

  const load = useCallback(
    async (nextSearch?: string) => {
      const searchValue =
        nextSearch !== undefined ? nextSearch.trim() : searchRef.current;
      searchRef.current = searchValue;
      setSearch(searchValue);

      const requestId = ++requestIdRef.current;
      prefetchingRef.current = false;
      setLoading(true);
      setLoadingMore(false);
      try {
        const hasMore = await loadCategoryPage(
          1,
          false,
          requestId,
          searchValue
        );
        if (hasMore && requestId === requestIdRef.current) {
          void prefetchCategoryChain(requestId, searchValue);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [loadCategoryPage, prefetchCategoryChain]
  );

  useEffect(() => {
    void load('');
  }, [load]);

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title={t('dashboard.categories.title')}
          description={t('dashboard.categories.description')}
          loading={false}
        >
          <CategoriesTab
            categories={categories}
            onRefresh={load}
            loading={loading}
            loadingMore={loadingMore}
            search={search}
          />
          {pagination ? (
            <p className="mt-2 px-2 text-xs text-muted-foreground">
              {t('dashboard.categories.showingCount', {
                shown: categories.length,
                total: pagination.total,
              })}
              {loadingMore && pagination.hasNextPage
                ? t('dashboard.categories.loadingMore')
                : ''}
            </p>
          ) : null}
        </MenuPageShell>
      </ErrorBoundary>
    </div>
  );
}
