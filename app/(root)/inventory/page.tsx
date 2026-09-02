'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  List,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react';

import { ingredientEditPath, ingredientApiPath } from '@/lib/dashboard-paths';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
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
  unitCost: number | null;
  stockValue: number;
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
  ingredient: { id: string; name: string; unit: string; unitCost: number | null };
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

type InventorySummary = {
  totalInventoryValue: number;
  lowStockCount: number;
  activeIngredientCount: number;
  usageValue30d: number;
  entryCount30d: number;
};

function InventoryInsightChip({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-3xl p-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(240,90,32,0.06)] backdrop-blur-xl',
        accent
          ? 'bg-fire-500/10'
          : 'bg-white/85 dark:bg-zinc-950/75 dark:shadow-[0_16px_48px_-18px_rgba(0,0,0,0.75),0_0_0_1px_rgba(240,90,32,0.14)]'
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-2xl shadow-md',
            accent
              ? 'bg-fire-500 text-white shadow-fire-500/30'
              : 'bg-fire-500 text-white shadow-fire-500/30'
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

export default function InventoryPage() {
  const { formatMoney } = useOwnerRestaurantRegional();
  const { canEdit, canDelete } = useDashboardPermissions();
  const canEditInv = canEdit('inventory');
  const canDeleteInv = canDelete('inventory');
  const {
    activeBranchId,
    activeBranchUrlId,
    branches,
    loading: branchLoading,
  } = useBranchContext();
  const activeBranchName =
    branches.find((b) => b.id === activeBranchId)?.name ?? null;

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
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entrySearch, setEntrySearch] = useState('');
  const [appliedEntrySearch, setAppliedEntrySearch] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const ingredientLoadId = useRef(0);
  const entryLoadId = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  const loadSummary = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setSummaryLoading(true);
    try {
      const res = await axios.get<{ data: InventorySummary }>(
        withBranchQuery(
          '/api/restaurant/inventory/summary',
          activeBranchId,
          activeBranchUrlId
        ),
        { headers: NO_STORE_HEADERS, params: { _: Date.now() } }
      );
      setSummary(res.data.data);
    } catch {
      setSummary(null);
    } finally {
      if (!opts?.silent) setSummaryLoading(false);
    }
  }, [activeBranchId, activeBranchUrlId]);

  const loadIngredients = useCallback(
    async (p: number, q: string, opts?: { silent?: boolean }) => {
      const requestId = ++ingredientLoadId.current;
      if (!opts?.silent) setLoading(true);
      try {
        const res = await axios.get<{
          data: IngredientRow[];
          meta: { total: number; totalPages: number; page: number };
        }>(
          withBranchQuery(
            '/api/restaurant/inventory/ingredients',
            activeBranchId,
            activeBranchUrlId
          ),
          {
            params: {
              page: p,
              limit: 20,
              q: q || undefined,
              active: '0',
              _: Date.now(),
            },
            headers: NO_STORE_HEADERS,
          }
        );
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
    [activeBranchId, activeBranchUrlId]
  );

  const loadEntries = useCallback(
    async (p: number, q: string, opts?: { silent?: boolean }) => {
      const requestId = ++entryLoadId.current;
      if (!opts?.silent) setEntriesLoading(true);
      try {
        const res = await axios.get<{
          data: EntryRow[];
          meta: { total: number; totalPages: number; page: number };
        }>(
          withBranchQuery(
            '/api/restaurant/inventory/entries',
            activeBranchId,
            activeBranchUrlId
          ),
          {
            params: {
              page: p,
              limit: 20,
              q: q || undefined,
              _: Date.now(),
            },
            headers: NO_STORE_HEADERS,
          }
        );
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
    },
    [activeBranchId, activeBranchUrlId]
  );

  const loadActiveIngredients = useCallback(async () => {
    try {
      const res = await axios.get<{ data: IngredientRow[] }>(
        withBranchQuery(
          '/api/restaurant/inventory/ingredients',
          activeBranchId,
          activeBranchUrlId
        ),
        {
          params: { page: 1, limit: 100, active: '1', _: Date.now() },
          headers: NO_STORE_HEADERS,
        }
      );
      setIngredients(res.data.data ?? []);
    } catch {
      setIngredients([]);
    }
  }, [activeBranchId, activeBranchUrlId]);

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

  const applyEntrySearch = () => {
    const q = entrySearch.trim();
    setEntryPage(1);
    setAppliedEntrySearch(q);
    if (entryPage === 1 && appliedEntrySearch === q) {
      void loadEntries(1, q);
    }
  };

  const clearEntrySearch = () => {
    setEntrySearch('');
    setEntryPage(1);
    setAppliedEntrySearch('');
    if (entryPage === 1 && appliedEntrySearch === '') {
      void loadEntries(1, '');
    }
  };

  const resetEntryForm = () => {
    setEntryIngredientId('');
    setEntryProductId('');
    setEntryQty('');
    setEntryReason('');
    setProductSearch('');
  };

  const openEntryDialog = () => {
    resetEntryForm();
    setEntryDialogOpen(true);
    void loadActiveIngredients();
  };

  useEffect(() => {
    void loadIngredients(page, appliedSearch);
  }, [page, appliedSearch, loadIngredients]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (tab === 'entries') void loadEntries(entryPage, appliedEntrySearch);
  }, [tab, entryPage, appliedEntrySearch, loadEntries]);

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
      void loadEntries(entryPage, appliedEntrySearch, { silent: true });
      void loadSummary({ silent: true });
    }, 80);
  }, [
    loadIngredients,
    loadActiveIngredients,
    loadEntries,
    loadSummary,
    page,
    appliedSearch,
    entryPage,
    appliedEntrySearch,
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
      await axios.post(
        withBranchQuery(
          '/api/restaurant/inventory/entries',
          activeBranchId,
          activeBranchUrlId
        ),
        {
          ingredientId: entryIngredientId,
        quantity: Number(entryQty),
        reason: entryReason.trim(),
        menuItemId: entryProductId || null,
        }
      );
      toast.success('Stock entry saved.');
      resetEntryForm();
      setEntryDialogOpen(false);
      setEntryPage(1);
      void loadIngredients(page, appliedSearch, { silent: true });
      void loadActiveIngredients();
      void loadEntries(1, appliedEntrySearch, { silent: true });
      void loadSummary({ silent: true });
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
      await axios.delete(ingredientApiPath(deleteId));
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
        withBranchQuery(
          ingredientApiPath(stockRow.id),
          activeBranchId,
          activeBranchUrlId
        ),
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
      description={
        activeBranchName
          ? `Track ingredients and stock for ${activeBranchName}. Quantities are per branch.`
          : 'Track ingredients, recipes on products, and manual stock usage.'
      }
      loading={branchLoading}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLoading && !summary ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[88px] animate-pulse rounded-3xl bg-muted/50"
              />
            ))}
          </>
        ) : (
          <>
            <InventoryInsightChip
              icon={Wallet}
              label="Inventory value"
              value={formatMoney(summary?.totalInventoryValue ?? 0)}
              hint={
                activeBranchName
                  ? `On hand at ${activeBranchName}`
                  : 'All branches combined'
              }
            />
            <InventoryInsightChip
              icon={AlertTriangle}
              label="Low stock"
              value={String(summary?.lowStockCount ?? 0)}
              hint="At or below alert quantity"
              accent={(summary?.lowStockCount ?? 0) > 0}
            />
            <InventoryInsightChip
              icon={Package}
              label="Active ingredients"
              value={String(summary?.activeIngredientCount ?? 0)}
              hint="In your catalog"
            />
            <InventoryInsightChip
              icon={TrendingDown}
              label="Usage (30 days)"
              value={formatMoney(summary?.usageValue30d ?? 0)}
              hint={`${summary?.entryCount30d ?? 0} stock entr${
                summary?.entryCount30d === 1 ? 'y' : 'ies'
              }`}
            />
          </>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'ingredients' | 'entries')}
        className="w-full space-y-4"
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <TabsList className="grid h-11 w-full max-w-none flex-1 grid-cols-2 sm:flex-1">
            <TabsTrigger value="ingredients" className="gap-2">
              <Package className="h-4 w-4" />
              Ingredients
            </TabsTrigger>
            <TabsTrigger value="entries" className="gap-2">
              <List className="h-4 w-4" />
              Stock entries
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={tab === 'entries' ? entriesLoading : loading}
            onClick={() => refreshInventory()}
            title="Refresh"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                (tab === 'entries' ? entriesLoading : loading) && 'animate-spin'
              )}
            />
          </Button>
        </div>

        <TabsContent value="ingredients" className="mt-0 w-full">
        <DashboardCard className="w-full">
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
              className="relative w-full max-w-xl"
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
                  <DashboardTable minWidth={1040}>
                    <DashboardTableHeader>
                      <DashboardTableRow>
                        <DashboardTableHead>Ingredient</DashboardTableHead>
                        <DashboardTableHead>Stock</DashboardTableHead>
                        <DashboardTableHead>Unit cost</DashboardTableHead>
                        <DashboardTableHead>Stock value</DashboardTableHead>
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
                              {row.unitCost != null
                                ? formatMoney(row.unitCost)
                                : '—'}
                              {row.unitCost != null ? (
                                <p className="text-[11px] text-muted-foreground">
                                  per {formatIngredientUnit(row.unit)}
                                </p>
                              ) : null}
                            </DashboardTableCell>
                            <DashboardTableCell>
                              <span className="font-medium tabular-nums">
                                {formatMoney(row.stockValue ?? 0)}
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
                                        href={ingredientEditPath(row.id)}
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
                  hideWhenSinglePage={false}
                />
                <p className="text-xs text-muted-foreground">
                  {total} ingredient{total === 1 ? '' : 's'}
                </p>
              </>
            )}
          </DashboardCardContent>
        </DashboardCard>
        </TabsContent>

        <TabsContent value="entries" className="mt-0 w-full">
          <DashboardCard className="w-full">
            <DashboardCardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DashboardCardTitle>Stock entries</DashboardCardTitle>
              {canEditInv ? (
                <Button type="button" onClick={openEntryDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Deduct stock
                </Button>
              ) : null}
            </DashboardCardHeader>
            <DashboardCardContent className="space-y-4">
              <form
                className="relative w-full max-w-xl"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyEntrySearch();
                }}
              >
                <Input
                  type="search"
                  value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  placeholder="Search entries by ingredient, product, or reason…"
                  className={cn(
                    'h-10 bg-background [&::-webkit-search-cancel-button]:hidden',
                    appliedEntrySearch && entrySearch.trim() === appliedEntrySearch
                      ? 'pr-12'
                      : 'pr-24'
                  )}
                  autoComplete="off"
                  aria-label="Search stock entries"
                />
                {appliedEntrySearch && entrySearch.trim() === appliedEntrySearch ? (
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="absolute right-0 top-1/2 h-10 w-10 -translate-y-1/2"
                    aria-label="Clear search"
                    onClick={clearEntrySearch}
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
              {entriesLoading && entries.length === 0 ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              ) : entries.length === 0 && !entriesLoading ? (
                <p className="text-sm text-muted-foreground">
                  {appliedEntrySearch
                    ? 'No entries match your search.'
                    : 'No entries yet.'}
                </p>
              ) : (
                <>
                  <DashboardTableWrapper>
                    <DashboardTable minWidth={960}>
                      <DashboardTableHeader>
                        <DashboardTableRow>
                          <DashboardTableHead>When</DashboardTableHead>
                          <DashboardTableHead>Ingredient</DashboardTableHead>
                          <DashboardTableHead>Qty</DashboardTableHead>
                          <DashboardTableHead>Value</DashboardTableHead>
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
                              {row.ingredient.unitCost != null
                                ? formatMoney(
                                    row.quantity * row.ingredient.unitCost
                                  )
                                : '—'}
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
                  <p className="text-xs text-muted-foreground">
                    {entryTotal} entr{entryTotal === 1 ? 'y' : 'ies'}
                  </p>
                </>
              )}
            </DashboardCardContent>
          </DashboardCard>
        </TabsContent>
      </Tabs>

      <Dialog
        open={entryDialogOpen}
        onOpenChange={(open) => {
          if (!open && !savingEntry) {
            setEntryDialogOpen(false);
            resetEntryForm();
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Deduct stock</DialogTitle>
            <DialogDescription>
              Record manual stock usage. Quantity is subtracted from branch
              inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
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
                placeholder="Amount to deduct"
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
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingEntry}
              onClick={() => {
                setEntryDialogOpen(false);
                resetEntryForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingEntry}
              onClick={() => void submitEntry()}
            >
              {savingEntry ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
