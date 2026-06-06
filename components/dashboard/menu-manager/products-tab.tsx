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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';

import { InventoryQuickActions } from './inventory-quick-actions';
import type { MenuCategoryRow, MenuItemRow } from './types';

const PRODUCTS_PAGE_SIZE = 12;
const ALL_CATEGORIES = 'all';

type ProductRow = {
  item: MenuItemRow;
  categoryName: string;
};

function formatUpdatedAt(iso: string | undefined) {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM d, yyyy · HH:mm');
  } catch {
    return '—';
  }
}

type Props = {
  categories: MenuCategoryRow[];
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function ProductsTab({ categories, onRefresh, loading }: Props) {
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
    () =>
      categories.flatMap((c) =>
        c.items.map((item) => ({ item, categoryName: c.name }))
      ),
    [categories]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allRows;
    if (categoryFilter !== ALL_CATEGORIES) {
      list = list.filter(({ item }) => item.categoryId === categoryFilter);
    }
    if (q) {
      list = list.filter(
        ({ item, categoryName }) =>
          item.name.toLowerCase().includes(q) ||
          (item.description ?? '').toLowerCase().includes(q) ||
          categoryName.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aTime = a.item.updatedAt ? new Date(a.item.updatedAt).getTime() : 0;
      const bTime = b.item.updatedAt ? new Date(b.item.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
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
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Products</CardTitle>
        <InventoryQuickActions
          onMenuRefresh={onRefresh}
          className="flex flex-wrap gap-2"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
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
                    : `Showing ${paginatedRows.length} of ${filteredRows.length} product${filteredRows.length === 1 ? '' : 's'} · sorted by last modified`}
                </p>

                {filteredRows.length === 0 ? null : (
                  <>
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50 text-left">
                            <th className="p-3 font-medium w-16">Photo</th>
                            <th className="p-3 font-medium">Name</th>
                            <th className="p-3 font-medium">Category</th>
                            <th className="p-3 font-medium">Price</th>
                            <th className="p-3 font-medium">Sale</th>
                            <th className="hidden p-3 font-medium md:table-cell">
                              Modified
                            </th>
                            <th className="p-3 w-28" />
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRows.map(({ item, categoryName }) => {
                            const display = getMenuItemDisplayPrice(item);
                            const variationCount = item.variations?.length ?? 0;
                            return (
                              <tr
                                key={item.id}
                                className="border-b border-border last:border-0"
                              >
                                <td className="p-3">
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
                                </td>
                                <td className="p-3">
                                  <div className="font-medium">{item.name}</div>
                                  {item.description ? (
                                    <div className="line-clamp-2 text-xs text-muted-foreground">
                                      {item.description}
                                    </div>
                                  ) : null}
                                  {variationCount > 0 ? (
                                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                                      {variationCount} variation
                                      {variationCount === 1 ? '' : 's'}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="p-3 text-muted-foreground">
                                  {categoryName}
                                </td>
                                <td className="p-3 tabular-nums">
                                  {display.hasVariations ? (
                                    <>
                                      <span className="text-xs text-muted-foreground">
                                        From{' '}
                                      </span>
                                      <span className="font-medium">
                                        €{display.amount.toFixed(2)}
                                      </span>
                                    </>
                                  ) : display.compareAt != null ? (
                                    <span className="text-muted-foreground line-through">
                                      €{display.compareAt.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="font-medium">
                                      €{display.amount.toFixed(2)}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 tabular-nums">
                                  {display.hasVariations ? (
                                    <span className="text-xs text-muted-foreground">
                                      via variations
                                    </span>
                                  ) : display.compareAt != null ? (
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                      €{display.amount.toFixed(2)}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">
                                  {formatUpdatedAt(item.updatedAt)}
                                </td>
                                <td className="p-3">
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
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

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
      </CardContent>

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
    </Card>
  );
}
