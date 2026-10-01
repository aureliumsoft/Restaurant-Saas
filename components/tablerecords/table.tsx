'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DashboardCard,
  DashboardCardContent,
  DashboardCardHeader,
  DashboardCardTitle,
} from '@/components/dashboard/dashboard-card';
import { OrdersKpiCard, kpiSparklineFromValue } from '@/components/sales/orders-kpi-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchField } from '@/components/ui/search-field';
import {
  DashboardTable as Table,
  DashboardTableBody as TableBody,
  DashboardTableCell as TableCell,
  DashboardTableHead as TableHead,
  DashboardTableHeader as TableHeader,
  DashboardTableRow as TableRow,
  DashboardTableWrapper as TableWrapper,
} from '@/components/dashboard/dashboard-table';
import { TablePagination } from '@/components/ui/table-pagination';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { formatCurrency } from '@/lib/format-money';
import { normalizeRestaurantCurrencyCode } from '@/lib/restaurant-regional';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  TransactionHistoryKind,
  TransactionHistoryResponse,
  TransactionHistoryRow,
} from '@/types/transaction-history';
import {
  Boxes,
  Eye,
  Loader2,
  RefreshCcw,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { salesOrderStatusBucket } from '@/lib/sales-order-status';

const PAGE_SIZE = 20;

function kindBadge(kind: TransactionHistoryKind, t: (key: string) => string) {
  if (kind === 'INVENTORY') return t('dashboard.records.kindInventory');
  return t('dashboard.records.kindOrder');
}

function formatStatusLabel(status: string, t: (key: string) => string): string {
  const bucket = salesOrderStatusBucket(status);
  if (bucket === 'completed') return t('dashboard.reports.statusCompleted');
  if (bucket === 'canceled') return t('dashboard.reports.statusCanceled');
  if (bucket === 'pending') return t('dashboard.reports.statusPending');
  return status || '—';
}

function StatusBadge({
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
        bucket === 'completed' &&
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        bucket === 'pending' &&
          'bg-orange-500/15 text-orange-700 dark:text-orange-400',
        bucket === 'canceled' &&
          'bg-rose-500/15 text-rose-700 dark:text-rose-400'
      )}
    >
      {formatStatusLabel(status, t)}
    </Badge>
  );
}

function trackingNumberLabel(row: TransactionHistoryRow): string {
  if (row.kind !== 'ORDER') return '—';
  const token = (row.shortOrderId ?? row.referenceId ?? '').replace(
    /[^a-zA-Z0-9]/g,
    ''
  );
  if (!token) return '—';
  return token.length <= 8 ? token.toUpperCase() : token.slice(0, 6).toUpperCase();
}

function sourceLabel(row: TransactionHistoryRow, t: (key: string) => string) {
  const raw = String(row.source ?? '').trim();
  if (!raw) return '—';
  const upper = raw.toUpperCase();
  if (upper === 'ONLINE' || upper === 'WEB') {
    return t('dashboard.analytics.channelOnline');
  }
  if (upper === 'POS') return t('dashboard.analytics.channelPos');
  if (upper === 'KIOSK') return t('dashboard.analytics.channelKiosk');
  if (upper === 'INVENTORY') return t('dashboard.records.kindInventory');
  if (upper === 'WALK_IN' || upper === 'WALK-IN') return 'Walk-in';
  return raw;
}

function formatPaymentMethod(method: string | null | undefined) {
  if (!method) return '—';
  return method;
}

export function Records() {
  const { t } = useTranslation();
  const { formatMoney, regional } = useOwnerRestaurantRegional();
  const formatRowMoney = (value: number | null, currency?: string | null) => {
    if (value == null || Number.isNaN(value)) return '—';
    return formatCurrency(value, {
      currencyCode: normalizeRestaurantCurrencyCode(
        currency ?? regional.currencyCode
      ),
      countryCode: regional.countryCode,
    });
  };
  const { activeBranchId, loading: branchLoading, isOwnerOrAdmin } =
    useBranchContext();
  const [rows, setRows] = useState<TransactionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [kind, setKind] = useState<'ALL' | TransactionHistoryKind>('ALL');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [payment, setPayment] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dataScope, setDataScope] = useState<'all' | 'today'>('all');

  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<TransactionHistoryRow | null>(null);

  const applySearch = () => {
    setAppliedSearch(q.trim());
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<TransactionHistoryResponse>(
        '/api/restaurant/transaction-history',
        {
          params: {
            q: appliedSearch || undefined,
            kind: kind === 'ALL' ? undefined : kind,
            status: status === 'all' ? undefined : status,
            source: source === 'all' ? undefined : source,
            payment: payment === 'all' ? undefined : payment,
            page,
            take: PAGE_SIZE,
            ...(activeBranchId ? { branchId: activeBranchId } : {}),
          },
        }
      );
      setRows(res.data.data ?? []);
      setTotalPages(res.data.meta?.totalPages ?? 1);
      setTotal(res.data.meta?.total ?? 0);
      setDataScope(res.data.meta?.dataScope ?? 'all');
    } catch {
      setRows([]);
      setError(t('dashboard.records.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [
    appliedSearch,
    kind,
    status,
    source,
    payment,
    page,
    activeBranchId,
    t,
  ]);

  useEffect(() => {
    if (branchLoading) return;
    void load();
  }, [load, branchLoading]);

  useEffect(() => {
    setPage(1);
  }, [kind, status, source, payment]);

  const stats = useMemo(() => {
    const orderCount = rows.filter((r) => r.kind === 'ORDER').length;
    const inventoryCount = rows.filter((r) => r.kind === 'INVENTORY').length;
    return { orderCount, inventoryCount };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-start gap-2">
          <h1 className="text-2xl font-bold">
            {t('dashboard.records.transactionRecords')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dataScope === 'today' || !isOwnerOrAdmin
              ? t('dashboard.records.descriptionToday')
              : t('dashboard.records.descriptionOrdersInventory')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void load()}
        >
          {loading ? (
            <RefreshCcw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <DashboardCard>
        <DashboardCardHeader>
          <DashboardCardTitle>
            {t('dashboard.records.transactions')}
          </DashboardCardTitle>
        </DashboardCardHeader>
        <DashboardCardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <SearchField
              className="min-w-[200px] flex-1"
              value={q}
              onChange={setQ}
              onSearch={applySearch}
              onClear={() => {
                setQ('');
                setAppliedSearch('');
                setPage(1);
              }}
              appliedValue={appliedSearch}
              placeholder={t('dashboard.records.searchPlaceholder')}
            />
            <Select
              value={kind}
              onValueChange={(v: 'ALL' | TransactionHistoryKind) => setKind(v)}
            >
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue placeholder={t('dashboard.records.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('dashboard.records.allTypes')}
                </SelectItem>
                <SelectItem value="ORDER">
                  {t('dashboard.records.typeOrders')}
                </SelectItem>
                <SelectItem value="INVENTORY">
                  {t('dashboard.records.typeInventory')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full lg:w-[150px]">
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
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-full lg:w-[150px]">
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
                  {t('dashboard.records.kindInventory')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger className="w-full lg:w-[150px]">
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
          </div>

          <div className="text-sm text-muted-foreground">
            {t('dashboard.records.recordsCount', { count: total })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <OrdersKpiCard
              label={t('dashboard.records.kpiOrders')}
              subtitle={t('dashboard.records.inCurrentPage')}
              value={stats.orderCount.toLocaleString()}
              sparklineData={kpiSparklineFromValue(stats.orderCount)}
              accentColor="#ed6e40"
              icon={ShoppingBag}
            />
            <OrdersKpiCard
              label={t('dashboard.records.kpiInventory')}
              subtitle={t('dashboard.records.inCurrentPage')}
              value={stats.inventoryCount.toLocaleString()}
              sparklineData={kpiSparklineFromValue(stats.inventoryCount)}
              accentColor="#0ea5e9"
              icon={Boxes}
            />
          </div>

          {loading ? (
            <Loader2 className="mx-auto animate-spin text-primary" />
          ) : (
            <>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dashboard.records.colType')}</TableHead>
                      <TableHead>{t('dashboard.records.colTracking')}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t('dashboard.records.colSource')}
                      </TableHead>
                      <TableHead>{t('dashboard.records.colStatus')}</TableHead>
                      <TableHead className="hidden md:table-cell">
                        {t('dashboard.records.colPayment')}
                      </TableHead>
                      <TableHead className="text-right">
                        {t('dashboard.records.colAmount')}
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t('dashboard.records.colWhen')}
                      </TableHead>
                      <TableHead className="text-right">
                        {t('dashboard.records.colAction')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {error ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-destructive"
                        >
                          {error}
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground"
                        >
                          {t('dashboard.records.noRecords')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>
                            <Badge variant="secondary">
                              {kindBadge(row.kind, t)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {trackingNumberLabel(row)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {sourceLabel(row, t)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={row.status} t={t} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {formatPaymentMethod(row.method)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRowMoney(row.amount, row.currency)}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {new Date(row.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setActive(row);
                                setDetailOpen(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t('dashboard.records.view')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>

              <TablePagination
                pagination={{
                  page,
                  pageSize: PAGE_SIZE,
                  total,
                  totalPages,
                }}
                page={page}
                onPageChange={setPage}
                loading={loading}
                hideWhenSinglePage={false}
              />
            </>
          )}
        </DashboardCardContent>
      </DashboardCard>

      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setActive(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('dashboard.records.transactionDetails')}</SheetTitle>
          </SheetHeader>
          {active ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailType')}
                  </p>
                  <p>{kindBadge(active.kind, t)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailStatus')}
                  </p>
                  <StatusBadge status={active.status} t={t} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailAmount')}
                  </p>
                  <p className="tabular-nums">
                    {formatRowMoney(active.amount, active.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailMethod')}
                  </p>
                  <p>{active.method ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailTracking')}
                  </p>
                  <p className="font-mono text-xs">
                    {trackingNumberLabel(active)}
                  </p>
                </div>
                {active.kind === 'ORDER' && active.ticketNumber != null ? (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.records.detailOrderNumber')}
                    </p>
                    <p>#{active.ticketNumber}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailSource')}
                  </p>
                  <p>{sourceLabel(active, t)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailDate')}
                  </p>
                  <p>{new Date(active.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {active.customerName ? (
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    {active.kind === 'INVENTORY'
                      ? t('dashboard.reports.colIngredient')
                      : t('dashboard.records.detailCustomer')}
                  </p>
                  <p>{active.customerName}</p>
                </div>
              ) : null}
              {active.note ? (
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.records.detailNotes')}
                  </p>
                  <p className="whitespace-pre-wrap text-xs">{active.note}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
