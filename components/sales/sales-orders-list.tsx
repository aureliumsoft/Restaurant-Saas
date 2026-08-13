'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DashboardTable as Table,
  DashboardTableBody as TableBody,
  DashboardTableCell as TableCell,
  DashboardTableHead as TableHead,
  DashboardTableHeader as TableHeader,
  DashboardTableRow as TableRow,
  DashboardTableWrapper as TableWrapper,
} from '@/components/dashboard/dashboard-table';
import { orderSourceLabel } from '@/lib/order-source-label';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import eventBus from '@/lib/even';
import type { SalesOrderRow, SalesOrdersApiResponse } from '@/types/sales-order';
import { cn } from '@/lib/utils';

type SalesOrdersListProps = {
  onSelectSaleTransaction?: (id: string) => void;
  selectedTransactionId?: string | null;
};

export function SalesOrdersList({
  onSelectSaleTransaction,
  selectedTransactionId,
}: SalesOrdersListProps) {
  const { formatMoney: formatCurrencyAmount } = useOwnerRestaurantRegional();
  const formatMoney = (n: number | null) =>
    n == null || Number.isNaN(n) ? '—' : formatCurrencyAmount(n);
  const [rows, setRows] = useState<SalesOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<SalesOrdersApiResponse>(
        '/api/restaurant/sales-orders?tab=online&page=1&status=all'
      );
      const d = res.data;
      setRows(
        d.orders ??
          [
            ...(d.onlineOrders ?? []),
            ...(d.posOrders ?? []),
            ...(d.kioskOrders ?? []),
          ].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          )
      );
    } catch (e: unknown) {
      setError('Could not load orders.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    eventBus.on('refreshSalesOrders', handler);
    return () => {
      eventBus.removeListener('refreshSalesOrders', handler);
    };
  }, [load]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">All orders</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 gap-1"
          disabled={loading}
          onClick={() => load()}
        >
          <RefreshCw
            className={cn('h-4 w-4', loading && 'animate-spin')}
          />
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="hidden sm:table-cell">Source</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No orders yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isSale = row.kind === 'sale_transaction';
                const isSelected =
                  isSale && selectedTransactionId === row.id;
                return (
                  <TableRow
                    key={`${row.kind}-${row.id}`}
                    className={cn(
                      isSale && onSelectSaleTransaction && 'cursor-pointer',
                      isSelected && 'bg-muted/60'
                    )}
                    onClick={() => {
                      if (isSale && onSelectSaleTransaction) {
                        onSelectSaleTransaction(row.id);
                      }
                    }}
                  >
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {row.kind === 'menu_order' ? 'Menu' : 'Sale'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.id}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="font-normal">
                        {row.sourceType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.total)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {row.status}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableWrapper>
      <p className="text-xs text-muted-foreground">
        Menu orders come from checkout (online). Sale rows are register / POS. Click a
        sale row to open line items below.
      </p>
    </div>
  );
}
