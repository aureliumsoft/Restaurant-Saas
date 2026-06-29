'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DashboardCard,
  DashboardCardContent,
  DashboardCardHeader,
  DashboardCardTitle,
  DashboardStatCard,
} from '@/components/dashboard/dashboard-card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DashboardTable as Table,
  DashboardTableBody as TableBody,
  DashboardTableCell as TableCell,
  DashboardTableHead as TableHead,
  DashboardTableHeader as TableHeader,
  DashboardTableRow as TableRow,
  DashboardTableWrapper as TableWrapper,
} from '@/components/dashboard/dashboard-table';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { formatCurrency } from '@/lib/format-money';
import { normalizeRestaurantCurrencyCode } from '@/lib/restaurant-regional';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type {
  TransactionHistoryKind,
  TransactionHistoryResponse,
  TransactionHistoryRow,
} from '@/types/transaction-history';
import { Eye, Loader2, RefreshCcw } from 'lucide-react';

const PAGE_SIZE = 20;

function kindBadge(kind: TransactionHistoryKind) {
  if (kind === 'ORDER') return 'Order';
  if (kind === 'SUBSCRIPTION') return 'Subscription';
  return 'Register';
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

function formatPaymentMethod(method: string | null | undefined) {
  if (!method) return '—';
  return method;
}

export function Records() {
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
  const [kind, setKind] = useState<'ALL' | TransactionHistoryKind>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dataScope, setDataScope] = useState<'all' | 'today'>('all');

  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<TransactionHistoryRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<TransactionHistoryResponse>(
        '/api/restaurant/transaction-history',
        {
          params: {
            q: q || undefined,
            kind: kind === 'ALL' ? undefined : kind,
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
      setError('Could not load transaction history.');
    } finally {
      setLoading(false);
    }
  }, [q, kind, page, activeBranchId]);

  useEffect(() => {
    if (branchLoading) return;
    void load();
  }, [load, branchLoading]);

  useEffect(() => {
    setPage(1);
  }, [q, kind]);

  const stats = useMemo(() => {
    const orderCount = rows.filter((r) => r.kind === 'ORDER').length;
    const subCount = rows.filter((r) => r.kind === 'SUBSCRIPTION').length;
    const regCount = rows.filter((r) => r.kind === 'REGISTER').length;
    return { orderCount, subCount, regCount };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {' '}
        <div className="flex flex-col justify-center items-start gap-2">
          <h1 className="text-2xl font-bold">Records</h1>{' '}
          <p className="text-sm text-muted-foreground">
            {dataScope === 'today' || !isOwnerOrAdmin
              ? 'Transaction records for today only.'
              : 'Unified transaction records for orders, subscriptions, and register sales.'}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>
          {loading ? (
            <>
              <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />{' '}
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <RefreshCcw className="mr-2 h-4 w-4" /> <span>Refresh</span>
            </>
          )}
        </Button>
      </div>
      <DashboardCard>
        <DashboardCardHeader>
          <DashboardCardTitle>Transactions</DashboardCardTitle>
        </DashboardCardHeader>
        <DashboardCardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by tracking number, order id, or status..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select
              value={kind}
              onValueChange={(v: 'ALL' | TransactionHistoryKind) => setKind(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="ORDER">Orders</SelectItem>
                <SelectItem value="SUBSCRIPTION">Subscriptions</SelectItem>
                <SelectItem value="REGISTER">Register</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground md:text-right">
              {total} records
            </div>
          </div>

          {loading ? (
            <>
              <Loader2 className="  animate-spin text-primary text-center mx-auto" />{' '}
            </>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <DashboardStatCard>
                  <DashboardCardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Orders in current page
                    </p>
                    <p className="text-2xl font-semibold">{stats.orderCount}</p>
                  </DashboardCardContent>
                </DashboardStatCard>
                <DashboardStatCard>
                  <DashboardCardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Subscriptions in current page
                    </p>
                    <p className="text-2xl font-semibold">{stats.subCount}</p>
                  </DashboardCardContent>
                </DashboardStatCard>
                <DashboardStatCard>
                  <DashboardCardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Register in current page
                    </p>
                    <p className="text-2xl font-semibold">{stats.regCount}</p>
                  </DashboardCardContent>
                </DashboardStatCard>
              </div>

              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Tracking #</TableHead>
                      {/* <TableHead>Transaction ID</TableHead> */}
                      {/* <TableHead className="hidden md:table-cell">
                        Order / Subscription
                      </TableHead> */}
                      <TableHead className="hidden lg:table-cell">
                        Source
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        When
                      </TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center text-muted-foreground"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : error ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center text-destructive"
                        >
                          {error}
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center text-muted-foreground"
                        >
                          No records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>
                            <Badge variant="secondary">
                              {kindBadge(row.kind)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {trackingNumberLabel(row)}
                          </TableCell>
                          {/* <TableCell className="font-mono text-xs">
                        {row.transactionId}
                      </TableCell> */}
                          {/* <TableCell className="hidden font-mono text-xs md:table-cell">
                            {row.referenceId ?? '—'}
                          </TableCell> */}
                          <TableCell className="hidden lg:table-cell">
                            {row.source}
                          </TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {formatPaymentMethod(row.method)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRowMoney(row.amount, row.currency)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
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
                              <Eye className="h-4 w-4 mr-2" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
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
            <SheetTitle>Transaction details</SheetTitle>
            {/* <SheetDescription className="font-mono text-xs">
              {active?.transactionId}
            </SheetDescription> */}
          </SheetHeader>
          {active ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p>{kindBadge(active.kind)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p>{active.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="tabular-nums">
                    {formatRowMoney(active.amount, active.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p>{active.method ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tracking #</p>
                  <p className="font-mono text-xs">{trackingNumberLabel(active)}</p>
                </div>
                {active.kind === 'ORDER' && active.ticketNumber != null ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Order #</p>
                    <p>#{active.ticketNumber}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p>{active.source}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p>{new Date(active.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {/* <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Order / Subscription reference
                </p>
                <p className="font-mono text-xs">{active.referenceId ?? '—'}</p>
              </div> */}
              {active.customerName ? (
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p>{active.customerName}</p>
                </div>
              ) : null}
              {active.note ? (
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Notes / Address snapshot
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
