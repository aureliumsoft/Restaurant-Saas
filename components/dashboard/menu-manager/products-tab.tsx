'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { getMenuItemDisplayPrice } from '@/lib/menu-item-pricing';
import { menuItemBelongsToCategory, menuItemCategoryIds } from '@/lib/menu/menu-item-category-ids';
import { cn } from '@/lib/utils';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';

import { InventoryQuickActions } from './inventory-quick-actions';
import type { MenuCategoryRow, MenuItemRow } from './types';

const PRODUCTS_PAGE_SIZE = 12;
const ALL_CATEGORIES = 'all';

type ProductRow = {
  item: MenuItemRow;
  /** Primary category label (first linked category). */
  categoryName: string;
  /** All category names this product is linked to. */
  categoryNames: string[];
  /** Category ids where this product appears in the menu tree. */
  listedCategoryIds: string[];
};

function categoryNamesForItem(
  item: MenuItemRow,
  categories: MenuCategoryRow[]
): string[] {
  return menuItemCategoryIds(item)
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

function buildProductRows(
  categories: MenuCategoryRow[],
  inventoryItems?: MenuItemRow[]
): ProductRow[] {
  const items =
    inventoryItems && inventoryItems.length > 0
      ? inventoryItems
      : dedupeItemsFromCategories(categories);

  return items.map((item) => {
    const categoryNames = categoryNamesForItem(item, categories);
    const primaryCategory = categories.find((c) => c.id === item.categoryId);

    return {
      item,
      categoryName:
        primaryCategory?.name ?? categoryNames[0] ?? '—',
      categoryNames: categoryNames.length > 0 ? categoryNames : ['—'],
      listedCategoryIds: menuItemCategoryIds(item),
    };
  });
}

function dedupeItemsFromCategories(categories: MenuCategoryRow[]): MenuItemRow[] {
  const byId = new Map<string, MenuItemRow>();
  for (const category of categories) {
    for (const item of category.items) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort(compareProductActivity);
}

function productActivityTime(item: MenuItemRow): number {
  const updated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
  const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
  return Math.max(updated, created);
}

function compareProductActivity(a: MenuItemRow, b: MenuItemRow): number {
  return productActivityTime(b) - productActivityTime(a);
}

function productMatchesCategoryFilter(
  row: ProductRow,
  categoryFilter: string
): boolean {
  return (
    row.listedCategoryIds.includes(categoryFilter) ||
    menuItemBelongsToCategory(row.item, categoryFilter)
  );
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
  categories: MenuCategoryRow[];
  inventoryItems?: MenuItemRow[];
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function ProductsTab({
  categories,
  inventoryItems,
  onRefresh,
  loading,
}: Props) {
  const { formatMoney } = useOwnerRestaurantRegional();
  const { canEdit, canDelete } = useDashboardPermissions();
  const canEditProducts = canEdit('product');
  const canDeleteProducts = canDelete('product');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<MenuItemRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const allRows = useMemo<ProductRow[]>(
    () => buildProductRows(categories, inventoryItems),
    [categories, inventoryItems]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allRows;
    if (categoryFilter !== ALL_CATEGORIES) {
      list = list.filter((row) => productMatchesCategoryFilter(row, categoryFilter));
    }
    if (q) {
      list = list.filter(
        ({ item, categoryName, categoryNames }) =>
          item.name.toLowerCase().includes(q) ||
          (item.description ?? '').toLowerCase().includes(q) ||
          categoryName.toLowerCase().includes(q) ||
          categoryNames.some((name) => name.toLowerCase().includes(q))
      );
    }
    return list.sort(
      (a, b) => productActivityTime(b.item) - productActivityTime(a.item)
    );
  }, [allRows, search, categoryFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PRODUCTS_PAGE_SIZE)
  );

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PRODUCTS_PAGE_SIZE;
    return filteredRows.slice(start, start + PRODUCTS_PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const remove = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/restaurant/menu/items/${deletingProduct.id}`);
      toast.success('Deleted');
      setDeleteConfirmOpen(false);
      setDeletingProduct(null);
      await onRefresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardCard>
      <DashboardCardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardCardTitle>Products</DashboardCardTitle>
        <InventoryQuickActions
          onMenuRefresh={onRefresh}
          className="flex flex-wrap gap-2"
        />
      </DashboardCardHeader>
      <DashboardCardContent className="space-y-4 pt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="animate-spin text-primary text-center mx-auto" />
          </p>
        ) : (
          <>
            {categories.length === 0 ? (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
                <p className="text-sm text-muted-foreground">
                  Create at least one category before you can add products.
                </p>
                <InventoryQuickActions
                  variant="toolbar"
                  showVariation={false}
                  onMenuRefresh={onRefresh}
                />
              </div>
            ) : allRows.length === 0 ? (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
                {canEditProducts ? (
                  <Button
                    type="button"
                    asChild
                  >
                    <Link href="/product/create">
                      <Plus className="mr-2 h-4 w-4" />
                      Add product
                    </Link>
                  </Button>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  No products yet.
                </p>
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
                  {filteredRows.length === 0
                    ? 'No products match your search or filter.'
                    : `Showing ${paginatedRows.length} of ${filteredRows.length} product${filteredRows.length === 1 ? '' : 's'} · sorted by newest or recently updated`}
                </p>

                {filteredRows.length === 0 ? null : (
                  <>
                    <DashboardTableWrapper>
                      <DashboardTable minWidth={1040}>
                        <DashboardTableHeader>
                          <DashboardTableRow>
                            <DashboardTableHead className="w-16">Photo</DashboardTableHead>
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
                          {paginatedRows.map(({ item, categoryName, categoryNames }) => {
                            const display = getMenuItemDisplayPrice(item);
                            const variationCount = item.variations?.length ?? 0;
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
                                    <div className="line-clamp-2  text-xs text-muted-foreground font-light text-wrap">
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
                                    : categoryName}
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

                    {totalPages > 1 ? (
                      <Pagination className="justify-end">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPage((p) => Math.max(1, p - 1));
                              }}
                              className={
                                page <= 1
                                  ? 'pointer-events-none opacity-50'
                                  : ''
                              }
                            />
                          </PaginationItem>
                          <PaginationItem>
                            <span className="flex h-9 items-center px-3 text-sm text-muted-foreground">
                              Page {page} of {totalPages}
                            </span>
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPage((p) => Math.min(totalPages, p + 1));
                              }}
                              className={
                                page >= totalPages
                                  ? 'pointer-events-none opacity-50'
                                  : ''
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </>
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
