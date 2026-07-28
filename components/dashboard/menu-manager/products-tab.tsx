'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  Download,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { DeleteConfirmation } from '@/components/ui/confirmation-dialogs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TablePagination } from '@/components/ui/table-pagination';
import { getMenuItemDisplayPrice } from '@/lib/menu-item-pricing';
import { cn } from '@/lib/utils';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';

import { InventoryQuickActions } from './inventory-quick-actions';
import { LazyProductImage } from './lazy-product-image';
import type { MenuItemRow } from './types';

const PRODUCTS_PAGE_SIZE = 12;
const ALL_CATEGORIES = 'all';
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

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

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
  const { formatMoney } = useOwnerRestaurantRegional();
  const { canEdit, canDelete } = useDashboardPermissions();
  const canEditProducts = canEdit('product');
  const canDeleteProducts = canDelete('product');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PRODUCTS_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<MenuItemRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

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
        pagination:
          payload.pagination ?? {
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
    const key = cacheKey(page, debouncedSearch, categoryFilter);
    const cached = cacheRef.current.get(key);

    // Always show loading for the requested page until data is ready.
    setLoading(true);
    setProducts([]);

    if (cached) {
      if (requestId !== requestIdRef.current) return;
      applyPayload(cached, true);
      setLoading(false);
      prefetchNextPage(cached, debouncedSearch, categoryFilter);
      return;
    }

    try {
      const payload = await fetchPage(page, debouncedSearch, categoryFilter, {
        includeCategories: categoriesRef.current.length === 0,
      });
      if (requestId !== requestIdRef.current || !payload) return;
      applyPayload(payload, true);
      prefetchNextPage(payload, debouncedSearch, categoryFilter);
    } catch (e: unknown) {
      if (requestId !== requestIdRef.current) return;
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to load products');
      setProducts([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    page,
    debouncedSearch,
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
  }, [debouncedSearch, categoryFilter]);

  const refreshAll = async () => {
    cacheRef.current.clear();
    await onRefresh?.();
    await loadProducts();
  };

  const exportProductsExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
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
        throw new Error(body.error || 'Export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] || `products-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Products exported to Excel');
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : 'Could not export products'
      );
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/restaurant/menu/items/${deletingProduct.id}`);
      toast.success('Deleted');
      setDeleteConfirmOpen(false);
      setDeletingProduct(null);
      await refreshAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const noCategories =
    !categoriesLoading &&
    !loading &&
    categories.length === 0 &&
    (hasCategoriesHint === false || hasCategoriesHint === undefined);

  const showEmptyInventory =
    !loading &&
    pagination.total === 0 &&
    !debouncedSearch &&
    categoryFilter === ALL_CATEGORIES &&
    categories.length > 0;

  const showToolbarAndTable =
    !noCategories &&
    (loading ||
      pagination.total > 0 ||
      debouncedSearch.length > 0 ||
      categoryFilter !== ALL_CATEGORIES ||
      categories.length > 0);

  return (
    <DashboardCard>
      <DashboardCardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardCardTitle>Products</DashboardCardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportProductsExcel()}
            disabled={exporting || noCategories}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export Excel
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
              Create at least one category before you can add products.
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
                  Add product
                </Link>
              </Button>
            ) : null}
            <p className="text-sm text-muted-foreground">No products yet.</p>
          </div>
        ) : showToolbarAndTable ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {canEditProducts ? (
                <Button
                  type="button"
                  asChild
                  disabled={categories.length === 0}
                >
                  <Link href="/product/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Add product
                  </Link>
                </Button>
              ) : null}
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, description, or category…"
                  className="h-10 bg-background pl-9"
                  autoComplete="off"
                  aria-label="Search products"
                />
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[12rem]">
                <ListFilter
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CATEGORIES}>
                      All categories
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {loading
                ? `Loading page ${page}…`
                : pagination.total === 0
                  ? 'No products match your search or filter.'
                  : `Showing ${products.length} of ${pagination.total} product${pagination.total === 1 ? '' : 's'} · page ${pagination.page} of ${pagination.totalPages} · sorted by newest or recently updated.`}
            </p>

            {loading || pagination.total > 0 ? (
              <>
                <DashboardTableWrapper>
                  <DashboardTable minWidth={1040}>
                    <DashboardTableHeader>
                      <DashboardTableRow>
                        <DashboardTableHead className="w-16">
                          Photo
                        </DashboardTableHead>
                        <DashboardTableHead>Name</DashboardTableHead>
                        <DashboardTableHead>Category</DashboardTableHead>
                        <DashboardTableHead>Price</DashboardTableHead>
                        <DashboardTableHead>Sale</DashboardTableHead>
                        <DashboardTableHead className="hidden lg:table-cell">
                          Created
                        </DashboardTableHead>
                        <DashboardTableHead className="hidden md:table-cell">
                          Modified
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
                            const variationCount = item.variations?.length ?? 0;
                            const categoryNames = item.categoryNames ?? [
                              item.categoryName,
                            ];
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
                                  <div className="font-medium">{item.name}</div>
                                  {item.description ? (
                                    <div className="line-clamp-2 text-wrap text-xs font-light text-muted-foreground">
                                      {item.description}
                                    </div>
                                  ) : null}
                                  {variationCount > 0 ? (
                                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                                      {variationCount} variation
                                      {variationCount === 1 ? '' : 's'}
                                    </div>
                                  ) : null}
                                </DashboardTableCell>
                                <DashboardTableCell className="text-muted-foreground">
                                  {categoryNames.length > 1
                                    ? categoryNames.join(', ')
                                    : item.categoryName}
                                </DashboardTableCell>
                                <DashboardTableCell className="tabular-nums">
                                  {display.hasVariations ? (
                                    <>
                                      <span className="text-xs text-muted-foreground">
                                        From{' '}
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
                                      via variations
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
                                  <div className="flex gap-1">
                                    {canEditProducts ? (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        asChild
                                      >
                                        <Link
                                          href={`/product/edit/${item.id}`}
                                          aria-label={`Edit ${item.name}`}
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
                                </DashboardTableCell>
                              </DashboardTableRow>
                            );
                          })}
                    </DashboardTableBody>
                  </DashboardTable>
                </DashboardTableWrapper>

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

      <DeleteConfirmation
        open={deleteConfirmOpen}
        title="Delete product"
        description="This product will be removed permanently."
        itemName={deletingProduct?.name}
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
