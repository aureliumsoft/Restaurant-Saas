'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  Download,
  LayoutGrid,
  LayoutList,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchField } from '@/components/ui/search-field';
import { menuItemApiPath, productEditPath } from '@/lib/dashboard-paths';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { useUiLanguage } from '@/hooks/use-ui-language';
import {
  DashboardCard,
  DashboardCardContent,
  DashboardCardHeader,
  DashboardCardTitle,
} from '@/components/dashboard/dashboard-card';
import {
  DashboardTable,
  DashboardTableBody,
  DashboardTableCell,
  DashboardTableHead,
  DashboardTableHeader,
  DashboardTableRow,
  DashboardTableWrapper,
} from '@/components/dashboard/dashboard-table';
import {
  DeleteConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TablePagination } from '@/components/ui/table-pagination';
import { getMenuItemDisplayPrice } from '@/lib/menu-item-pricing';
import { cn } from '@/lib/utils';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';

import { InventoryQuickActions } from './inventory-quick-actions';
import { LazyProductImage } from './lazy-product-image';
import { ProductCsvImportWizard } from './product-csv-import-wizard';
import type { MenuItemRow } from './types';

const PRODUCTS_PAGE_SIZE = 12;
const ALL_CATEGORIES = 'all';
const PRODUCT_VIEW_KEY = 'foodluk.products.view';
const SKELETON_BONE = 'bg-[#e2e8f0] dark:bg-[#3f3f46] animate-pulse';

type ProductListItem = MenuItemRow & {
  categoryName: string;
  categoryNames: string[];
  hasImage?: boolean;
};

type ProductsApiResponse = {
  data: {
    products: ProductListItem[];
    categories?: Array<{ id: string; name: string }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
};

type CachedPage = {
  products: ProductListItem[];
  pagination: ProductsApiResponse['data']['pagination'];
  categories?: Array<{ id: string; name: string }>;
};

function formatMenuItemDate(iso: string | undefined) {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy · HH:mm');
  } catch {
    return '—';
  }
}

function cacheKey(page: number, search: string, categoryId: string) {
  return `${page}|${search}|${categoryId}`;
}

function ProductRowSkeleton() {
  return (
    <DashboardTableRow>
      <DashboardTableCell>
        <div className={cn('h-12 w-12 rounded-md border', SKELETON_BONE)} />
      </DashboardTableCell>
      <DashboardTableCell>
        <div className="space-y-2">
          <div className={cn('h-4 w-40 rounded', SKELETON_BONE)} />
          <div className={cn('h-3 w-56 rounded', SKELETON_BONE)} />
        </div>
      </DashboardTableCell>
      <DashboardTableCell>
        <div className={cn('h-4 w-24 rounded', SKELETON_BONE)} />
      </DashboardTableCell>
      <DashboardTableCell>
        <div className={cn('h-4 w-16 rounded', SKELETON_BONE)} />
      </DashboardTableCell>
      <DashboardTableCell>
        <div className={cn('h-4 w-14 rounded', SKELETON_BONE)} />
      </DashboardTableCell>
      <DashboardTableCell className="hidden lg:table-cell">
        <div className={cn('h-3 w-28 rounded', SKELETON_BONE)} />
      </DashboardTableCell>
      <DashboardTableCell className="hidden md:table-cell">
        <div className={cn('h-3 w-28 rounded', SKELETON_BONE)} />
      </DashboardTableCell>
      <DashboardTableCell>
        <div className="flex gap-1">
          <div className={cn('h-9 w-9 rounded-md', SKELETON_BONE)} />
          <div className={cn('h-9 w-9 rounded-md', SKELETON_BONE)} />
        </div>
      </DashboardTableCell>
    </DashboardTableRow>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className={cn('aspect-[4/3] w-full', SKELETON_BONE)} />
      <div className="space-y-2 p-3">
        <div className={cn('h-4 w-3/4 rounded', SKELETON_BONE)} />
        <div className={cn('h-3 w-1/2 rounded', SKELETON_BONE)} />
        <div className={cn('h-4 w-16 rounded', SKELETON_BONE)} />
      </div>
    </div>
  );
}

type Props = {
  /** Optional menu refresh (e.g. after inventoring quick actions that create categories). */
  onRefresh?: () => Promise<void>;
  /** When true, wait until parent categories load before showing empty category CTA. */
  categoriesLoading?: boolean;
  /** Category count hint from parent (if already loaded). */
  hasCategoriesHint?: boolean;
};

export function ProductsTab({
  onRefresh,
  categoriesLoading = false,
  hasCategoriesHint,
}: Props) {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const { formatMoney } = useOwnerRestaurantRegional();
  const { canEdit, canDelete } = useDashboardPermissions();
  const canEditProducts = canEdit('product');
  const canDeleteProducts = canDelete('product');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [view, setView] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'grid';
    try {
      const stored = window.localStorage.getItem(PRODUCT_VIEW_KEY);
      return stored === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PRODUCTS_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportConfirmation, setShowExportConfirmation] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<MenuItemRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    setAppliedSearch('');
  };

  const changeView = (next: 'list' | 'grid') => {
    setView(next);
    try {
      window.localStorage.setItem(PRODUCT_VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const requestIdRef = useRef(0);
  const cacheRef = useRef<Map<string, CachedPage>>(new Map());
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const applyPayload = useCallback(
    (payload: CachedPage, mergeCategories: boolean) => {
      setProducts(payload.products);
      setPagination(payload.pagination);
      if (payload.categories && payload.categories.length > 0) {
        setCategories(payload.categories);
      } else if (!mergeCategories && categoriesRef.current.length === 0) {
        setCategories([]);
      }
    },
    []
  );

  const fetchPage = useCallback(
    async (
      targetPage: number,
      searchValue: string,
      categoryValue: string,
      opts?: { includeCategories?: boolean }
    ): Promise<CachedPage | null> => {
      const includeCategories =
        opts?.includeCategories ?? categoriesRef.current.length === 0;
      const res = await axios.get<ProductsApiResponse>(
        '/api/restaurant/menu/products',
        {
          params: {
            page: targetPage,
            limit: PRODUCTS_PAGE_SIZE,
            search: searchValue || undefined,
            categoryId:
              categoryValue === ALL_CATEGORIES ? undefined : categoryValue,
            includeCategories: includeCategories ? '1' : '0',
          },
        }
      );
      const payload = res.data.data;
      const cached: CachedPage = {
        products: payload.products ?? [],
        pagination: payload.pagination ?? {
          page: targetPage,
          pageSize: PRODUCTS_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        },
        categories: payload.categories,
      };
      cacheRef.current.set(
        cacheKey(targetPage, searchValue, categoryValue),
        cached
      );
      return cached;
    },
    []
  );

  const prefetchNextPage = useCallback(
    (current: CachedPage, searchValue: string, categoryValue: string) => {
      const nextPage = current.pagination.page + 1;
      if (nextPage > current.pagination.totalPages) return;
      const key = cacheKey(nextPage, searchValue, categoryValue);
      if (cacheRef.current.has(key)) return;
      void fetchPage(nextPage, searchValue, categoryValue, {
        includeCategories: false,
      }).catch(() => {
        /* silent prefetch */
      });
    },
    [fetchPage]
  );

  const loadProducts = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const key = cacheKey(page, appliedSearch, categoryFilter);
    const cached = cacheRef.current.get(key);

    // Always show loading for the requested page until data is ready.
    setLoading(true);
    setProducts([]);

    if (cached) {
      if (requestId !== requestIdRef.current) return;
      applyPayload(cached, true);
      setLoading(false);
      prefetchNextPage(cached, appliedSearch, categoryFilter);
      return;
    }

    try {
      const payload = await fetchPage(page, appliedSearch, categoryFilter, {
        includeCategories: categoriesRef.current.length === 0,
      });
      if (requestId !== requestIdRef.current || !payload) return;
      applyPayload(payload, true);
      prefetchNextPage(payload, appliedSearch, categoryFilter);
    } catch (e: unknown) {
      if (requestId !== requestIdRef.current) return;
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(
        err.response?.data?.error || t('dashboard.product.loadFailed')
      );
      setProducts([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    page,
    appliedSearch,
    categoryFilter,
    applyPayload,
    fetchPage,
    prefetchNextPage,
  ]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setPage(1);
    // Filter/search change invalidates cached pages for previous filters.
    cacheRef.current.clear();
  }, [appliedSearch, categoryFilter]);

  const refreshAll = async () => {
    cacheRef.current.clear();
    await onRefresh?.();
    await loadProducts();
  };

  const exportProductsCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (appliedSearch) params.set('search', appliedSearch);
      if (categoryFilter !== ALL_CATEGORIES) {
        params.set('categoryId', categoryFilter);
      }
      const qs = params.toString();
      const res = await fetch(
        `/api/restaurant/menu/products/export${qs ? `?${qs}` : ''}`
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || t('dashboard.product.exportFailed'));
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error(t('dashboard.product.exportEmpty'));
      }
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ||
        `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShowExportConfirmation(false);
      toast.success(t('dashboard.product.exportSuccess'));
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : t('dashboard.product.exportError')
      );
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await axios.delete(
        menuItemApiPath(deletingProduct.id, '', deletingProduct.urlId)
      );
      toast.success(t('dashboard.product.deleted'));
      setDeleteConfirmOpen(false);
      setDeletingProduct(null);
      await refreshAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('dashboard.product.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const productActions = (item: ProductListItem) => (
    <div className="flex gap-1">
      {canEditProducts ? (
        <Button type="button" size="icon" variant="outline" asChild>
          <Link
            href={productEditPath(item.urlId ?? item.id)}
            aria-label={t('dashboard.product.editAria', {
              name: resolveBilingualText(item.name, uiLang),
            })}
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
      {canDeleteProducts ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="text-destructive"
          onClick={() => {
            setDeletingProduct(item);
            setDeleteConfirmOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );

  const noCategories =
    !categoriesLoading &&
    !loading &&
    categories.length === 0 &&
    (hasCategoriesHint === false || hasCategoriesHint === undefined);

  const showEmptyInventory =
    !loading &&
    pagination.total === 0 &&
    !appliedSearch &&
    categoryFilter === ALL_CATEGORIES &&
    categories.length > 0;

  const showToolbarAndTable =
    !noCategories &&
    (loading ||
      pagination.total > 0 ||
      appliedSearch.length > 0 ||
      categoryFilter !== ALL_CATEGORIES ||
      categories.length > 0);

  return (
    <DashboardCard>
      <DashboardCardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardCardTitle>{t('dashboard.product.title')}</DashboardCardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowImportWizard(true)}
            disabled={exporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('dashboard.product.importCsv')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowExportConfirmation(true)}
            disabled={exporting || noCategories}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {t('dashboard.product.exportCsv')}
          </Button>
          <InventoryQuickActions
            onMenuRefresh={refreshAll}
            className="flex flex-wrap gap-2"
          />
        </div>
      </DashboardCardHeader>
      <DashboardCardContent className="space-y-4 pt-4">
        {noCategories ? (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
            <p className="text-sm text-muted-foreground">
              {t('dashboard.product.needCategory')}
            </p>
            <InventoryQuickActions
              variant="toolbar"
              showVariation={false}
              onMenuRefresh={refreshAll}
            />
          </div>
        ) : showEmptyInventory ? (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
            {canEditProducts ? (
              <Button type="button" asChild>
                <Link href="/product/create">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('dashboard.product.addProduct')}
                </Link>
              </Button>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {t('dashboard.product.empty')}
            </p>
          </div>
        ) : showToolbarAndTable ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              
              <SearchField
                className="min-w-0 flex-1"
                value={search}
                onChange={setSearch}
                onSearch={applySearch}
                onClear={clearSearch}
                appliedValue={appliedSearch}
                placeholder={t('dashboard.product.searchPlaceholder')}
              />
              <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[14rem]">
                <ListFilter
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <SearchableSelect
                  value={categoryFilter}
                  onChange={(value) => {
                    setPage(1);
                    setCategoryFilter(value || ALL_CATEGORIES);
                  }}
                  options={[
                    {
                      value: ALL_CATEGORIES,
                      label: t('dashboard.product.allCategories'),
                    },
                    ...categories.map((c) => ({
                      value: c.id,
                      label: resolveBilingualText(c.name, uiLang),
                    })),
                  ]}
                  placeholder={t('dashboard.product.categoryFilter')}
                  searchPlaceholder={t('dashboard.product.searchCategories')}
                  emptyText={t('dashboard.product.noCategoriesMatch')}
                />
              </div>
              {canEditProducts ? (
                <Button
                  type="button"
                  asChild
                  disabled={categories.length === 0}
                >
                  <Link href="/product/create">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('dashboard.product.addProduct')}
                  </Link>
                </Button>
              ) : null}
              <div className="flex shrink-0 rounded-md border border-border p-0.5">
                <Button
                  type="button"
                  variant={view === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9"
                  aria-pressed={view === 'list'}
                  aria-label={t('dashboard.product.listView')}
                  onClick={() => changeView('list')}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={view === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9"
                  aria-pressed={view === 'grid'}
                  aria-label={t('dashboard.product.gridView')}
                  onClick={() => changeView('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {loading
                ? t('dashboard.product.loadingPage', { page })
                : pagination.total === 0
                  ? t('dashboard.product.emptySearch')
                  : t('dashboard.product.showingSummary', {
                      shown: products.length,
                      total: pagination.total,
                      page: pagination.page,
                      totalPages: pagination.totalPages,
                    })}
            </p>

            {loading || pagination.total > 0 ? (
              <>
                {view === 'list' ? (
                  <DashboardTableWrapper>
                    <DashboardTable minWidth={1040}>
                      <DashboardTableHeader>
                        <DashboardTableRow>
                          <DashboardTableHead className="w-16">
                            {t('dashboard.product.colPhoto')}
                          </DashboardTableHead>
                          <DashboardTableHead>
                            {t('dashboard.product.colName')}
                          </DashboardTableHead>
                          <DashboardTableHead>
                            {t('dashboard.product.colCategory')}
                          </DashboardTableHead>
                          <DashboardTableHead>
                            {t('dashboard.product.colPrice')}
                          </DashboardTableHead>
                          <DashboardTableHead>
                            {t('dashboard.product.colSale')}
                          </DashboardTableHead>
                          <DashboardTableHead className="hidden lg:table-cell">
                            {t('dashboard.product.colCreated')}
                          </DashboardTableHead>
                          <DashboardTableHead className="hidden md:table-cell">
                            {t('dashboard.product.colModified')}
                          </DashboardTableHead>
                          <DashboardTableHead className="w-28" />
                        </DashboardTableRow>
                      </DashboardTableHeader>
                      <DashboardTableBody>
                        {loading
                          ? Array.from({ length: PRODUCTS_PAGE_SIZE }).map(
                              (_, i) => (
                                <ProductRowSkeleton key={`product-skel-${i}`} />
                              )
                            )
                          : products.map((item) => {
                              const display = getMenuItemDisplayPrice(item);
                              const variationCount =
                                item.variations?.length ?? 0;
                              const categoryNames = item.categoryNames ?? [
                                item.categoryName,
                              ];
                              const descriptionText = resolveBilingualText(
                                item.description,
                                uiLang
                              );
                              return (
                                <DashboardTableRow key={item.id}>
                                  <DashboardTableCell>
                                    <LazyProductImage
                                      src={item.imageUrl}
                                      hasImage={item.hasImage}
                                      className="h-12 w-12 rounded-md border border-border"
                                      emptyLabel="—"
                                    />
                                  </DashboardTableCell>
                                  <DashboardTableCell>
                                    <div className="font-medium">
                                      {resolveBilingualText(item.name, uiLang)}
                                    </div>
                                    {descriptionText ? (
                                      <div className="line-clamp-2 text-wrap text-xs font-light text-muted-foreground">
                                        {descriptionText}
                                      </div>
                                    ) : null}
                                    {variationCount > 0 ? (
                                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                                        {t('dashboard.product.variationCount', {
                                          count: variationCount,
                                        })}
                                      </div>
                                    ) : null}
                                  </DashboardTableCell>
                                  <DashboardTableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {(categoryNames.length > 0
                                        ? categoryNames
                                        : [item.categoryName]
                                      ).map((name, index) => {
                                        const label = resolveBilingualText(
                                          name,
                                          uiLang
                                        );
                                        if (!label) return null;
                                        return (
                                          <Badge
                                            key={`${item.id}-cat-${index}`}
                                            variant="secondary"
                                            className="max-w-[10rem] truncate text-[10px] font-normal"
                                          >
                                            {label}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  </DashboardTableCell>
                                  <DashboardTableCell className="tabular-nums">
                                    {display.hasVariations ? (
                                      <>
                                        <span className="text-xs text-muted-foreground">
                                          {t('dashboard.product.priceFromLabel')}{' '}
                                        </span>
                                        <span className="font-medium">
                                          {formatMoney(display.amount)}
                                        </span>
                                      </>
                                    ) : display.compareAt != null ? (
                                      <span className="text-muted-foreground line-through">
                                        {formatMoney(display.compareAt!)}
                                      </span>
                                    ) : (
                                      <span className="font-medium">
                                        {formatMoney(display.amount)}
                                      </span>
                                    )}
                                  </DashboardTableCell>
                                  <DashboardTableCell className="tabular-nums">
                                    {display.hasVariations ? (
                                      <span className="text-xs text-muted-foreground">
                                        {t('dashboard.product.viaVariations')}
                                      </span>
                                    ) : display.compareAt != null ? (
                                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                        {formatMoney(display.amount)}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </DashboardTableCell>
                                  <DashboardTableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                                    {formatMenuItemDate(item.createdAt)}
                                  </DashboardTableCell>
                                  <DashboardTableCell className="hidden text-xs text-muted-foreground md:table-cell">
                                    {formatMenuItemDate(item.updatedAt)}
                                  </DashboardTableCell>
                                  <DashboardTableCell>
                                    {productActions(item)}
                                  </DashboardTableCell>
                                </DashboardTableRow>
                              );
                            })}
                      </DashboardTableBody>
                    </DashboardTable>
                  </DashboardTableWrapper>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {loading
                      ? Array.from({ length: PRODUCTS_PAGE_SIZE }).map(
                          (_, i) => (
                            <ProductCardSkeleton
                              key={`product-card-skel-${i}`}
                            />
                          )
                        )
                      : products.map((item) => {
                          const display = getMenuItemDisplayPrice(item);
                          const variationCount = item.variations?.length ?? 0;
                          const categoryNames = item.categoryNames ?? [
                            item.categoryName,
                          ];
                          return (
                            <div
                              key={item.id}
                              className="overflow-hidden rounded-lg border border-border bg-card"
                            >
                              <LazyProductImage
                                src={item.imageUrl}
                                hasImage={item.hasImage}
                                alt=""
                                className="aspect-[4/3] w-full"
                                emptyLabel="—"
                              />
                              <div className="space-y-2 p-3">
                                <div>
                                  <p className="line-clamp-2 font-medium leading-snug">
                                    {resolveBilingualText(item.name, uiLang)}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {(categoryNames.length > 0
                                      ? categoryNames
                                      : [item.categoryName]
                                    ).map((name, index) => {
                                      const label = resolveBilingualText(
                                        name,
                                        uiLang
                                      );
                                      if (!label) return null;
                                      return (
                                        <Badge
                                          key={`${item.id}-card-cat-${index}`}
                                          variant="secondary"
                                          className="max-w-full truncate text-[10px] font-normal"
                                        >
                                          {label}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                  {variationCount > 0 ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      {t('dashboard.product.variationCount', {
                                        count: variationCount,
                                      })}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="tabular-nums text-sm">
                                  {display.hasVariations ? (
                                    <span className="font-medium">
                                      {t('dashboard.product.priceFrom', {
                                        price: formatMoney(display.amount),
                                      })}
                                    </span>
                                  ) : display.compareAt != null ? (
                                    <span>
                                      <span className="mr-1.5 text-muted-foreground line-through">
                                        {formatMoney(display.compareAt)}
                                      </span>
                                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                        {formatMoney(display.amount)}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="font-medium">
                                      {formatMoney(display.amount)}
                                    </span>
                                  )}
                                </div>
                                {productActions(item)}
                              </div>
                            </div>
                          );
                        })}
                  </div>
                )}

                <TablePagination
                  pagination={pagination}
                  page={page}
                  onPageChange={setPage}
                  loading={loading}
                />
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`boot-skel-${i}`}
                className={cn('h-14 w-full rounded-lg border', SKELETON_BONE)}
              />
            ))}
          </div>
        )}
      </DashboardCardContent>

      <ProductCsvImportWizard
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
        onImported={() => void refreshAll()}
      />

      <SaveConfirmation
        open={showExportConfirmation}
        title={t('dashboard.product.exportTitle')}
        description={
          appliedSearch || categoryFilter !== ALL_CATEGORIES
            ? t('dashboard.product.exportDescriptionFiltered')
            : t('dashboard.product.exportDescriptionAll')
        }
        loading={exporting}
        confirmText={t('dashboard.product.exportCsv')}
        onConfirm={() => void exportProductsCsv()}
        onCancel={() => {
          if (!exporting) setShowExportConfirmation(false);
        }}
      />

      <DeleteConfirmation
        open={deleteConfirmOpen}
        title={t('dashboard.product.deleteTitle')}
        description={t('dashboard.product.deleteDescription')}
        itemName={
          deletingProduct
            ? resolveBilingualText(deletingProduct.name, uiLang)
            : undefined
        }
        loading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeletingProduct(null);
        }}
      />
    </DashboardCard>
  );
}
