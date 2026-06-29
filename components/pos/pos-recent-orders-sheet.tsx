'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { History, Loader2, Pencil, Printer } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { printPosOrderReceipt } from '@/lib/pos-order-receipt-print';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { apiErrorMessage } from '@/lib/api-error-message';
import eventBus from '@/lib/even';
import { isCanceledOrderStatus } from '@/lib/sales-order-status';
import { cn } from '@/lib/utils';

export type PosRecentOrderRow = {
  id: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  sourceType?: 'POS' | 'KIOSK' | string;
  createdAt: string;
  customerName: string | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  itemCount: number;
};

export type PosOrderDetail = {
  id: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  taxAmount: number;
  discountAmount: number;
  serviceChargeAmount: number;
  address: string | null;
  tableId: string | null;
  tableLabel: string | null;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string | null;
  paymentMode: string;
  paymentAmount: number;
  paymentStatus: string;
  createdAt: string;
  items: Array<{
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    imageUrl: string | null;
    modifiers: { name: string; unitPrice: number }[];
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  brandName?: string;
  branchName?: string | null;
  logoUrl?: string | null;
  onEditOrder: (order: PosOrderDetail, source: 'pos' | 'kiosk') => void;
};

export function PosRecentOrdersSheet({
  open,
  onOpenChange,
  branchId,
  brandName = 'Restaurant',
  branchName,
  logoUrl,
  onEditOrder,
}: Props) {
  const { formatMoney, regional } = useOwnerRestaurantRegional();
  const [orders, setOrders] = useState<PosRecentOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [printBusyId, setPrintBusyId] = useState<string | null>(null);
  const [editBusyId, setEditBusyId] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const requestId = ++loadRequestRef.current;
    if (!opts?.silent) setLoading(true);
    try {
      const res = await axios.get<{ data: PosRecentOrderRow[] }>(
        '/api/restaurant/pos-order/recent',
        { params: branchId ? { branchId } : undefined }
      );
      if (requestId !== loadRequestRef.current) return;
      setOrders(res.data.data ?? []);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      if (!opts?.silent) {
        setOrders([]);
        toast.error(apiErrorMessage(error, 'Could not load recent orders.'));
      }
    } finally {
      if (!opts?.silent && requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [branchId]);

  useEffect(() => {
    if (!open) return;
    void loadOrders();
    const onRefresh = () => void loadOrders({ silent: true });
    eventBus.on('refreshRecentOrders', onRefresh);
    return () => {
      eventBus.removeListener('refreshRecentOrders', onRefresh);
    };
  }, [open, branchId, loadOrders]);

  const orderSource = (row: PosRecentOrderRow): 'pos' | 'kiosk' =>
    row.sourceType === 'KIOSK' ? 'kiosk' : 'pos';

  const fetchOrderDetail = async (
    orderId: string,
    source: 'pos' | 'kiosk'
  ) => {
    const base =
      source === 'kiosk'
        ? '/api/restaurant/kiosk-order'
        : '/api/restaurant/pos-order';
    const res = await axios.get<{ data: PosOrderDetail }>(
      `${base}/${encodeURIComponent(orderId)}`
    );
    return res.data.data;
  };

  const handlePrint = async (order: PosRecentOrderRow) => {
    setPrintBusyId(order.id);
    try {
      const source = orderSource(order);
      const detail = await fetchOrderDetail(order.id, source);
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

  const handleEdit = async (order: PosRecentOrderRow) => {
    if (isCanceledOrderStatus(order.status)) return;
    if (orderSource(order) === 'kiosk') return;
    setEditBusyId(order.id);
    try {
      const detail = await fetchOrderDetail(order.id, 'pos');
      onEditOrder(detail, 'pos');
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not load order for editing.'));
    } finally {
      setEditBusyId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Today&apos;s orders
          </SheetTitle>
          <SheetDescription>
            POS and kiosk orders paid at the counter today. Print a receipt or
            edit a POS order in the cart.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No orders today yet.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {orders.map((order) => {
                const printBusy = printBusyId === order.id;
                const editBusy = editBusyId === order.id;
                const isKiosk = orderSource(order) === 'kiosk';
                const canceled = isCanceledOrderStatus(order.status);
                const label =
                  order.ticketNumber != null
                    ? `Ticket #${String(order.ticketNumber).padStart(2, '0')}`
                    : order.shortOrderId;
                return (
                  <li
                    key={order.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 text-sm',
                      canceled && 'bg-muted/30'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            'font-medium',
                            canceled && 'text-muted-foreground line-through'
                          )}
                        >
                          {label}
                        </p>
                        {canceled ? (
                          <Badge
                            variant="destructive"
                            className="h-5 px-1.5 text-[10px] uppercase"
                          >
                            Canceled
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
                        {isKiosk ? ' · Kiosk' : ''}
                        {order.customerName ? ` · ${order.customerName}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p
                        className={cn(
                          'font-semibold tabular-nums',
                          canceled && 'text-muted-foreground line-through'
                        )}
                      >
                        {formatMoney(order.total)}
                      </p>
                      <div className="flex items-center gap-1">
                        {!canceled ? (
                          <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Print receipt"
                          disabled={printBusy || editBusy}
                          onClick={() => void handlePrint(order)}
                        >
                          {printBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        {!isKiosk ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit order"
                          disabled={printBusy || editBusy}
                          onClick={() => void handleEdit(order)}
                        >
                          {editBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </Button>
                        ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => void loadOrders()}
          >
            Refresh
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
