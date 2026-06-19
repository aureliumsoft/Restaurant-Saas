'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  RefreshCw,
  Loader2,
  Search,
  ShoppingBag,
  CircleDollarSign,
  Clock3,
  Ban,
  Calendar,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  kpiSparklineFromValue,
  OrdersKpiCard,
} from '@/components/sales/orders-kpi-card';
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
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useBranchContext } from '@/hooks/use-branch-context';
import { salesOrderMethodLabel } from '@/lib/order-fulfillment';
import { OrderCustomerExtras } from '@/components/order/order-customer-extras';
import { salesOrderStatusBucket } from '@/lib/sales-order-status';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DashboardTable as Table,
  DashboardTableBody as TableBody,
  DashboardTableCell as TableCell,
  DashboardTableHead as TableHead,
  DashboardTableHeader as TableHeader,
  DashboardTableRow as TableRow,
  DashboardTableWrapper as TableWrapper,
} from '@/components/dashboard/dashboard-table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderSourceLabel } from '@/lib/order-source-label';
import eventBus from '@/lib/even';
import type {
  SalesChannelStats,
  SalesOrderRow,
  SalesOrdersApiResponse,
  SalesOrdersPagination,
  SalesOrdersPeriodFilter,
  SalesOrdersStats,
  SalesOrdersStatusFilter,
  SalesOrdersTab,
} from '@/types/sales-order';
import type { TransactionData } from '@/types/transaction';
import { cn } from '@/lib/utils';

function formatMoney(n: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type MenuOrderDetail = {
  id: string;
  shortOrderId?: string;
  total: number;
  status: string;
  sourceType: string;
  address: string | null;
  tableLabel?: string | null;
  cutleryRequested?: boolean;
  customerComment?: string | null;
  taxAmount: number;
  discountAmount: number;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    menuItem: { id: string; name: string };
    modifiers?: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    createdAt: string;
  }>;
};

const emptyChannel: SalesChannelStats = {
  totalOrders: 0,
  totalAmount: 0,
  revenueAmount: 0,
  revenueOrders: 0,
  pending: { count: 0, amount: 0 },
  canceled: { count: 0, amount: 0 },
};

const emptyStats: SalesOrdersStats = {
  online: { ...emptyChannel },
  pos: { ...emptyChannel },
  kiosk: { ...emptyChannel },
};

function StatusBadge({ status }: { status: string }) {
  const bucket = salesOrderStatusBucket(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border-0 px-3 py-0.5 text-xs font-semibold capitalize',
        bucket === 'completed' &&
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        bucket === 'pending' &&
          'bg-amber-500/15 text-amber-800 dark:text-amber-400',
        bucket === 'canceled' &&
          'bg-rose-500/15 text-rose-700 dark:text-rose-400'
      )}
    >
      {status}
    </Badge>
  );
}

const TAB_ACCENT: Record<SalesOrdersTab, string> = {
  online: '#ed6e40',
  pos: '#7c3aed',
  kiosk: '#e11d48',
};

function orderNumberLabel(row: SalesOrderRow): string {
  if (row.ticketNumber != null) return `#${row.ticketNumber}`;
  return '—';
}

function trackingNumberLabel(row: SalesOrderRow): string {
  const token = (row.trackingToken ?? row.id).replace(/[^a-zA-Z0-9]/g, '');
  if (!token) return '—';
  return token.length <= 8 ? token.toUpperCase() : token.slice(0, 6).toUpperCase();
}

function SalesOrdersPaginationBar({
  pagination,
  page,
  onPageChange,
  loading,
}: {
  pagination: SalesOrdersPagination;
  page: number;
  onPageChange: (p: number) => void;
  loading: boolean;
}) {
  const { totalPages, total, pageSize } = pagination;
  if (totalPages <= 1 && total <= pageSize) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row w-full">
      <Pagination>
        <PaginationContent className="w-full flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {from}–{to} of {total}
          </p>
          <div className="flex items-center justify-end">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1 && !loading) onPageChange(page - 1);
                }}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  (p >= page - 1 && p <= page + 1)
              )
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev != null && p - prev > 1;
                return (
                  <span key={p} className="flex items-center">
                    {showEllipsis ? (
                      <PaginationItem>
                        <span className="px-2 text-muted-foreground">…</span>
                      </PaginationItem>
                    ) : null}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!loading) onPageChange(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  </span>
                );
              })}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages && !loading) onPageChange(page + 1);
                }}
                className={
                  page >= totalPages ? 'pointer-events-none opacity-50' : ''
                }
              />
            </PaginationItem>
          </div>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function OrdersTable({
  rows,
  onView,
}: {
  rows: SalesOrderRow[];
  onView: (row: SalesOrderRow) => void;
}) {
  return (
    <TableWrapper>
      <Table minWidth={960}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground">Order #</TableHead>
            <TableHead className="text-muted-foreground">Tracking #</TableHead>
            <TableHead className="hidden text-muted-foreground sm:table-cell">
              Order Type
            </TableHead>
            <TableHead className="hidden text-muted-foreground md:table-cell">
              Payment Status
            </TableHead>
            <TableHead className="text-right text-muted-foreground">
              Amount
            </TableHead>
            <TableHead className="text-muted-foreground">Order Status</TableHead>
            <TableHead className="hidden text-muted-foreground lg:table-cell">
              Date & Time
            </TableHead>
            <TableHead className="text-right text-muted-foreground">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={9}
                className="py-10 text-center text-muted-foreground"
              >
                No orders in this tab.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={`${row.kind}-${row.id}`}
                className="hover:bg-muted/40"
              >
                <TableCell className="font-medium text-foreground tabular-nums">
                  {orderNumberLabel(row)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {trackingNumberLabel(row)}
                </TableCell>
                <TableCell className="hidden text-foreground/80 sm:table-cell">
                  {orderSourceLabel(row.sourceType)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {'paymentStatus' in row && row.paymentStatus
                    ? row.paymentStatus
                    : row.kind === 'menu_order' && row.method
                      ? row.method
                      : '—'}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  €{formatMoney(row.total)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {new Date(row.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => onView(row)}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}

export function SalesOrdersTabs() {
  const { activeBranchId, loading: branchLoading } = useBranchContext();
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [stats, setStats] = useState<SalesOrdersStats>(emptyStats);
  const [pagination, setPagination] = useState<SalesOrdersPagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SalesOrdersTab>('online');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<SalesOrdersStatusFilter>('all');
  const [periodFilter, setPeriodFilter] =
    useState<SalesOrdersPeriodFilter>('overall');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<SalesOrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [menuDetail, setMenuDetail] = useState<MenuOrderDetail | null>(null);
  const [transactionLines, setTransactionLines] = useState<TransactionData[]>(
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        page: String(page),
        status: statusFilter,
        period: periodFilter,
      });
      if (search.trim()) params.set('search', search.trim());
      if (activeBranchId) params.set('branchId', activeBranchId);
      const res = await axios.get<SalesOrdersApiResponse>(
        `/api/restaurant/sales-orders?${params.toString()}`
      );
      setOrders(res.data.orders ?? []);
      setStats(res.data.stats ?? emptyStats);
      setPagination(
        res.data.pagination ?? {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        }
      );
    } catch {
      setError('Could not load orders.');
      setOrders([]);
      setStats(emptyStats);
      setPagination({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search, statusFilter, periodFilter, activeBranchId]);

  useEffect(() => {
    if (branchLoading) return;
    void load();
  }, [load, branchLoading]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const handler = () => load();
    eventBus.on('refreshSalesOrders', handler);
    return () => {
      eventBus.removeListener('refreshSalesOrders', handler);
    };
  }, [load]);

  async function openDetail(row: SalesOrderRow) {
    setActiveRow(row);
    setSheetOpen(true);
    setDetailLoading(true);
    setMenuDetail(null);
    setTransactionLines([]);

    try {
      if (row.kind === 'menu_order') {
        const res = await axios.get<MenuOrderDetail>(
          `/api/restaurant/orders/${row.id}`
        );
        setMenuDetail(res.data);
      } else {
        const res = await axios.get<TransactionData[]>(
          `/api/transactions/${row.id}`
        );
        const data = res.data;
        setTransactionLines(Array.isArray(data) ? data : []);
      }
    } catch {
      setMenuDetail(null);
      setTransactionLines([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeSheet(open: boolean) {
    setSheetOpen(open);
    if (!open) {
      setActiveRow(null);
      setMenuDetail(null);
      setTransactionLines([]);
    }
  }

  const activeStats =
    activeTab === 'online'
      ? stats.online
      : activeTab === 'pos'
        ? stats.pos
        : stats.kiosk;
  const activeLabel =
    activeTab === 'online' ? 'Online' : activeTab === 'pos' ? 'POS' : 'Kiosk';
  const activeAccent = TAB_ACCENT[activeTab];

  return (
    <div className="space-y-6">
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OrdersKpiCard
          tabName={activeLabel}
          label="Total Orders"
          value={activeStats.totalOrders}
          sparklineData={kpiSparklineFromValue(activeStats.totalOrders)}
          accentColor={activeAccent}
          icon={ShoppingBag}
          loading={loading}
        />
        <OrdersKpiCard
          tabName={activeLabel}
          label="Total Revenue"
          value={`€${formatMoney(activeStats.revenueAmount)}`}
          sparklineData={kpiSparklineFromValue(activeStats.revenueAmount)}
          accentColor="#22c55e"
          icon={CircleDollarSign}
          loading={loading}
        />
        <OrdersKpiCard
          tabName={activeLabel}
          label="Pending Orders"
          value={activeStats.pending.count}
          sparklineData={kpiSparklineFromValue(activeStats.pending.count)}
          accentColor="#f59e0b"
          icon={Clock3}
          loading={loading}
        />
        <OrdersKpiCard
          tabName={activeLabel}
          label="Cancelled Orders"
          value={activeStats.canceled.count}
          sparklineData={kpiSparklineFromValue(activeStats.canceled.count)}
          accentColor="#ef4444"
          icon={Ban}
          loading={loading}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl bg-background pl-9"
              placeholder="Search Orders..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as SalesOrdersTab);
              setPage(1);
            }}
          >
            <TabsList className="grid h-auto grid-cols-3 rounded-xl border border-border bg-muted/40 p-1">
              <TabsTrigger
                value="online"
                className="rounded-lg text-muted-foreground data-[state=active]:bg-[#ed6e40] data-[state=active]:text-white"
              >
                Online
              </TabsTrigger>
              <TabsTrigger
                value="pos"
                className="rounded-lg text-muted-foreground data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white"
              >
                POS
              </TabsTrigger>
              <TabsTrigger
                value="kiosk"
                className="rounded-lg text-muted-foreground data-[state=active]:bg-[#e11d48] data-[state=active]:text-white"
              >
                Kiosk
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as SalesOrdersStatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full rounded-xl bg-background sm:w-[160px]">
              <SelectValue placeholder="All Filters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={periodFilter === 'today' ? 'default' : 'outline'}
            className="gap-2 rounded-xl"
            disabled={loading}
            onClick={() => {
              setPeriodFilter((current) =>
                current === 'today' ? 'overall' : 'today'
              );
              setPage(1);
            }}
          >
            <Calendar className="h-4 w-4" />
            {periodFilter === 'today' ? 'All Time' : 'Today'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={loading}
            onClick={() => load()}
          >
            <RefreshCw
              className={cn('h-4 w-4', loading && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: activeAccent }}
              aria-hidden
            />
            <h2 className="text-lg font-semibold text-foreground">
              {activeLabel}
            </h2>
            <Badge
              variant="secondary"
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
            >
              {loading ? '…' : activeStats.totalOrders} total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {periodFilter === 'today' ? 'Today' : 'Overall'} · Orders table
          </p>
        </div>

        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <OrdersTable rows={orders} onView={openDetail} />
            <SalesOrdersPaginationBar
              pagination={pagination}
              page={page}
              onPageChange={setPage}
              loading={loading}
            />
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Order details</SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {detailLoading && (
              <p className="text-sm text-muted-foreground">
                <Loader2 className="animate-spin text-primary text-center mx-auto" />
              </p>
            )}

            {!detailLoading &&
              activeRow?.kind === 'menu_order' &&
              !menuDetail && (
                <p className="text-sm text-destructive">
                  Could not load order details.
                </p>
              )}

            {!detailLoading &&
              activeRow?.kind === 'menu_order' &&
              menuDetail && (
                <div className="space-y-4 text-sm">
                  {(() => {
                    const methodLabel =
                      activeRow.method ??
                      salesOrderMethodLabel({
                        address: menuDetail.address,
                        sourceType: menuDetail.sourceType,
                        tableLabel: menuDetail.tableLabel,
                      });
                    if (!methodLabel) return null;
                    return (
                      <div className=" bg-primary/5 px-2 py-2 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Method
                        </p>
                        <p className="mt-2 text-xl font-bold tracking-tight text-foreground">
                          {methodLabel}
                        </p>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground">Tracking ID</p>
                      <p className="font-mono text-xs">
                        {menuDetail.shortOrderId ?? menuDetail.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold tabular-nums">
                        €{formatMoney(menuDetail.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <StatusBadge status={menuDetail.status} />
                    </div>
                    <div>
                      <p className="text-muted-foreground">Source</p>
                      <p>{orderSourceLabel(menuDetail.sourceType)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Placed</p>
                      <p>{new Date(menuDetail.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment status</p>
                      <p className="font-medium">
                        {menuDetail.payments[0]?.status ?? '—'}
                      </p>
                    </div>
                    {/* <div>
                      <p className="text-muted-foreground">Transaction ID</p>
                      <p className="font-mono text-xs">
                        {activeRow.transactionId ??
                          menuDetail.payments[0]?.id ??
                          menuDetail.id}
                      </p>
                    </div> */}
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Financial summary
                    </p>
                    <p>Tax: €{formatMoney(menuDetail.taxAmount)}</p>
                    <p>Discount: €{formatMoney(menuDetail.discountAmount)}</p>
                  </div>

                  {menuDetail.customer && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Customer
                      </p>
                      <p className="font-medium">{menuDetail.customer.name}</p>
                      <p className="text-muted-foreground">
                        {menuDetail.customer.phone}
                      </p>
                      {menuDetail.customer.email && (
                        <p className="text-muted-foreground">
                          {menuDetail.customer.email}
                        </p>
                      )}
                    </div>
                  )}

                  {menuDetail.address ? (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Address snapshot
                      </p>
                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {menuDetail.address}
                      </pre>
                    </div>
                  ) : null}

                  <OrderCustomerExtras
                    cutleryRequested={menuDetail.cutleryRequested}
                    customerComment={menuDetail.customerComment}
                  />

                  <div>
                    <p className="mb-2 font-medium">Line items</p>
                    {menuDetail.items.length === 0 ? (
                      <p className="text-muted-foreground">
                        No line items stored.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">Sr</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {menuDetail.items.map((it, i) => (
                            <TableRow key={it.id}>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {i + 1}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <p>{it.menuItem.name}</p>
                                  {(it.modifiers ?? []).map((m) => (
                                    <p
                                      key={m.id}
                                      className="pl-3 text-xs text-muted-foreground"
                                    >
                                      <span className="font-semibold tabular-nums">
                                        {m.quantity}×
                                      </span>{' '}
                                      {m.name}
                                    </p>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {it.quantity}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                €{formatMoney(it.price)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {menuDetail.payments.length > 0 && (
                    <div>
                      <p className="mb-2 font-medium">Payments</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {menuDetail.payments.map((p) => (
                          <li key={p.id}>
                            €{formatMoney(p.amount)} · {p.method} · {p.status}{' '}
                            <span className="text-xs">
                              ({new Date(p.createdAt).toLocaleString()})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            {!detailLoading &&
              activeRow?.kind === 'sale_transaction' &&
              (transactionLines.length === 0 ? (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    No product lines for this register transaction (header-only
                    or legacy).
                  </p>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold tabular-nums">
                        €{formatMoney(activeRow.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p>{activeRow.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Source</p>
                      <p>{orderSourceLabel(activeRow.sourceType)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">When</p>
                      <p>{new Date(activeRow.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Transaction ID
                      </p>
                      <p className="font-mono text-xs">
                        {activeRow.transactionId ?? activeRow.id}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium">Line items</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Sr</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionLines.map((line, i) => {
                        const amt = line.product.sellprice * line.quantity;
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              {line.product.productstock.name}
                            </TableCell>
                            <TableCell className="text-right">
                              {line.quantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              €{formatMoney(amt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
