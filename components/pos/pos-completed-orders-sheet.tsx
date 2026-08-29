'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, PackageCheck, Printer } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  posOrderApiPath,
} from '@/lib/dashboard-paths';
import { printPosOrderReceipt } from '@/lib/pos-order-receipt-print';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import {
  usePosCompletedOrders,
  type PosCompletedOrderRow,
} from '@/hooks/use-pos-completed-orders';
import { apiErrorMessage } from '@/lib/api-error-message';
import eventBus from '@/lib/even';
import type { PosOrderDetail } from '@/components/pos/pos-recent-orders-sheet';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  brandName?: string;
  branchName?: string | null;
  logoUrl?: string | null;
};

const PAGE_SIZE = 20;

function OrderSkeletonRow() {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-9 w-24" />
    </li>
  );
}

function sourceLabel(sourceType?: string): string {
  const s = String(sourceType ?? '').toUpperCase();
  if (s === 'KIOSK') return 'Kiosk';
  if (s === 'ONLINE') return 'Online';
  if (s === 'POS') return 'POS';
  return s || 'Order';
}

export function PosCompletedOrdersSheet({
  open,
  onOpenChange,
  branchId,
  brandName = 'Restaurant',
  branchName,
  logoUrl,
}: Props) {
  const { formatMoney, regional } = useOwnerRestaurantRegional();
  const { orders, loading, refreshing, refresh, removeOrder } =
    usePosCompletedOrders(branchId);
  const [extraOrders, setExtraOrders] = useState<PosCompletedOrderRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [printBusyId, setPrintBusyId] = useState<string | null>(null);
  const [deliverBusyId, setDeliverBusyId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const displayOrders =
    extraOrders.length > 0 ? [...orders, ...extraOrders] : orders;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || nextOffset == null) return;
    setLoadingMore(true);
    try {
      const res = await axios.get<{
        data: PosCompletedOrderRow[];
        pagination?: { nextOffset: number | null; hasMore: boolean };
      }>('/api/restaurant/pos-order/completed', {
        params: {
          ...(branchId ? { branchId } : {}),
          limit: PAGE_SIZE,
          offset: nextOffset,
        },
      });
      const page = res.data.data ?? [];
      setExtraOrders((prev) => {
        const seen = new Set([...orders, ...prev].map((o) => o.id));
        const merged = [...prev];
        for (const row of page) {
          if (!seen.has(row.id)) merged.push(row);
        }
        return merged;
      });
      setHasMore(Boolean(res.data.pagination?.hasMore));
      setNextOffset(res.data.pagination?.nextOffset ?? null);
    } catch {
      // ignore pagination errors
    } finally {
      setLoadingMore(false);
    }
  }, [branchId, hasMore, loadingMore, nextOffset, orders]);

  useEffect(() => {
    if (!open) return;
    setExtraOrders([]);
    setHasMore(false);
    setNextOffset(null);
    refresh();
  }, [open, branchId, refresh]);

  useEffect(() => {
    if (!open) return;
    setHasMore(orders.length >= PAGE_SIZE);
    setNextOffset(orders.length >= PAGE_SIZE ? PAGE_SIZE : null);
  }, [open, orders.length]);

  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (remaining < 120) void loadMore();
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [open, loadMore]);

  const fetchOrderDetail = async (row: PosCompletedOrderRow) => {
    const res = await axios.get<{ data: PosOrderDetail }>(
      posOrderApiPath(row.id, '', row.urlId)
    );
    return res.data.data;
  };

  const handlePrint = async (order: PosCompletedOrderRow) => {
    setPrintBusyId(order.id);
    try {
      const detail = await fetchOrderDetail(order);
      const subtotal = detail.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );
      const ok = printPosOrderReceipt({
        orderRef: detail.shortOrderId,
        ticketNumber: detail.ticketNumber,
        brandName,
        branchName,
        logoUrl,
        orderMode: detail.tableLabel
          ? 'tables'
          : detail.address
            ? 'delivery'
            : 'pos',
        paymentMethodLabel: detail.paymentMethod ?? 'Cash',
        tableLabel: detail.tableLabel,
        customerName: detail.customerName,
        customerPhone: detail.customerPhone,
        address: detail.address,
        lines: detail.items.map((item) => ({
          name: item.name,
          qty: item.quantity,
          lineTotal: item.unitPrice * item.quantity,
        })),
        subtotal,
        serviceChargeAmount: detail.serviceChargeAmount,
        taxAmount: detail.taxAmount,
        discountAmount: detail.discountAmount,
        grandTotal: detail.total,
        paidAmount: detail.paymentAmount,
        paymentMode: detail.paymentMode,
        currencyCode: regional.currencyCode,
        countryCode: regional.countryCode,
      });
      if (!ok) toast.error('Could not open print preview.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not print receipt.'));
    } finally {
      setPrintBusyId(null);
    }
  };

  const handleDelivered = async (order: PosCompletedOrderRow) => {
    setDeliverBusyId(order.id);
    try {
      await axios.post(
        `${posOrderApiPath(order.id, '', order.urlId)}/deliver`
      );
      removeOrder(order.id);
      setExtraOrders((prev) => prev.filter((o) => o.id !== order.id));
      toast.success('Order marked as delivered.');
      eventBus.emit('refreshRecentOrders');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not mark order as delivered.'));
    } finally {
      setDeliverBusyId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Completed orders
          </SheetTitle>
          <SheetDescription>
            Kitchen-finished orders ready to hand off. Mark delivered when the
            customer receives their order.
          </SheetDescription>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4"
        >
          {loading && displayOrders.length === 0 ? (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {Array.from({ length: 5 }).map((_, i) => (
                <OrderSkeletonRow key={i} />
              ))}
            </ul>
          ) : displayOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No completed orders waiting for delivery.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {displayOrders.map((order) => {
                const label =
                  order.ticketNumber != null
                    ? `Token #${String(order.ticketNumber).padStart(2, '0')}`
                    : order.shortOrderId;
                const printBusy = printBusyId === order.id;
                const deliverBusy = deliverBusyId === order.id;
                return (
                  <li
                    key={order.id}
                    className="flex items-start gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{label}</p>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {sourceLabel(order.sourceType)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
                        {order.customerName ? ` · ${order.customerName}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="font-semibold tabular-nums">
                        {formatMoney(order.total)}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title="Print receipt"
                          disabled={printBusy || deliverBusy}
                          onClick={() => void handlePrint(order)}
                        >
                          {printBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1"
                          disabled={printBusy || deliverBusy}
                          onClick={() => void handleDelivered(order)}
                        >
                          {deliverBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PackageCheck className="h-4 w-4" />
                          )}
                          Delivered
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {loadingMore ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Loading more…
            </p>
          ) : null}
          {refreshing && displayOrders.length > 0 ? (
            <p className="py-2 text-center text-[10px] text-muted-foreground">
              Updating…
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
