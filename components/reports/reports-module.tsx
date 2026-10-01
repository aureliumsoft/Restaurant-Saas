'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Boxes,
  Calendar,
  Download,
  FileBarChart,
  Loader2,
  Printer,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchField } from '@/components/ui/search-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablePagination } from '@/components/ui/table-pagination';
import { useBranchContext, withBranchQuery } from '@/hooks/use-branch-context';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { extractApiErrorMessage } from '@/lib/extract-api-error';
import { formatIngredientUnit } from '@/lib/inventory/stock';
import { formatExpenseDisplayTitle } from '@/lib/expenses/format-expense-title';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import {
  defaultReportFromToKeys,
  monthReportFromToKeys,
  weekReportFromToKeys,
} from '@/lib/reports/date-range';
import {
  buildCsv,
  downloadCsv,
  printReportHtml,
  rowsToHtmlTable,
} from '@/lib/reports/export';
import { cn } from '@/lib/utils';
import {
  isCanceledPaymentStatus,
  isCompletedPaymentStatus,
  isPendingPaymentStatus,
  salesOrderStatusBucket,
} from '@/lib/sales-order-status';
import type { TransactionHistoryRow } from '@/types/transaction-history';

export type ReportType = 'sales' | 'inventory' | 'expenses' | 'financial';
type SalesChannel = 'all' | 'online' | 'pos' | 'kiosk';

type OrderStats = {
  totalOrders: number;
  totalAmount: number;
  pending: { count: number; amount: number };
  canceled: { count: number; amount: number };
  completed: { count: number; amount: number };
};

const emptyOrderStats: OrderStats = {
  totalOrders: 0,
  totalAmount: 0,
  pending: { count: 0, amount: 0 },
  canceled: { count: 0, amount: 0 },
  completed: { count: 0, amount: 0 },
};

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
      itemCount?: number;
    };
    expenses: {
      totalAmount: number;
      inventoryAmount: number;
      manualAmount: number;
      count: number;
    };
  };
  pnl: {
    revenue: number;
    expenses: number;
    inventoryExpenses?: number;
    operatingExpenses?: number;
    profit: number;
    profitMargin?: number;
    paymentBreakdown?: {
      cash: number;
      card: number;
      other: number;
    };
  };
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
  ingredient: { id: string; name: string; unit: string };
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

function formatOrderChannel(
  sourceType: string,
  t: (key: string) => string
): string {
  const s = String(sourceType ?? '').toUpperCase();
  if (s === 'ONLINE') return t('dashboard.analytics.channelOnline');
  if (s === 'POS') return t('dashboard.analytics.channelPos');
  if (s === 'KIOSK') return t('dashboard.analytics.channelKiosk');
  return sourceType || '—';
}

function formatPaymentStatusLabel(
  paymentStatus: string | null | undefined,
  t: (key: string) => string
): string {
  if (!paymentStatus?.trim()) return '—';
  if (isCompletedPaymentStatus(paymentStatus)) {
    return t('dashboard.reports.statusCompleted');
  }
  if (isPendingPaymentStatus(paymentStatus)) {
    return t('dashboard.reports.statusPending');
  }
  if (isCanceledPaymentStatus(paymentStatus)) {
    return t('dashboard.reports.statusCanceled');
  }
  return paymentStatus;
}

function formatOrderStatusLabel(
  status: string,
  t: (key: string) => string
): string {
  const bucket = salesOrderStatusBucket(status);
  if (bucket === 'completed') return t('dashboard.reports.statusCompleted');
  if (bucket === 'canceled') return t('dashboard.reports.statusCanceled');
  if (bucket === 'pending') return t('dashboard.reports.statusPending');
  return status || '—';
}

function statusToneClass(
  tone: 'completed' | 'pending' | 'canceled' | 'neutral'
): string {
  if (tone === 'completed') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  }
  if (tone === 'pending') {
    return 'bg-orange-500/15 text-orange-700 dark:text-orange-400';
  }
  if (tone === 'canceled') {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-400';
  }
  return 'bg-muted text-muted-foreground';
}

function OrderStatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const bucket = salesOrderStatusBucket(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border-0 px-3 py-0.5 text-xs font-semibold capitalize',
        statusToneClass(bucket)
      )}
    >
      {formatOrderStatusLabel(status, t)}
    </Badge>
  );
}

function PaymentStatusBadge({
  paymentStatus,
  t,
}: {
  paymentStatus: string | null | undefined;
  t: (key: string) => string;
}) {
  if (!paymentStatus?.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }
  const tone: 'completed' | 'pending' | 'canceled' | 'neutral' =
    isCompletedPaymentStatus(paymentStatus)
      ? 'completed'
      : isPendingPaymentStatus(paymentStatus)
        ? 'pending'
        : isCanceledPaymentStatus(paymentStatus)
          ? 'canceled'
          : 'neutral';
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border-0 px-3 py-0.5 text-xs font-semibold capitalize',
        statusToneClass(tone)
      )}
    >
      {formatPaymentStatusLabel(paymentStatus, t)}
    </Badge>
  );
}

function trackingNumberLabel(
  shortOrderId?: string | null,
  fallbackId?: string | null
): string {
  const token = (shortOrderId ?? fallbackId ?? '').replace(/[^a-zA-Z0-9]/g, '');
  if (!token) return '—';
  return token.length <= 8 ? token.toUpperCase() : token.slice(0, 6).toUpperCase();
}

function ticketNumberLabel(ticketNumber?: number | null): string {
  if (ticketNumber == null) return '—';
  return `#${ticketNumber}`;
}

function parseReportType(raw: string | null): ReportType {
  if (
    raw === 'sales' ||
    raw === 'inventory' ||
    raw === 'expenses' ||
    raw === 'financial'
  ) {
    return raw;
  }
  if (raw === 'orders') return 'sales';
  return 'sales';
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'green' | 'red' | 'blue' | 'orange' | 'purple';
}) {
  const toneClass =
    tone === 'green'  
      ? 'border-emerald-200 bg-emerald-100 text-emerald-900'
      : tone === 'red'
        ? 'border-rose-200 bg-rose-100 text-rose-900'
        : tone === 'blue'
          ? 'border-sky-200 bg-sky-100 text-sky-900'
          : tone === 'orange'
            ? 'border-orange-200 bg-orange-100 text-orange-900'
            : tone === 'purple'
              ? 'border-violet-200 bg-violet-100 text-violet-900'
              : 'border-border bg-secondary text-foreground';
  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', toneClass)}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
    </div>
  );
}

function TrackTable({
  loading,
  empty,
  emptyLabel,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
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
        {emptyLabel}
      </p>
    );
  }
  return (
    <DashboardTableWrapper>
      <DashboardTable>{children}</DashboardTable>
    </DashboardTableWrapper>
  );
}

export function ReportsModule() {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
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

  const [reportType, setReportType] = useState<ReportType>(() =>
    parseReportType(searchParams.get('type'))
  );

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [salesChannel, setSalesChannel] = useState<SalesChannel>('all');
  const [orderStats, setOrderStats] = useState<OrderStats>(emptyOrderStats);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [trackLoading, setTrackLoading] = useState(false);

  const [txnRows, setTxnRows] = useState<TransactionHistoryRow[]>([]);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [invRows, setInvRows] = useState<InventoryEntryRow[]>([]);
  const [expRows, setExpRows] = useState<ExpenseRow[]>([]);

  const [confirmCsv, setConfirmCsv] = useState(false);

  useEffect(() => {
    const fromQuery = parseReportType(searchParams.get('type'));
    setReportType(fromQuery);
  }, [searchParams]);

  const applyDates = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setAppliedFrom(from);
    setAppliedTo(to);
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
            params: { from: appliedFrom, to: appliedTo, _: Date.now() },
            headers: { 'Cache-Control': 'no-store' },
          }
        );
        setSummary(res.data);
        if (!res.data.meta.canViewHistorical) {
          applyDates(res.data.meta.from, res.data.meta.to);
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

        if (reportType === 'financial') {
          const res = await axios.get<{
            data: TransactionHistoryRow[];
            meta: { total: number; totalPages: number; page: number };
          }>(url('/api/restaurant/reports/transactions'), {
            params: {
              ...baseParams,
              kind: typeFilter === 'all' ? undefined : typeFilter,
              status: statusFilter === 'all' ? undefined : statusFilter,
              source: sourceFilter === 'all' ? undefined : sourceFilter,
              payment: paymentFilter === 'all' ? undefined : paymentFilter,
            },
            headers: { 'Cache-Control': 'no-store' },
          });
          setTxnRows(res.data.data ?? []);
          setTotal(res.data.meta?.total ?? 0);
          setTotalPages(res.data.meta?.totalPages ?? 1);
          setPage(res.data.meta?.page ?? p);
        } else if (reportType === 'sales') {
          const res = await axios.get<{
            data: OrderRow[];
            stats?: OrderStats;
            meta: { total: number; totalPages: number; page: number };
          }>(url('/api/restaurant/reports/orders'), {
            params: {
              ...baseParams,
              status: typeFilter === 'all' ? undefined : typeFilter,
              channel: salesChannel,
            },
            headers: { 'Cache-Control': 'no-store' },
          });
          setOrderRows(res.data.data ?? []);
          setOrderStats(res.data.stats ?? emptyOrderStats);
          setTotal(res.data.meta?.total ?? 0);
          setTotalPages(res.data.meta?.totalPages ?? 1);
          setPage(res.data.meta?.page ?? p);
        } else if (reportType === 'inventory') {
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
      reportType,
      typeFilter,
      statusFilter,
      sourceFilter,
      paymentFilter,
      salesChannel,
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
    setStatusFilter('all');
    setSourceFilter('all');
    setPaymentFilter('all');
    setSalesChannel('all');
    setOrderStats(emptyOrderStats);
    setSearchDraft('');
    setAppliedSearch('');
    setPage(1);
  }, [reportType]);

  const typeOptions = useMemo(() => {
    if (reportType === 'financial') {
      return [
        { value: 'all', label: t('dashboard.reports.filterAllKinds') },
        { value: 'ORDER', label: t('dashboard.reports.kindOrder') },
        { value: 'INVENTORY', label: t('dashboard.reports.kindInventory') },
      ];
    }
    if (reportType === 'sales') {
      return [
        { value: 'all', label: t('dashboard.reports.filterAllStatuses') },
        { value: 'completed', label: t('dashboard.reports.statusCompleted') },
        { value: 'pending', label: t('dashboard.reports.statusPending') },
        { value: 'canceled', label: t('dashboard.reports.statusCanceled') },
      ];
    }
    if (reportType === 'inventory') {
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
  }, [reportType, t]);

  const reportTypes: Array<{
    id: ReportType;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'sales',
      label: t('dashboard.reports.typeSales'),
      icon: ShoppingCart,
    },
    {
      id: 'inventory',
      label: t('dashboard.reports.typeInventory'),
      icon: Boxes,
    },
    {
      id: 'expenses',
      label: t('dashboard.reports.typeExpenses'),
      icon: Wallet,
    },
    {
      id: 'financial',
      label: t('dashboard.reports.typeFinancial'),
      icon: FileBarChart,
    },
  ];

  const kpis = summary?.kpis;
  const pnl = summary?.pnl;
  const rangeLabel = `${appliedFrom} → ${appliedTo}`;

  const exportPayload = useMemo(() => {
    if (reportType === 'sales') {
      const headers = [
        t('dashboard.common.date'),
        t('dashboard.reports.colTicket'),
        t('dashboard.records.colTracking'),
        t('dashboard.reports.colChannel'),
        t('dashboard.reports.colOrderStatus'),
        t('dashboard.reports.colPaymentStatus'),
        t('dashboard.reports.colTotal'),
        t('dashboard.reports.revenue'),
      ];
      const rows = orderRows.map((row) => [
        format(new Date(row.createdAt), 'yyyy-MM-dd'),
        ticketNumberLabel(row.ticketNumber),
        trackingNumberLabel(row.shortOrderId, row.id),
        formatOrderChannel(row.sourceType, t),
        formatOrderStatusLabel(row.status, t),
        formatPaymentStatusLabel(row.paymentStatus, t),
        row.total ?? 0,
        row.revenueAmount,
      ]);
      const kpiLines = [
        {
          label: t('dashboard.sales.totalOrders'),
          value: `${orderStats.totalOrders} (${formatMoney(orderStats.totalAmount)})`,
        },
        {
          label: t('dashboard.sales.pendingOrders'),
          value: `${orderStats.pending.count} (${formatMoney(orderStats.pending.amount)})`,
        },
        {
          label: t('dashboard.sales.cancelledOrders'),
          value: `${orderStats.canceled.count} (${formatMoney(orderStats.canceled.amount)})`,
        },
        {
          label: t('dashboard.reports.statusCompleted'),
          value: `${orderStats.completed.count} (${formatMoney(orderStats.completed.amount)})`,
        },
      ];
      return {
        title: t('dashboard.reports.typeSales'),
        headers,
        rows,
        kpiLines,
        filename: `sales-report-${appliedFrom}_${appliedTo}.csv`,
      };
    }
    if (reportType === 'inventory') {
      const headers = [
        t('dashboard.common.date'),
        t('dashboard.reports.colIngredient'),
        t('dashboard.reports.colSource'),
        t('dashboard.reports.colQty'),
        t('dashboard.reports.colUsageValue'),
      ];
      const rows = invRows.map((row) => [
        format(new Date(row.createdAt), 'yyyy-MM-dd'),
        resolveBilingualText(row.ingredient.name, uiLang),
        row.source,
        `${row.quantity} ${formatIngredientUnit(row.ingredient.unit)}`,
        row.usageValue,
      ]);
      return {
        title: t('dashboard.reports.typeInventory'),
        headers,
        rows,
        kpiLines: [
          {
            label: t('dashboard.reports.totalInventoryItems'),
            value: String(kpis?.inventory.itemCount ?? 0),
          },
          {
            label: t('dashboard.reports.totalStockValue'),
            value: formatMoney(kpis?.inventory.totalInventoryValue ?? 0),
          },
          {
            label: t('dashboard.reports.usageInRange'),
            value: formatMoney(kpis?.inventory.usageValueInRange ?? 0),
          },
          {
            label: t('dashboard.reports.lowStock'),
            value: String(kpis?.inventory.lowStockCount ?? 0),
          },
        ],
        filename: `inventory-report-${appliedFrom}_${appliedTo}.csv`,
      };
    }
    if (reportType === 'expenses') {
      const headers = [
        t('dashboard.common.date'),
        t('dashboard.common.type'),
        t('dashboard.common.title'),
        t('dashboard.common.amount'),
      ];
      const rows = expRows.map((row) => [
        format(new Date(row.occurredAt), 'yyyy-MM-dd'),
        row.type,
        formatExpenseDisplayTitle({
          title: row.title,
          type: row.type,
          ingredientName: row.ingredient?.name,
          lang: uiLang,
          restockLabel: t('dashboard.expenses.restockLabel'),
        }),
        row.amount,
      ]);
      return {
        title: t('dashboard.reports.typeExpenses'),
        headers,
        rows,
        kpiLines: [
          {
            label: t('dashboard.reports.totalExpenses'),
            value: formatMoney(kpis?.expenses.totalAmount ?? 0),
          },
          {
            label: t('dashboard.reports.numberOfExpenses'),
            value: String(kpis?.expenses.count ?? 0),
          },
        ],
        filename: `expenses-report-${appliedFrom}_${appliedTo}.csv`,
      };
    }
    const headers = [
      t('dashboard.common.date'),
      t('dashboard.reports.colKind'),
      t('dashboard.records.colTracking'),
      t('dashboard.reports.colSource'),
      t('dashboard.common.status'),
      t('dashboard.common.amount'),
    ];
    const rows = txnRows.map((row) => [
      format(new Date(row.createdAt), 'yyyy-MM-dd'),
      row.kind === 'INVENTORY'
        ? t('dashboard.reports.kindInventory')
        : t('dashboard.reports.kindOrder'),
      row.kind === 'ORDER'
        ? trackingNumberLabel(row.shortOrderId, row.referenceId)
        : '—',
      row.kind === 'INVENTORY'
        ? t('dashboard.reports.kindInventory')
        : formatOrderChannel(row.source, t),
      row.status,
      row.amount ?? '',
    ]);
    return {
      title: t('dashboard.reports.typeFinancial'),
      headers,
      rows,
      kpiLines: [
        {
          label: t('dashboard.reports.revenue'),
          value: formatMoney(pnl?.revenue ?? 0),
        },
        {
          label: t('dashboard.reports.expenses'),
          value: formatMoney(pnl?.expenses ?? 0),
        },
        {
          label: t('dashboard.reports.inventory'),
          value: formatMoney(pnl?.inventoryExpenses ?? 0),
        },
        {
          label: t('dashboard.reports.netProfit'),
          value: formatMoney(pnl?.profit ?? 0),
        },
        {
          label: t('dashboard.reports.cashPayments'),
          value: formatMoney(pnl?.paymentBreakdown?.cash ?? 0),
        },
        {
          label: t('dashboard.reports.cardPayments'),
          value: formatMoney(pnl?.paymentBreakdown?.card ?? 0),
        },
        {
          label: t('dashboard.reports.otherPayments'),
          value: formatMoney(pnl?.paymentBreakdown?.other ?? 0),
        },
      ],
      filename: `financial-overview-${appliedFrom}_${appliedTo}.csv`,
    };
  }, [
    reportType,
    orderRows,
    orderStats,
    invRows,
    expRows,
    txnRows,
    kpis,
    pnl,
    appliedFrom,
    appliedTo,
    formatMoney,
    t,
    uiLang,
  ]);

  useEffect(() => {
    // Clear leftover Radix body locks from a previous print session.
    if (typeof document !== 'undefined') {
      document.body.style.removeProperty('pointer-events');
      document.body.removeAttribute('data-scroll-locked');
    }
  }, []);

  function handlePrintClick() {
    // Skip AlertDialog for print: window.print() freezes the page and
    // frequently leaves Radix overlays / body pointer-events stuck.
    const ok = printReportHtml({
      title: exportPayload.title,
      subtitle: `${t('dashboard.reports.dateRangeTitle')}: ${rangeLabel}`,
      kpis: exportPayload.kpiLines,
      tableHtml: rowsToHtmlTable(exportPayload.headers, exportPayload.rows),
    });
    if (!ok) toast.error(t('dashboard.reports.printBlocked'));
  }

  function runCsvExport() {
    setConfirmCsv(false);
    downloadCsv(
      exportPayload.filename,
      buildCsv(exportPayload.headers, exportPayload.rows)
    );
    toast.success(t('dashboard.reports.exportDone'));
  }

  const historicalLocked = summary?.meta.canViewHistorical === false;

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
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            className="bg-sky-600 hover:bg-sky-700"
            onClick={handlePrintClick}
          >
            <Printer className="mr-2 h-4 w-4" />
            {t('dashboard.reports.printReport')}
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setConfirmCsv(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('dashboard.reports.exportCsv')}
          </Button>
        </div>
      }
    >
      <DashboardCard>
        <DashboardCardHeader>
          <DashboardCardTitle>
            {t('dashboard.reports.selectReportType')}
          </DashboardCardTitle>
        </DashboardCardHeader>
        <DashboardCardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {reportTypes.map(({ id, label, icon: Icon }) => {
              const selected = reportType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setReportType(id);
                    router.replace(`/reports?type=${id}`, { scroll: false });
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border-2 bg-card px-4 py-5 text-center transition',
                    selected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-foreground hover:border-primary/40 hover:bg-muted/40'
                  )}
                >
                  <Icon className="h-7 w-7" />
                  <span className="text-sm font-semibold">{label}</span>
                </button>
              );
            })}
          </div>
        </DashboardCardContent>
      </DashboardCard>

      <DashboardCard>
        <DashboardCardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <DashboardCardTitle>
              {t('dashboard.reports.selectDateRange')}
            </DashboardCardTitle>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.reports.dateRangeHint')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <Button
              type="button"
              variant="secondary"
              disabled={historicalLocked}
              onClick={() => {
                const r = weekReportFromToKeys();
                applyDates(r.from, r.to);
              }}
            >
              <Calendar className="mr-2 h-4 w-4 text-primary" />
              {t('dashboard.reports.week')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={historicalLocked}
              onClick={() => {
                const r = monthReportFromToKeys();
                applyDates(r.from, r.to);
              }}
            >
              <Calendar className="mr-2 h-4 w-4 text-primary" />
              {t('dashboard.reports.month')}
            </Button>
            <Input
              type="date"
              className="w-full sm:w-[150px]"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={historicalLocked}
              aria-label={t('dashboard.common.fromDate')}
            />
            <Input
              type="date"
              className="w-full sm:w-[150px]"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={historicalLocked}
              aria-label={t('dashboard.common.toDate')}
            />
            <Button
              type="button"
              disabled={historicalLocked}
              onClick={() => applyDates(fromDate, toDate)}
            >
              {t('dashboard.common.apply')}
            </Button>
          </div>
        </DashboardCardHeader>
      </DashboardCard>

      <DashboardCard>
        <DashboardCardHeader className="flex flex-row items-end justify-between gap-3 space-y-0">
          <div>
            <DashboardCardTitle>
              {reportTypes.find((r) => r.id === reportType)?.label}
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
          <div className="flex w-full items-center gap-2">
            <SearchField
              className="min-w-[180px] flex-1"
              value={searchDraft}
              onChange={setSearchDraft}
              onSearch={applySearch}
              onClear={() => {
                setSearchDraft('');
                setAppliedSearch('');
                setPage(1);
              }}
              appliedValue={appliedSearch}
              placeholder={t('dashboard.reports.searchPlaceholder')}
            />
            {reportType === 'sales' ? (
              <Tabs
                value={salesChannel}
                onValueChange={(v) => {
                  setSalesChannel(v as SalesChannel);
                  setPage(1);
                }}
              >
                <TabsList className="grid h-auto grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:grid-cols-4">
                  <TabsTrigger
                    value="all"
                    className="rounded-lg text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background"
                  >
                    {t('dashboard.reports.channelAll')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="online"
                    className="rounded-lg text-muted-foreground data-[state=active]:bg-[#ed6e40] data-[state=active]:text-white"
                  >
                    {t('dashboard.analytics.channelOnline')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="pos"
                    className="rounded-lg text-muted-foreground data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white"
                  >
                    {t('dashboard.analytics.channelPos')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="kiosk"
                    className="rounded-lg text-muted-foreground data-[state=active]:bg-[#e11d48] data-[state=active]:text-white"
                  >
                    {t('dashboard.analytics.channelKiosk')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
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
            {reportType === 'financial' ? (
              <>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue
                      placeholder={t('dashboard.reports.filterAllStatuses')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('dashboard.reports.filterAllStatuses')}
                    </SelectItem>
                    <SelectItem value="completed">
                      {t('dashboard.reports.statusCompleted')}
                    </SelectItem>
                    <SelectItem value="pending">
                      {t('dashboard.reports.statusPending')}
                    </SelectItem>
                    <SelectItem value="canceled">
                      {t('dashboard.reports.statusCanceled')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sourceFilter}
                  onValueChange={(v) => {
                    setSourceFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue
                      placeholder={t('dashboard.reports.filterAllSources')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('dashboard.reports.filterAllSources')}
                    </SelectItem>
                    <SelectItem value="ONLINE">
                      {t('dashboard.analytics.channelOnline')}
                    </SelectItem>
                    <SelectItem value="POS">
                      {t('dashboard.analytics.channelPos')}
                    </SelectItem>
                    <SelectItem value="KIOSK">
                      {t('dashboard.analytics.channelKiosk')}
                    </SelectItem>
                    <SelectItem value="INVENTORY">
                      {t('dashboard.reports.kindInventory')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={paymentFilter}
                  onValueChange={(v) => {
                    setPaymentFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue
                      placeholder={t('dashboard.records.filterAllPayments')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('dashboard.records.filterAllPayments')}
                    </SelectItem>
                    <SelectItem value="cash">
                      {t('dashboard.records.paymentCash')}
                    </SelectItem>
                    <SelectItem value="card">
                      {t('dashboard.records.paymentCard')}
                    </SelectItem>
                    <SelectItem value="other">
                      {t('dashboard.records.paymentOther')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : null}
          </div>
        </DashboardCardHeader>
        <DashboardCardContent className="space-y-4">
          {summaryLoading && !summary ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-xl bg-muted/50"
                />
              ))}
            </div>
          ) : reportType === 'sales' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                tone="blue"
                label={t('dashboard.sales.totalOrders')}
                value={String(orderStats.totalOrders)}
                hint={formatMoney(orderStats.totalAmount)}
              />
              <KpiCard
                tone="orange"
                label={t('dashboard.sales.pendingOrders')}
                value={String(orderStats.pending.count)}
                hint={formatMoney(orderStats.pending.amount)}
              />
              <KpiCard
                tone="red"
                label={t('dashboard.sales.cancelledOrders')}
                value={String(orderStats.canceled.count)}
                hint={formatMoney(orderStats.canceled.amount)}
              />
              <KpiCard
                tone="green"
                label={t('dashboard.reports.statusCompleted')}
                value={String(orderStats.completed.count)}
                hint={formatMoney(orderStats.completed.amount)}
              />
            </div>
          ) : reportType === 'inventory' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                tone="blue"
                label={t('dashboard.reports.totalInventoryItems')}
                value={String(kpis?.inventory.itemCount ?? 0)}
              />
              <KpiCard
                tone="blue"
                label={t('dashboard.reports.totalStockValue')}
                value={formatMoney(kpis?.inventory.totalInventoryValue ?? 0)}
              />
              <KpiCard
                tone="green"
                label={t('dashboard.reports.usageInRange')}
                value={formatMoney(kpis?.inventory.usageValueInRange ?? 0)}
                hint={t('dashboard.reports.entriesInRange', {
                  count: kpis?.inventory.entryCountInRange ?? 0,
                })}
              />
              <KpiCard
                tone="purple"
                label={t('dashboard.reports.lowStock')}
                value={String(kpis?.inventory.lowStockCount ?? 0)}
              />
            </div>
          ) : reportType === 'expenses' ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-orange-800/80">
                  {t('dashboard.reports.totalExpenses')}
                </p>
                <p className="text-2xl font-bold tabular-nums text-orange-900">
                  {formatMoney(kpis?.expenses.totalAmount ?? 0)}
                </p>
              </div>
              <div className="mt-2 sm:mt-0 sm:text-right">
                <p className="text-xs font-medium uppercase text-orange-800/80">
                  {t('dashboard.reports.numberOfExpenses')}
                </p>
                <p className="text-2xl font-bold tabular-nums text-orange-900">
                  {kpis?.expenses.count ?? 0}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  tone="green"
                  label={t('dashboard.reports.revenue')}
                  value={formatMoney(pnl?.revenue ?? 0)}
                  hint={t('dashboard.reports.revenueHint')}
                />
                <KpiCard
                  tone="orange"
                  label={t('dashboard.reports.expenses')}
                  value={formatMoney(pnl?.expenses ?? 0)}
                />
                <KpiCard
                  tone="blue"
                  label={t('dashboard.reports.inventory')}
                  value={formatMoney(pnl?.inventoryExpenses ?? 0)}
                  hint={t('dashboard.reports.inventoryCostsHint')}
                />
                <KpiCard
                  tone={(pnl?.profit ?? 0) >= 0 ? 'green' : 'red'}
                  label={t('dashboard.reports.netProfit')}
                  value={formatMoney(pnl?.profit ?? 0)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard
                  tone="purple"
                  label={t('dashboard.reports.cashPayments')}
                  value={formatMoney(pnl?.paymentBreakdown?.cash ?? 0)}
                  hint={t('dashboard.reports.paymentMixHint')}
                />
                <KpiCard
                  tone="default"
                  label={t('dashboard.reports.cardPayments')}
                  value={formatMoney(pnl?.paymentBreakdown?.card ?? 0)}
                  hint={t('dashboard.reports.paymentMixHint')}
                />
                <KpiCard
                  tone="default"
                  label={t('dashboard.reports.otherPayments')}
                  value={formatMoney(pnl?.paymentBreakdown?.other ?? 0)}
                  hint={t('dashboard.reports.paymentMixHint')}
                />
              </div>
              <div className={`rounded-xl border p-4 ${(pnl?.profit ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-100'}`}>
                <h3 className="mb-3 text-sm font-semibold text-black">
                  {t('dashboard.reports.incomeStatement')}
                </h3>
                <dl className="space-y-2 text-sm">

                <div className="flex justify-between gap-3 text-gray-600">
                    <dt>{t('dashboard.reports.cashPayments')}</dt>
                    <dd className="tabular-nums font-medium">
                      {formatMoney(pnl?.paymentBreakdown?.cash ?? 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 text-gray-600">
                    <dt>{t('dashboard.reports.cardPayments')}</dt>
                    <dd className="tabular-nums font-medium">
                      {formatMoney(pnl?.paymentBreakdown?.card ?? 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-gray-300 pb-2 text-gray-600">
                    <dt>{t('dashboard.reports.otherPayments')}</dt>
                    <dd className="tabular-nums font-medium">
                      {formatMoney(pnl?.paymentBreakdown?.other ?? 0)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="text-emerald-900">
                      {t('dashboard.reports.revenue')}
                    </dt>
                    <dd className="tabular-nums font-medium text-emerald-900">
                      {formatMoney(pnl?.revenue ?? 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-blue-900">
                      {t('dashboard.reports.inventory')}
                    </dt>
                    <dd className="tabular-nums font-medium text-blue-900">
                      {formatMoney(pnl?.inventoryExpenses ?? 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-orange-900">
                      {t('dashboard.reports.operatingExpenses')}
                    </dt>
                    <dd className="tabular-nums font-medium text-orange-900">
                      {formatMoney(pnl?.operatingExpenses ?? 0)}
                    </dd>
                  </div>
               
                  <div className="flex justify-between gap-3 border-t border-gray-300 pt-2 font-semibold">
                    <dt className="inline-flex items-center gap-1 text-black">
                      {(pnl?.profit ?? 0) >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                      )}
                      {t('dashboard.reports.profitLoss')}
                    </dt>
                    <dd className={`tabular-nums ${(pnl?.profit ?? 0) >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                      {formatMoney(pnl?.profit ?? 0)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {reportType === 'sales' ? (
            <TrackTable
              loading={trackLoading}
              empty={orderRows.length === 0}
              emptyLabel={t('dashboard.reports.emptySales')}
            >
              <DashboardTableHeader>
                <DashboardTableRow>
                  <DashboardTableHead>
                    {t('dashboard.common.date')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.reports.colTicket')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.records.colTracking')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.reports.colChannel')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.reports.colOrderStatus')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.reports.colPaymentStatus')}
                  </DashboardTableHead>
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
                    <DashboardTableCell className="tabular-nums">
                      {ticketNumberLabel(row.ticketNumber)}
                    </DashboardTableCell>
                    <DashboardTableCell className="font-mono text-xs">
                      {trackingNumberLabel(row.shortOrderId, row.id)}
                    </DashboardTableCell>
                    <DashboardTableCell>
                      {formatOrderChannel(row.sourceType, t)}
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <OrderStatusBadge status={row.status} t={t} />
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <PaymentStatusBadge
                        paymentStatus={row.paymentStatus}
                        t={t}
                      />
                    </DashboardTableCell>
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
          ) : null}

          {reportType === 'inventory' ? (
            <TrackTable
              loading={trackLoading}
              empty={invRows.length === 0}
              emptyLabel={t('dashboard.reports.emptyInventory')}
            >
              <DashboardTableHeader>
                <DashboardTableRow>
                  <DashboardTableHead>
                    {t('dashboard.common.date')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.reports.colIngredient')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.reports.colSource')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.reports.colQty')}
                  </DashboardTableHead>
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
          ) : null}

          {reportType === 'expenses' ? (
            <TrackTable
              loading={trackLoading}
              empty={expRows.length === 0}
              emptyLabel={t('dashboard.reports.emptyExpenses')}
            >
              <DashboardTableHeader>
                <DashboardTableRow>
                  <DashboardTableHead>
                    {t('dashboard.common.date')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.common.type')}
                  </DashboardTableHead>
                  <DashboardTableHead>
                    {t('dashboard.common.title')}
                  </DashboardTableHead>
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
                        <p className="font-medium">
                          {formatExpenseDisplayTitle({
                            title: row.title,
                            type: row.type,
                            ingredientName: row.ingredient?.name,
                            lang: uiLang,
                            restockLabel: t('dashboard.expenses.restockLabel'),
                          })}
                        </p>
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
          ) : null}

          {reportType === 'financial' ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                {t('dashboard.reports.allTransactions')}
              </h3>
              <TrackTable
                loading={trackLoading}
                empty={txnRows.length === 0}
                emptyLabel={t('dashboard.reports.emptyFinancial')}
              >
                <DashboardTableHeader>
                  <DashboardTableRow>
                    <DashboardTableHead>
                      {t('dashboard.common.date')}
                    </DashboardTableHead>
                    <DashboardTableHead>
                      {t('dashboard.reports.colKind')}
                    </DashboardTableHead>
                    <DashboardTableHead>
                      {t('dashboard.records.colTracking')}
                    </DashboardTableHead>
                    <DashboardTableHead>
                      {t('dashboard.reports.colSource')}
                    </DashboardTableHead>
                    <DashboardTableHead>
                      {t('dashboard.common.status')}
                    </DashboardTableHead>
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
                      <DashboardTableCell>
                        {row.kind === 'INVENTORY'
                          ? t('dashboard.reports.kindInventory')
                          : t('dashboard.reports.kindOrder')}
                      </DashboardTableCell>
                      <DashboardTableCell className="font-mono text-xs">
                        {row.kind === 'ORDER'
                          ? trackingNumberLabel(
                              row.shortOrderId,
                              row.referenceId
                            )
                          : '—'}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.kind === 'INVENTORY'
                          ? t('dashboard.reports.kindInventory')
                          : formatOrderChannel(row.source, t)}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <OrderStatusBadge status={row.status} t={t} />
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right tabular-nums">
                        {row.amount != null ? formatMoney(row.amount) : '—'}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </TrackTable>
            </div>
          ) : null}

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

      <AlertDialog
        open={confirmCsv}
        onOpenChange={(open) => {
          if (!open) setConfirmCsv(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('dashboard.reports.confirmExportTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.reports.confirmExportBody', {
                type: exportPayload.title,
                range: rangeLabel,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dashboard.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={runCsvExport}>
              {t('dashboard.common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MenuPageShell>
  );
}
