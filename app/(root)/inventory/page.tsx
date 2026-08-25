'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { List, Loader2, Package, PackagePlus, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';

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
import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import { LazyProductImage } from '@/components/dashboard/menu-manager/lazy-product-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TablePagination } from '@/components/ui/table-pagination';
import { Textarea } from '@/components/ui/textarea';
import { DeleteConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { extractApiErrorMessage } from '@/lib/extract-api-error';
import { formatIngredientUnit } from '@/lib/inventory/stock';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { filterDecimalInput } from '@/lib/validation/fields';
import { cn } from '@/lib/utils';

type IngredientRow = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  isMajor: boolean;
  sku: string | null;
  minQuantity: number | null;
  isActive: boolean;
  hasImage: boolean;
  imageUrl: string | null;
};

type EntryRow = {
  id: string;
  quantity: number;
  reason: string;
  source: string;
  createdAt: string;
  ingredient: { id: string; name: string; unit: string };
  menuItem: { id: string; name: string } | null;
  variation: { id: string; name: string } | null;
  createdBy: { id: string; name: string; email: string | null } | null;
};

type ProductOption = { id: string; name: string };

const INVENTORY_REALTIME_CHANNELS = [
  'realtime:inventory.stock',
  'refreshSalesOrders',
  'refreshRecentOrders',
  'realtime:kds.tickets',
] as const;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

export default function InventoryPage() {
  const { canEdit, canDelete } = useDashboardPermissions();
  const canEditInv = canEdit('inventory');
  const canDeleteInv = canDelete('inventory');

  const [tab, setTab] = useState<'ingredients' | 'entries'>('ingredients');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stockRow, setStockRow] = useState<IngredientRow | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [entryPage, setEntryPage] = useState(1);
  const [entryTotal, setEntryTotal] = useState(0);
  const [entryTotalPages, setEntryTotalPages] = useState(1);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [entryIngredientId, setEntryIngredientId] = useState('');
  const [entryProductId, setEntryProductId] = useState('');
  const [entryQty, setEntryQty] = useState('');
  const [entryReason, setEntryReason] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const ingredientLoadId = useRef(0);
  const entryLoadId = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  const loadIngredients = useCallback(
    async (p: number, q: string, opts?: { silent?: boolean }) => {
      const requestId = ++ingredientLoadId.current;
      if (!opts?.silent) setLoading(true);
      try {
        const res = await axios.get<{
          data: IngredientRow[];
          meta: { total: number; totalPages: number; page: number };
        }>('/api/restaurant/inventory/ingredients', {
          params: {
            page: p,
            limit: 20,
            q: q || undefined,
            active: '0',
            _: Date.now(),
          },
          headers: NO_STORE_HEADERS,
        });
        if (requestId !== ingredientLoadId.current) return;
        setRows(res.data.data ?? []);
        setTotal(res.data.meta?.total ?? 0);
        setTotalPages(res.data.meta?.totalPages ?? 1);
        setPage(res.data.meta?.page ?? p);
      } catch {
        if (requestId !== ingredientLoadId.current) return;
        toast.error('Could not load ingredients.');
      } finally {
        if (requestId === ingredientLoadId.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const loadEntries = useCallback(async (p: number, opts?: { silent?: boolean }) => {
    const requestId = ++entryLoadId.current;
    if (!opts?.silent) setEntriesLoading(true);
    try {
      const res = await axios.get<{
        data: EntryRow[];
        meta: { total: number; totalPages: number; page: number };
      }>('/api/restaurant/inventory/entries', {
        params: { page: p, limit: 20, _: Date.now() },
        headers: NO_STORE_HEADERS,
      });
      if (requestId !== entryLoadId.current) return;
      setEntries(res.data.data ?? []);
      setEntryTotal(res.data.meta?.total ?? 0);
      setEntryTotalPages(res.data.meta?.totalPages ?? 1);
      setEntryPage(res.data.meta?.page ?? p);
    } catch {
      if (requestId !== entryLoadId.current) return;
      toast.error('Could not load stock entries.');
    } finally {
      if (requestId === entryLoadId.current) {
        setEntriesLoading(false);
      }
    }
  }, []);

  const loadActiveIngredients = useCallback(async () => {
    try {
      const res = await axios.get<{ data: IngredientRow[] }>(
        '/api/restaurant/inventory/ingredients',
        {
          params: { page: 1, limit: 100, active: '1', _: Date.now() },
          headers: NO_STORE_HEADERS,
        }
      );
      setIngredients(res.data.data ?? []);
    } catch {
      setIngredients([]);
    }
  }, []);

  const applySearch = () => {
    const q = search.trim();
    setPage(1);
    setAppliedSearch(q);
    if (page === 1 && appliedSearch === q) {
      void loadIngredients(1, q);
    }
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    setAppliedSearch('');
    if (page === 1 && appliedSearch === '') {
      void loadIngredients(1, '');
    }
  };

  useEffect(() => {
    void loadIngredients(page, appliedSearch);
  }, [page, appliedSearch, loadIngredients]);

  useEffect(() => {
    if (tab === 'entries') void loadEntries(entryPage);
  }, [tab, entryPage, loadEntries]);

  useEffect(() => {
    void loadActiveIngredients();
  }, [loadActiveIngredients]);

  const refreshInventory = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      void loadIngredients(page, appliedSearch, { silent: true });
      void loadActiveIngredients();
      void loadEntries(entryPage, { silent: true });
    }, 80);
  }, [
    loadIngredients,
    loadActiveIngredients,
    loadEntries,
    page,
    appliedSearch,
    entryPage,
  ]);

  useRealtimeRefresh([...INVENTORY_REALTIME_CHANNELS], refreshInventory, {
    runOnMount: false,
  });

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshInventory();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshInventory]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void axios
        .get<{ data: { products: ProductOption[] } }>(
          '/api/restaurant/menu/products',
          {
            params: {
              page: 1,
              limit: 24,
              includeCategories: '0',
              search: productSearch.trim() || undefined,
            },
          }
        )
        .then((res) => setProducts(res.data.data?.products ?? []))
        .catch(() => setProducts([]));
    }, 200);
    return () => window.clearTimeout(t);
  }, [productSearch]);

  const ingredientOptions = useMemo(
    () =>
      ingredients.map((i) => ({
        value: i.id,
        label: i.name,
        hint: `${i.quantity} ${formatIngredientUnit(i.unit)}`,
      })),
    [ingredients]
  );
  const productOptions = useMemo(() => {
    const opts = products.map((p) => ({ value: p.id, label: p.name }));
    if (
      entryProductId &&
      !opts.some((o) => o.value === entryProductId)
    ) {
      opts.unshift({ value: entryProductId, label: 'Selected product' });
    }
    return opts;
  }, [products, entryProductId]);

  const submitEntry = async () => {
    if (!entryIngredientId || !entryQty.trim() || !entryReason.trim()) {
      toast.error('Ingredient, quantity, and reason are required.');
      return;
    }
    setSavingEntry(true);
    try {
      await axios.post('/api/restaurant/inventory/entries', {
        ingredientId: entryIngredientId,
        quantity: Number(entryQty),
        reason: entryReason.trim(),
        menuItemId: entryProductId || null,
      });
      toast.success('Stock entry saved.');
      setEntryQty('');
      setEntryReason('');
      void loadIngredients(page, appliedSearch, { silent: true });
      void loadActiveIngredients();
      void loadEntries(1, { silent: true });
      setTab('entries');
    } catch (e) {
      toast.error(extractApiErrorMessage(e, 'Could not save stock entry.'));
    } finally {
      setSavingEntry(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/restaurant/inventory/ingredients/${deleteId}`);
      toast.success('Ingredient removed.');
      setDeleteId(null);
      void loadIngredients(page, appliedSearch, { silent: true });
      void loadActiveIngredients();
    } catch (e) {
      toast.error(extractApiErrorMessage(e, 'Could not delete ingredient.'));
    } finally {
      setDeleting(false);
    }
  };

  const saveStock = async () => {
    if (!stockRow) return;
    const qty = Number(stockQty);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Enter a quantity of 0 or more.');
      return;
    }
    setSavingStock(true);
    try {
      await axios.patch(
        `/api/restaurant/inventory/ingredients/${stockRow.id}`,
        { quantity: qty }
      );
      toast.success('Stock updated.');
      setRows((prev) =>
        prev.map((r) =>
          r.id === stockRow.id ? { ...r, quantity: qty } : r
        )
      );
      setStockRow(null);
      void loadIngredients(page, appliedSearch, { silent: true });
      void loadActiveIngredients();
    } catch (e) {
      toast.error(extractApiErrorMessage(e, 'Could not update stock.'));
    } finally {
      setSavingStock(false);
    }
  };

  return (
    <MenuPageShell
      title="Inventory"
      description="Track ingredients, recipes on products, and manual stock usage."
      loading={false}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={tab === 'ingredients' ? 'default' : 'outline'}
            onClick={() => setTab('ingredients')}
          >
            <Package className="mr-2 h-4 w-4" />
            <span>Ingredients</span>
          </Button>
          <Button
            type="button"
            variant={tab === 'entries' ? 'default' : 'outline'}
            onClick={() => setTab('entries')}
          >
            <List className="mr-2 h-4 w-4" />
            <span>Stock entries</span>
          </Button>
          <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={tab === 'entries' ? entriesLoading : loading}
          onClick={() => refreshInventory()}
        >
          <RefreshCw
            className={cn(
              'h-4 w-4',
              (tab === 'entries' ? entriesLoading : loading) && 'animate-spin'
            )}
          />
        </Button>
        </div>
       
      </div>

      {tab === 'ingredients' ? (
        <DashboardCard>
          <DashboardCardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DashboardCardTitle>Ingredients</DashboardCardTitle>
            {canEditInv ? (
              <Button type="button" asChild>
                <Link href="/inventory/ingredients/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Add ingredient
                </Link>
              </Button>
            ) : null}
          </DashboardCardHeader>
          <DashboardCardContent className="space-y-4">
            <form
              className="relative max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                applySearch();
              }}
            >
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ingredients…"
                className={cn(
                  'h-10 bg-background [&::-webkit-search-cancel-button]:hidden',
                  appliedSearch && search.trim() === appliedSearch
                    ? 'pr-12'
                    : 'pr-24'
                )}
                autoComplete="off"
                aria-label="Search ingredients"
              />
              {appliedSearch && search.trim() === appliedSearch ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="absolute right-0 top-1/2 h-10 w-10 -translate-y-1/2"
                  aria-label="Clear search"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4 text-white" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="default"
                  className="absolute right-0 top-1/2 h-10 -translate-y-1/2"
                >
                  <Search className="mr-2 h-4 w-4 text-white" />
                  Search
                </Button>
              )}
            </form>
            {loading ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {appliedSearch
                  ? 'No ingredients match your search.'
                  : 'No ingredients yet.'}
              </p>
            ) : (
              <>
                <DashboardTableWrapper>
                  <DashboardTable minWidth={880}>
                    <DashboardTableHeader>
                      <DashboardTableRow>
                        <DashboardTableHead>Ingredient</DashboardTableHead>
                        <DashboardTableHead>Stock</DashboardTableHead>
                        <DashboardTableHead>Major</DashboardTableHead>
                        <DashboardTableHead className="w-36" />
                      </DashboardTableRow>
                    </DashboardTableHeader>
                    <DashboardTableBody>
                      {rows.map((row) => {
                        const low =
                          row.minQuantity != null &&
                          row.quantity <= row.minQuantity;
                        return (
                          <DashboardTableRow key={row.id}>
                            <DashboardTableCell>
                              <div className="flex items-center gap-3">
                                <LazyProductImage
                                  src={row.imageUrl}
                                  hasImage={row.hasImage}
                                  alt=""
                                  className="h-10 w-10 rounded-md object-cover"
                                />
                                <div>
                                  <p className="font-medium">{row.name}</p>
                                  {!row.isActive ? (
                                    <p className="mt-0.5 text-[11px] font-medium text-destructive">
                                      Inactive
                                    </p>
                                  ) : null}
                                  <p className="text-xs text-muted-foreground">
                                    {row.sku || row.description || '—'}
                                  </p>
                                </div>
                              </div>
                            </DashboardTableCell>
                            <DashboardTableCell>
                              <span
                                className={cn(
                                  low && 'font-semibold text-destructive'
                                )}
                              >
                                {row.quantity} {formatIngredientUnit(row.unit)}
                              </span>
                            </DashboardTableCell>
                            <DashboardTableCell>
                              {row.isMajor ? 'Yes' : 'No'}
                            </DashboardTableCell>
                            <DashboardTableCell>
                              <div className="flex justify-end gap-1">
                                {canEditInv ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Update ${row.name} quantity`}
                                      onClick={() => {
                                        setStockRow(row);
                                        setStockQty(String(row.quantity));
                                      }}
                                    >
                                      <PackagePlus className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" asChild>
                                      <Link
                                        href={`/inventory/ingredients/${row.id}/edit`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  </>
                                ) : null}
                                {canDeleteInv ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteId(row.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
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
                  pagination={{
                    page,
                    pageSize: 20,
                    total,
                    totalPages,
                  }}
                  page={page}
                  onPageChange={setPage}
                  loading={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {total} ingredient{total === 1 ? '' : 's'}
                </p>
              </>
            )}
          </DashboardCardContent>
        </DashboardCard>
      ) : (
        <div className="space-y-6">
          {canEditInv ? (
            <DashboardCard>
              <DashboardCardHeader>
                <DashboardCardTitle>New stock entry</DashboardCardTitle>
              </DashboardCardHeader>
              <DashboardCardContent className="grid w-full gap-4">
                <div className="grid gap-2">
                  <Label>Product (optional)</Label>
                  <SearchableSelect
                    value={entryProductId}
                    onChange={setEntryProductId}
                    options={productOptions}
                    placeholder="Select product"
                    searchPlaceholder="Search product…"
                    allowClear
                    onSearchChange={setProductSearch}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    Ingredient <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    value={entryIngredientId}
                    onChange={setEntryIngredientId}
                    options={ingredientOptions}
                    placeholder="Select ingredient"
                    searchPlaceholder="Search ingredient…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={entryQty}
                    onChange={(e) =>
                      setEntryQty(filterDecimalInput(e.target.value))
                    }
                    inputMode="decimal"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    Reason <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={entryReason}
                    onChange={(e) => setEntryReason(e.target.value)}
                    placeholder="Why is this stock being used?"
                    rows={3}
                  />
                </div>
                <Button
                  type="button"
                  disabled={savingEntry}
                  onClick={() => void submitEntry()}
                >
                  {savingEntry ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : <Save className="mr-2 h-4 w-4" />}
                  Save entry (deduct stock)
                </Button>
              </DashboardCardContent>
            </DashboardCard>
          ) : null}

          <DashboardCard>
            <DashboardCardHeader>
              <DashboardCardTitle>Entry history</DashboardCardTitle>
            </DashboardCardHeader>
            <DashboardCardContent>
              {entriesLoading && entries.length === 0 ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              ) : entries.length === 0 && !entriesLoading ? (
                <p className="text-sm text-muted-foreground">No entries yet.</p>
              ) : (
                <>
                  <DashboardTableWrapper>
                    <DashboardTable minWidth={880}>
                      <DashboardTableHeader>
                        <DashboardTableRow>
                          <DashboardTableHead>When</DashboardTableHead>
                          <DashboardTableHead>Ingredient</DashboardTableHead>
                          <DashboardTableHead>Qty</DashboardTableHead>
                          <DashboardTableHead>Product</DashboardTableHead>
                          <DashboardTableHead>Reason</DashboardTableHead>
                        </DashboardTableRow>
                      </DashboardTableHeader>
                      <DashboardTableBody>
                        {entries.map((row) => (
                          <DashboardTableRow key={row.id}>
                            <DashboardTableCell>
                              {format(new Date(row.createdAt), 'dd MMM yyyy HH:mm')}
                            </DashboardTableCell>
                            <DashboardTableCell>
                              {row.ingredient.name}
                            </DashboardTableCell>
                            <DashboardTableCell>
                              −{row.quantity}{' '}
                              {formatIngredientUnit(row.ingredient.unit)}
                            </DashboardTableCell>
                            <DashboardTableCell>
                              {row.menuItem
                                ? `${row.menuItem.name}${
                                    row.variation
                                      ? ` (${row.variation.name})`
                                      : ''
                                  }`
                                : '—'}
                            </DashboardTableCell>
                            <DashboardTableCell className="max-w-xs truncate">
                              {row.reason}
                            </DashboardTableCell>
                          </DashboardTableRow>
                        ))}
                      </DashboardTableBody>
                    </DashboardTable>
                  </DashboardTableWrapper>
                  <TablePagination
                    pagination={{
                      page: entryPage,
                      pageSize: 20,
                      total: entryTotal,
                      totalPages: entryTotalPages,
                    }}
                    page={entryPage}
                    onPageChange={setEntryPage}
                    loading={entriesLoading}
                    hideWhenSinglePage={false}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {entryTotal} entr{entryTotal === 1 ? 'y' : 'ies'}
                  </p>
                </>
              )}
            </DashboardCardContent>
          </DashboardCard>
        </div>
      )}

      <Dialog
        open={Boolean(stockRow)}
        onOpenChange={(open) => {
          if (!open && !savingStock) setStockRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stockRow
                ? `Update stock for "${stockRow.name}"`
                : 'Update ingredient stock'}
            </DialogTitle>
            <DialogDescription>
              Set the on-hand quantity
              {stockRow
                ? ` in ${formatIngredientUnit(stockRow.unit)}.`
                : '.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="ingredient-stock-qty">
              Quantity
              {stockRow ? ` (${formatIngredientUnit(stockRow.unit)})` : ''}
            </Label>
            <Input
              id="ingredient-stock-qty"
              value={stockQty}
              onChange={(e) => setStockQty(filterDecimalInput(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveStock();
                }
              }}
              inputMode="decimal"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingStock}
              onClick={() => setStockRow(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingStock || stockQty.trim() === ''}
              onClick={() => void saveStock()}
            >
              {savingStock ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus className="mr-2 h-4 w-4" />
              )}
              Update stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        open={Boolean(deleteId)}
        onCancel={() => {
          if (!deleting) setDeleteId(null);
        }}
        onConfirm={() => void confirmDelete()}
        title="Delete ingredient?"
        description="This removes the ingredient and its recipe links."
        itemName={rows.find((r) => r.id === deleteId)?.name}
        loading={deleting}
      />
    </MenuPageShell>
  );
}
