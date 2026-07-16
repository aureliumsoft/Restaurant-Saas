'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
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
import type { MenuItemRow } from './types';

const PRODUCTS_PAGE_SIZE = 12;
const ALL_CATEGORIES = 'all';

type ProductListItem = MenuItemRow & {
  categoryName: string;
  categoryNames: string[];
};

type ProductsApiResponse = {
  data: {
    products: ProductListItem[];
    categories: Array<{ id: string; name: string }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<MenuItemRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<ProductsApiResponse>(
        '/api/restaurant/menu/products',
        {
          params: {
            page,
            limit: PRODUCTS_PAGE_SIZE,
            search: debouncedSearch || undefined,
            categoryId:
              categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter,
          },
        }
      );
      const payload = res.data.data;
      setProducts(payload.products ?? []);
      setCategories(payload.categories ?? []);
      setPagination(
        payload.pagination ?? {
          page: 1,
          pageSize: PRODUCTS_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter]);

  const refreshAll = async () => {
    await onRefresh?.();
    await loadProducts();
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
    categories.length === 0 &&
    (hasCategoriesHint === false || hasCategoriesHint === undefined);

  return (
    <DashboardCard>
      <DashboardCardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardCardTitle>Products</DashboardCardTitle>
        <InventoryQuickActions
          onMenuRefresh={refreshAll}
          className="flex flex-wrap gap-2"
        />
      </DashboardCardHeader>
      <DashboardCardContent className="space-y-4 pt-4">
        {loading && products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mx-auto animate-spin text-center text-primary" />
          </p>
        ) : noCategories ? (
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
        ) : pagination.total === 0 && !debouncedSearch && categoryFilter === ALL_CATEGORIES ? (
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
        ) : (
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
              {pagination.total === 0
                ? 'No products match your search or filter.'
                : `Showing ${products.length} of ${pagination.total} product${pagination.total === 1 ? '' : 's'} · sorted by newest or recently updated`}
              {loading ? ' · Loading…' : ''}
            </p>

            {pagination.total === 0 ? null : (
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
                      {products.map((item) => {
                        const display = getMenuItemDisplayPrice(item);
                        const variationCount = item.variations?.length ?? 0;
                        const categoryNames = item.categoryNames ?? [
                          item.categoryName,
                        ];
                        return (
                          <DashboardTableRow key={item.id}>
                            <DashboardTableCell>
                              <div
                                className={cn(
                                  'relative h-12 w-12 overflow-hidden rounded-md border border-border bg-muted',
                                  !item.imageUrl &&
                                    'flex items-center justify-center text-[10px] text-muted-foreground'
                                )}
                              >
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- dashboard menu URLs
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  '—'
                                )}
                              </div>
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
            )}
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
