'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  Archive,
  Boxes,
  FileBarChart,
  Loader2,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TablePagination } from '@/components/ui/table-pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { extractApiErrorMessage } from '@/lib/extract-api-error';
import { formatIngredientUnit } from '@/lib/inventory/stock';
import { defaultReportFromToKeys } from '@/lib/reports/date-range';
import { cn } from '@/lib/utils';
import type { TransactionHistoryRow } from '@/types/transaction-history';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { useTranslation } from 'react-i18next';

type TrackTab = 'financial' | 'orders' | 'inventory' | 'expenses';

type ReportSummary = {
  kpis: {
    financial: { transactionCount: number; transactionAmount: number };
    orders: {
      orderCount: number;
      revenueAmount: number;
      revenueOrders: number;
      pendingCount: number;
      canceledCount: number;
    };
    inventory: {
      totalInventoryValue: number;
      lowStockCount: number;
      usageValueInRange: number;
      entryCountInRange: number;
    };
    expenses: {
      totalAmount: number;
      inventoryAmount: number;
      manualAmount: number;
      count: number;
    };
  };
  pnl: { revenue: number; expenses: number; profit: number };
  meta: {
    from: string;
    to: string;
    branchId: string | null;
    canViewHistorical: boolean;
  };
};

type OrderRow = {
  id: string;
  shortOrderId: string | null;
  ticketNumber: number | null;
  sourceType: string;
  status: string;
  paymentStatus: string | null;
  total: number | null;
  revenueAmount: number;
  createdAt: string;
};

type InventoryEntryRow = {
  id: string;
  quantity: number;
  reason: string;
  source: string;
  createdAt: string;
  usageValue: number;
  unitCost: number | null;
  ingredient: { id: string; name: string; unit: string; unitCost: number | null };
  menuItem: { id: string; name: string } | null;
};

type ExpenseRow = {
  id: string;
  type: 'INVENTORY' | 'MANUAL';
  title: string;
  amount: number;
  notes: string | null;
  occurredAt: string;
  quantity: number | null;
  ingredient: { id: string; name: string; unit: string } | null;
};

function ReportInsightChip({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-white/85 p-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(240,90,32,0.06)] backdrop-blur-xl dark:bg-zinc-950/75 dark:shadow-[0_16px_48px_-18px_rgba(0,0,0,0.75),0_0_0_1px_rgba(240,90,32,0.14)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fire-500 text-white shadow-md shadow-fire-500/30">
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

export default function ReportsPage() {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const { formatMoney } = useOwnerRestaurantRegional();
  const {
    loading: branchLoading,
    activeBranchId,
    activeBranchUrlId,
    branches,
  } = useBranchContext();
  const activeBranchName =
    branches.find((b) => b.id === activeBranchId)?.name ?? null;

  const defaults = useMemo(() => defaultReportFromToKeys(true), []);
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [tab, setTab] = useState<TrackTab>('financial');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [trackLoading, setTrackLoading] = useState(false);

  const [txnRows, setTxnRows] = useState<TransactionHistoryRow[]>([]);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [invRows, setInvRows] = useState<InventoryEntryRow[]>([]);
  const [expRows, setExpRows] = useState<ExpenseRow[]>([]);

  const applyDates = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setPage(1);
  };

  const applySearch = () => {
    setAppliedSearch(searchDraft.trim());
    setPage(1);
  };

  const loadSummary = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setSummaryLoading(true);
      try {
        const res = await axios.get<ReportSummary>(
          withBranchQuery(
            '/api/restaurant/reports/summary',
            activeBranchId,
            activeBranchUrlId
          ),
          {
            params: {
              from: appliedFrom,
              to: appliedTo,
              _: Date.now(),
            },
            headers: { 'Cache-Control': 'no-store' },
          }
        );
        setSummary(res.data);
        if (!res.data.meta.canViewHistorical) {
          setFromDate(res.data.meta.from);
          setToDate(res.data.meta.to);
          setAppliedFrom(res.data.meta.from);
          setAppliedTo(res.data.meta.to);
        }
      } catch (e) {
        toast.error(
          extractApiErrorMessage(e, t('dashboard.reports.loadSummaryFailed'))
        );
      } finally {
        if (!opts?.silent) setSummaryLoading(false);
      }
    },
    [activeBranchId, activeBranchUrlId, appliedFrom, appliedTo, t]
  );

  const loadTrack = useCallback(
    async (p: number, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setTrackLoading(true);
      try {
        const baseParams = {
          page: p,
          limit: 20,
          q: appliedSearch || undefined,
          from: appliedFrom,
          to: appliedTo,
          _: Date.now(),
        };
        const url = (path: string) =>
          withBranchQuery(path, activeBranchId, activeBranchUrlId);

        if (tab === 'financial') {
          const res = await axios.get<{
            data: TransactionHistoryRow[];
            meta: { total: number; totalPages: number; page: number };
          }>(url('/api/restaurant/reports/transactions'), {
            params: {
              ...baseParams,
              kind: typeFilter === 'all' ? undefined : typeFilter,
            },
            headers: { 'Cache-Control': 'no-store' },
          });
          setTxnRows(res.data.data ?? []);
          setTotal(res.data.meta?.total ?? 0);
          setTotalPages(res.data.meta?.totalPages ?? 1);
          setPage(res.data.meta?.page ?? p);
        } else if (tab === 'orders') {
          const res = await axios.get<{
            data: OrderRow[];
            meta: { total: number; totalPages: number; page: number };
          }>(url('/api/restaurant/reports/orders'), {
            params: {
              ...baseParams,
              status: typeFilter === 'all' ? undefined : typeFilter,
            },
            headers: { 'Cache-Control': 'no-store' },
          });
          setOrderRows(res.data.data ?? []);
          setTotal(res.data.meta?.total ?? 0);
          setTotalPages(res.data.meta?.totalPages ?? 1);
          setPage(res.data.meta?.page ?? p);
        } else if (tab === 'inventory') {
          const res = await axios.get<{
            data: InventoryEntryRow[];
            meta: { total: number; totalPages: number; page: number };
          }>(url('/api/restaurant/reports/inventory'), {
            params: {
              ...baseParams,
              source: typeFilter === 'all' ? undefined : typeFilter,
            },
            headers: { 'Cache-Control': 'no-store' },
          });
          setInvRows(res.data.data ?? []);
          setTotal(res.data.meta?.total ?? 0);
          setTotalPages(res.data.meta?.totalPages ?? 1);
          setPage(res.data.meta?.page ?? p);
        } else {
          const res = await axios.get<{
            data: ExpenseRow[];
            meta: { total: number; totalPages: number; page: number };
          }>(url('/api/restaurant/reports/expenses'), {
            params: {
              ...baseParams,
              type: typeFilter === 'all' ? undefined : typeFilter,
            },
            headers: { 'Cache-Control': 'no-store' },
          });
          setExpRows(res.data.data ?? []);
          setTotal(res.data.meta?.total ?? 0);
          setTotalPages(res.data.meta?.totalPages ?? 1);
          setPage(res.data.meta?.page ?? p);
        }
      } catch (e) {
        toast.error(
          extractApiErrorMessage(e, t('dashboard.reports.loadTrackFailed'))
        );
      } finally {
        if (!opts?.silent) setTrackLoading(false);
      }
    },
    [
      tab,
      typeFilter,
      appliedSearch,
      appliedFrom,
      appliedTo,
      activeBranchId,
      activeBranchUrlId,
      t,
    ]
  );

  useEffect(() => {
    if (branchLoading) return;
    void loadSummary();
  }, [branchLoading, loadSummary]);

  useEffect(() => {
    if (branchLoading) return;
    void loadTrack(1);
  }, [branchLoading, loadTrack]);

  useEffect(() => {
    setTypeFilter('all');
    setSearchDraft('');
    setAppliedSearch('');
    setPage(1);
  }, [tab]);

  const typeOptions = useMemo(() => {
    if (tab === 'financial') {
      return [
        { value: 'all', label: t('dashboard.reports.filterAllKinds') },
        { value: 'ORDER', label: t('dashboard.reports.kindOrder') },
        { value: 'REGISTER', label: t('dashboard.reports.kindRegister') },
        {
          value: 'SUBSCRIPTION',
          label: t('dashboard.reports.kindSubscription'),
        },
      ];
    }
    if (tab === 'orders') {
      return [
        { value: 'all', label: t('dashboard.reports.filterAllStatuses') },
        { value: 'completed', label: t('dashboard.reports.statusCompleted') },
        { value: 'pending', label: t('dashboard.reports.statusPending') },
        { value: 'canceled', label: t('dashboard.reports.statusCanceled') },
      ];
    }
    if (tab === 'inventory') {
      return [
        { value: 'all', label: t('dashboard.reports.filterAllSources') },
        { value: 'MANUAL', label: t('dashboard.reports.sourceManual') },
        { value: 'ORDER', label: t('dashboard.reports.sourceOrder') },
      ];
    }
    return [
      { value: 'all', label: t('dashboard.reports.filterAllTypes') },
      { value: 'INVENTORY', label: t('dashboard.expenses.inventory') },
      { value: 'MANUAL', label: t('dashboard.expenses.manual') },
    ];
  }, [tab, t]);

  const kpis = summary?.kpis;
  const pnl = summary?.pnl;
  const profitPositive = (pnl?.profit ?? 0) >= 0;

  return (
    <MenuPageShell
      title={t('dashboard.reports.title')}
      description={
        activeBranchName
          ? t('dashboard.reports.descriptionBranch', {
              branch: activeBranchName,
            })
          : t('dashboard.reports.description')
      }
      loading={branchLoading}
    >
      <DashboardCard>
        <DashboardCardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <DashboardCardTitle>
              {t('dashboard.reports.dateRangeTitle')}
            </DashboardCardTitle>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.reports.dateRangeHint')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <Input
              type="date"
              className="w-full sm:w-[150px]"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label={t('dashboard.common.fromDate')}
              disabled={summary?.meta.canViewHistorical === false}
            />
            <Input
              type="date"
              className="w-full sm:w-[150px]"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label={t('dashboard.common.toDate')}
              disabled={summary?.meta.canViewHistorical === false}
            />
            <Button type="button" onClick={applyDates}>
              {t('dashboard.common.apply')}
            </Button>
          </div>
        </DashboardCardHeader>
      </DashboardCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLoading && !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-3xl bg-muted/50"
            />
          ))
        ) : (
          <>
            <ReportInsightChip
              icon={Archive}
              label={t('dashboard.reports.financial')}
              value={formatMoney(kpis?.financial.transactionAmount ?? 0)}
              hint={t('dashboard.reports.transactionsHint', {
                count: kpis?.financial.transactionCount ?? 0,
              })}
            />
            <ReportInsightChip
              icon={ShoppingCart}
              label={t('dashboard.reports.orders')}
              value={formatMoney(kpis?.orders.revenueAmount ?? 0)}
              hint={t('dashboard.reports.ordersHint', {
                orders: kpis?.orders.orderCount ?? 0,
                paid: kpis?.orders.revenueOrders ?? 0,
              })}
            />
            <ReportInsightChip
              icon={Boxes}
              label={t('dashboard.reports.inventory')}
              value={formatMoney(kpis?.inventory.totalInventoryValue ?? 0)}
              hint={t('dashboard.reports.inventoryHint', {
                low: kpis?.inventory.lowStockCount ?? 0,
                usage: formatMoney(kpis?.inventory.usageValueInRange ?? 0),
              })}
            />
            <ReportInsightChip
              icon={Wallet}
              label={t('dashboard.reports.expenses')}
              value={formatMoney(kpis?.expenses.totalAmount ?? 0)}
              hint={t('dashboard.reports.expensesHint', {
                count: kpis?.expenses.count ?? 0,
              })}
            />
          </>
        )}
      </div>

      <DashboardCard>
        <DashboardCardHeader>
          <DashboardCardTitle>{t('dashboard.reports.pnlTitle')}</DashboardCardTitle>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.reports.pnlDescription')}
          </p>
        </DashboardCardHeader>
        <DashboardCardContent>
          {summaryLoading && !summary ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.reports.revenue')}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(pnl?.revenue ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.reports.expenses')}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(pnl?.expenses ?? 0)}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-2xl border p-4',
                  profitPositive
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-destructive/30 bg-destructive/10'
                )}
              >
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {profitPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {t('dashboard.reports.profitLoss')}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(pnl?.profit ?? 0)}
                </p>
              </div>
            </div>
          )}
        </DashboardCardContent>
      </DashboardCard>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TrackTab)}
        className="w-full"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="financial" className="gap-1.5">
            <Archive className="h-3.5 w-3.5" />
            {t('dashboard.reports.financial')}
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            {t('dashboard.reports.orders')}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Boxes className="h-3.5 w-3.5" />
            {t('dashboard.reports.inventory')}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            {t('dashboard.reports.expenses')}
          </TabsTrigger>
        </TabsList>

        <DashboardCard className="mt-4">
          <DashboardCardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <DashboardCardTitle className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                {tab === 'financial'
                  ? t('dashboard.reports.financialTrack')
                  : tab === 'orders'
                    ? t('dashboard.reports.ordersTrack')
                    : tab === 'inventory'
                      ? t('dashboard.reports.inventoryTrack')
                      : t('dashboard.reports.expensesTrack')}
              </DashboardCardTitle>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.reports.matchingRows', {
                  count: total,
                  rows:
                    total === 1
                      ? t('dashboard.common.row')
                      : t('dashboard.common.rows'),
                })}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:max-w-2xl sm:flex-row sm:flex-wrap sm:items-end">
              <div className="relative min-w-[160px] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={t('dashboard.reports.searchPlaceholder')}
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applySearch();
                    }
                  }}
                />
              </div>
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('dashboard.common.filter')} />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" onClick={applySearch}>
                {t('dashboard.common.search')}
              </Button>
            </div>
          </DashboardCardHeader>
          <DashboardCardContent>
            <TabsContent value="financial" className="mt-0">
              <TrackTable loading={trackLoading} empty={txnRows.length === 0}>
                <DashboardTableHeader>
                  <DashboardTableRow>
                    <DashboardTableHead>{t('dashboard.common.date')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.reports.colKind')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.reports.colSource')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.common.status')}</DashboardTableHead>
                    <DashboardTableHead className="text-right">
                      {t('dashboard.common.amount')}
                    </DashboardTableHead>
                  </DashboardTableRow>
                </DashboardTableHeader>
                <DashboardTableBody>
                  {txnRows.map((row) => (
                    <DashboardTableRow key={row.key}>
                      <DashboardTableCell className="whitespace-nowrap tabular-nums">
                        {format(new Date(row.createdAt), 'dd MMM yyyy')}
                      </DashboardTableCell>
                      <DashboardTableCell>{row.kind}</DashboardTableCell>
                      <DashboardTableCell>
                        {row.customerName || row.source}
                      </DashboardTableCell>
                      <DashboardTableCell>{row.status}</DashboardTableCell>
                      <DashboardTableCell className="text-right tabular-nums">
                        {row.amount != null ? formatMoney(row.amount) : '—'}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </TrackTable>
            </TabsContent>

            <TabsContent value="orders" className="mt-0">
              <TrackTable loading={trackLoading} empty={orderRows.length === 0}>
                <DashboardTableHeader>
                  <DashboardTableRow>
                    <DashboardTableHead>{t('dashboard.common.date')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.reports.colTicket')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.reports.colChannel')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.common.status')}</DashboardTableHead>
                    <DashboardTableHead className="text-right">
                      {t('dashboard.reports.colTotal')}
                    </DashboardTableHead>
                    <DashboardTableHead className="text-right">
                      {t('dashboard.reports.revenue')}
                    </DashboardTableHead>
                  </DashboardTableRow>
                </DashboardTableHeader>
                <DashboardTableBody>
                  {orderRows.map((row) => (
                    <DashboardTableRow key={row.id}>
                      <DashboardTableCell className="whitespace-nowrap tabular-nums">
                        {format(new Date(row.createdAt), 'dd MMM yyyy')}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.ticketNumber != null
                          ? `#${row.ticketNumber}`
                          : row.shortOrderId ?? '—'}
                      </DashboardTableCell>
                      <DashboardTableCell>{row.sourceType}</DashboardTableCell>
                      <DashboardTableCell>{row.status}</DashboardTableCell>
                      <DashboardTableCell className="text-right tabular-nums">
                        {formatMoney(row.total ?? 0)}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right tabular-nums">
                        {formatMoney(row.revenueAmount)}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </TrackTable>
            </TabsContent>

            <TabsContent value="inventory" className="mt-0">
              <TrackTable loading={trackLoading} empty={invRows.length === 0}>
                <DashboardTableHeader>
                  <DashboardTableRow>
                    <DashboardTableHead>{t('dashboard.common.date')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.reports.colIngredient')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.reports.colSource')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.reports.colQty')}</DashboardTableHead>
                    <DashboardTableHead className="text-right">
                      {t('dashboard.reports.colUsageValue')}
                    </DashboardTableHead>
                  </DashboardTableRow>
                </DashboardTableHeader>
                <DashboardTableBody>
                  {invRows.map((row) => (
                    <DashboardTableRow key={row.id}>
                      <DashboardTableCell className="whitespace-nowrap tabular-nums">
                        {format(new Date(row.createdAt), 'dd MMM yyyy')}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div>
                          <p className="font-medium">
                            {resolveBilingualText(row.ingredient.name, uiLang)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.reason}
                          </p>
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell>{row.source}</DashboardTableCell>
                      <DashboardTableCell className="tabular-nums">
                        {row.quantity}{' '}
                        {formatIngredientUnit(row.ingredient.unit)}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right tabular-nums">
                        {formatMoney(row.usageValue)}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </TrackTable>
            </TabsContent>

            <TabsContent value="expenses" className="mt-0">
              <TrackTable loading={trackLoading} empty={expRows.length === 0}>
                <DashboardTableHeader>
                  <DashboardTableRow>
                    <DashboardTableHead>{t('dashboard.common.date')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.common.type')}</DashboardTableHead>
                    <DashboardTableHead>{t('dashboard.common.title')}</DashboardTableHead>
                    <DashboardTableHead className="text-right">
                      {t('dashboard.common.amount')}
                    </DashboardTableHead>
                  </DashboardTableRow>
                </DashboardTableHeader>
                <DashboardTableBody>
                  {expRows.map((row) => (
                    <DashboardTableRow key={row.id}>
                      <DashboardTableCell className="whitespace-nowrap tabular-nums">
                        {format(new Date(row.occurredAt), 'dd MMM yyyy')}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.type === 'INVENTORY'
                          ? t('dashboard.expenses.inventory')
                          : t('dashboard.expenses.manual')}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div>
                          <p className="font-medium">{row.title}</p>
                          {row.ingredient ? (
                            <p className="text-xs text-muted-foreground">
                              {resolveBilingualText(row.ingredient.name, uiLang)}
                              {row.quantity != null
                                ? ` · +${row.quantity} ${formatIngredientUnit(row.ingredient.unit)}`
                                : ''}
                            </p>
                          ) : row.notes ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {row.notes}
                            </p>
                          ) : null}
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right tabular-nums">
                        {formatMoney(row.amount)}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </TrackTable>
            </TabsContent>

            <TablePagination
              pagination={{
                page,
                pageSize: 20,
                total,
                totalPages,
              }}
              page={page}
              onPageChange={(p) => void loadTrack(p)}
              loading={trackLoading}
              hideWhenSinglePage={false}
            />
          </DashboardCardContent>
        </DashboardCard>
      </Tabs>
    </MenuPageShell>
  );
}

function TrackTable({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (empty) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t('dashboard.reports.emptyFiltered')}
      </p>
    );
  }
  return (
    <DashboardTableWrapper>
      <DashboardTable>{children}</DashboardTable>
    </DashboardTableWrapper>
  );
}
