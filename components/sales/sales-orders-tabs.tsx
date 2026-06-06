'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Eye, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { salesOrderStatusBucket } from '@/lib/sales-order-status';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderSourceLabel } from '@/lib/order-source-label';
import eventBus from '@/lib/even';
import type {
  SalesChannelStats,
  SalesOrderRow,
  SalesOrdersApiResponse,
  SalesOrdersPagination,
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
        'font-medium capitalize',
        bucket === 'completed' &&
          'border-green-600/40 bg-green-600 text-white hover:bg-green-600',
        bucket === 'pending' &&
          'border-yellow-500/50 bg-yellow-400 text-yellow-950 hover:bg-yellow-400',
        bucket === 'canceled' &&
          'border-destructive/40 bg-destructive text-destructive-foreground hover:bg-destructive'
      )}
    >
      {status}
    </Badge>
  );
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
  pageOffset = 0,
  showMethodColumn = false,
}: {
  rows: SalesOrderRow[];
  onView: (row: SalesOrderRow) => void;
  pageOffset?: number;
  showMethodColumn?: boolean;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">Sr</TableHead>
            <TableHead className="w-[50px]">Token</TableHead>
            <TableHead className="w-[100px] text-center">Ticket #</TableHead>
            <TableHead className="hidden sm:table-cell">Source</TableHead>
            {showMethodColumn ? (
              <TableHead className="hidden md:table-cell">Method</TableHead>
            ) : null}
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden md:table-cell">Payment</TableHead>
            <TableHead className="hidden lg:table-cell">When</TableHead>
            {/* <TableHead className="hidden md:table-cell text-center">
              Transaction
            </TableHead> */}
            <TableHead className="w-[72px] text-right"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showMethodColumn ? 12 : 11}
                className="text-center text-muted-foreground"
              >
                No orders in this tab.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={`${row.kind}-${row.id}`}>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {pageOffset + index + 1}
                </TableCell>
                <TableCell className="max-w-[140px] truncate font-mono text-xs">
                  {row.trackingToken ?? row.id}
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {row.ticketNumber != null ? `#${row.ticketNumber}` : '—'}
                </TableCell>

                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline" className="font-normal">
                    {orderSourceLabel(row.sourceType)}
                  </Badge>
                </TableCell>
                {showMethodColumn ? (
                  <TableCell className="hidden md:table-cell">
                    {row.kind === 'menu_order' && row.method ? (
                      <Badge variant="secondary" className="font-normal">
                        {row.method}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="text-right tabular-nums">
                  €{formatMoney(row.total)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {'paymentStatus' in row ? row.paymentStatus ?? '—' : '—'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {new Date(row.createdAt).toLocaleString()}
                </TableCell>
                {/* <TableCell className="hidden text-center md:table-cell">
                  {row.transactionId ? (
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      className="h-8"
                    >
                      <Link
                        href={`/records/${encodeURIComponent(row.transactionId)}`}
                      >
                        Transaction
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell> */}
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 gap-1 px-2"
                    onClick={() => onView(row)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
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
  }, [activeTab, page, search, statusFilter, activeBranchId]);

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

  const pageOffset = (pagination.page - 1) * pagination.pageSize;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 w-full">
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total {activeLabel} orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {loading ? '…' : activeStats.totalOrders}
            </p>
          </CardContent>
        </Card>
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {loading ? '…' : `€${formatMoney(activeStats.totalAmount)}`}
            </p>
          </CardContent>
        </Card>
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue (completed)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold tabular-nums text-green-700 dark:text-green-400">
              {loading ? '…' : `€${formatMoney(activeStats.revenueAmount)}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {loading ? '…' : `${activeStats.revenueOrders} completed orders`}
            </p>
          </CardContent>
        </Card>
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending & canceled
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-yellow-700 dark:text-yellow-400">
                Pending
              </span>
              <span className="tabular-nums">
                {loading
                  ? '…'
                  : `${activeStats.pending.count} · €${formatMoney(activeStats.pending.amount)}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-destructive">Canceled</span>
              <span className="tabular-nums">
                {loading
                  ? '…'
                  : `${activeStats.canceled.count} · €${formatMoney(activeStats.canceled.amount)}`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2"></CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search tracking or ticket #"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as SalesOrdersStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
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
              variant="outline"
              className="gap-1"
              disabled={loading}
              onClick={() => load()}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              />
              Refresh
            </Button>
          </div>

          <Tabs
            defaultValue="online"
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as SalesOrdersTab);
              setPage(1);
            }}
            className="w-full"
          >
            <TabsList className="grid h-auto w-full max-w-full grid-cols-1 gap-1 sm:grid-cols-3">
              <TabsTrigger value="online">Online orders</TabsTrigger>
              <TabsTrigger value="pos">POS orders</TabsTrigger>
              <TabsTrigger value="kiosk">Kiosk orders</TabsTrigger>
            </TabsList>
            <TabsContent value="online" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Checkout orders with source <strong>Online</strong>.
              </p>
              {loading && orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="mx-auto animate-spin text-primary" />
                </p>
              ) : (
                <>
                  <OrdersTable
                    rows={orders}
                    onView={openDetail}
                    pageOffset={pageOffset}
                    showMethodColumn
                  />
                  <SalesOrdersPaginationBar
                    pagination={pagination}
                    page={page}
                    onPageChange={setPage}
                    loading={loading}
                  />
                </>
              )}
            </TabsContent>
            <TabsContent value="pos" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                POS menu orders, other in-store menu orders, and register /
                walk-in transactions.
              </p>
              {loading && orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="mx-auto animate-spin text-primary" />
                </p>
              ) : (
                <>
                  <OrdersTable
                    rows={orders}
                    onView={openDetail}
                    pageOffset={pageOffset}
                  />
                  <SalesOrdersPaginationBar
                    pagination={pagination}
                    page={page}
                    onPageChange={setPage}
                    loading={loading}
                  />
                </>
              )}
            </TabsContent>
            <TabsContent value="kiosk" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Orders placed from the in-venue <strong>kiosk</strong>.
              </p>
              {loading && orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="mx-auto animate-spin text-primary" />
                </p>
              ) : (
                <>
                  <OrdersTable
                    rows={orders}
                    onView={openDetail}
                    pageOffset={pageOffset}
                    showMethodColumn
                  />
                  <SalesOrdersPaginationBar
                    pagination={pagination}
                    page={page}
                    onPageChange={setPage}
                    loading={loading}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
