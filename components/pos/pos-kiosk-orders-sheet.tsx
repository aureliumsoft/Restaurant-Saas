'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, Monitor, Pencil, Printer } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiErrorMessage } from '@/lib/api-error-message';
import eventBus from '@/lib/even';
import { printPosOrderReceipt } from '@/lib/pos-order-receipt-print';
import type { PosOrderDetail } from '@/components/pos/pos-recent-orders-sheet';

const KIOSK_ORDERS_POLL_MS = 5000;

function formatMoney(n: number) {
  return n.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type KioskPendingOrderRow = {
  id: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  tableLabel: string | null;
  createdAt: string;
  customerName: string | null;
  paymentMethod: string;
  paymentAmount: number;
  paymentStatus: string;
  itemCount: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  brandName?: string;
  branchName?: string | null;
  logoUrl?: string | null;
  onEditOrder: (order: PosOrderDetail) => void;
  onOrdersChanged?: () => void;
};

export function PosKioskOrdersSheet({
  open,
  onOpenChange,
  branchId,
  brandName = 'Restaurant',
  branchName,
  logoUrl,
  onEditOrder,
  onOrdersChanged,
}: Props) {
  const [orders, setOrders] = useState<KioskPendingOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [printBusyId, setPrintBusyId] = useState<string | null>(null);
  const [editBusyId, setEditBusyId] = useState<string | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  const [payOrder, setPayOrder] = useState<KioskPendingOrderRow | null>(null);
  const [paidInput, setPaidInput] = useState('');
  const [paying, setPaying] = useState(false);
  const loadRequestRef = useRef(0);

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const requestId = ++loadRequestRef.current;
    if (!opts?.silent) setLoading(true);
    try {
      const res = await axios.get<{ data: KioskPendingOrderRow[] }>(
        '/api/restaurant/kiosk-order/pending-cash',
        { params: branchId ? { branchId } : undefined }
      );
      if (requestId !== loadRequestRef.current) return;
      setOrders(res.data.data ?? []);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      if (!opts?.silent) {
        setOrders([]);
        toast.error(apiErrorMessage(error, 'Could not load kiosk orders.'));
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
    const intervalId = window.setInterval(() => {
      void loadOrders({ silent: true });
    }, KIOSK_ORDERS_POLL_MS);
    const onRefresh = () => void loadOrders({ silent: true });
    eventBus.on('refreshKioskOrders', onRefresh);
    return () => {
      window.clearInterval(intervalId);
      eventBus.removeListener('refreshKioskOrders', onRefresh);
    };
  }, [open, branchId, loadOrders]);

  const notifyChanged = () => {
    eventBus.emit('refreshKioskOrders');
    eventBus.emit('refreshRecentOrders');
    onOrdersChanged?.();
  };

  const fetchOrderDetail = async (orderId: string) => {
    const res = await axios.get<{ data: PosOrderDetail }>(
      `/api/restaurant/kiosk-order/${encodeURIComponent(orderId)}`
    );
    return res.data.data;
  };

  const handlePrint = async (orderId: string) => {
    setPrintBusyId(orderId);
    try {
      const detail = await fetchOrderDetail(orderId);
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
        orderMode: 'pos',
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
      });
      if (!ok) toast.error('Could not open print preview.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not print receipt.'));
    } finally {
      setPrintBusyId(null);
    }
  };

  const handleEdit = async (orderId: string) => {
    setEditBusyId(orderId);
    try {
      const detail = await fetchOrderDetail(orderId);
      onEditOrder(detail);
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not load order for editing.'));
    } finally {
      setEditBusyId(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (
      !window.confirm(
        'Cancel this kiosk order? Kitchen tickets will be canceled.'
      )
    ) {
      return;
    }
    setCancelBusyId(orderId);
    try {
      await axios.patch(
        `/api/restaurant/kiosk-order/${encodeURIComponent(orderId)}/cancel`
      );
      toast.success('Kiosk order canceled.');
      await loadOrders();
      notifyChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not cancel order.'));
    } finally {
      setCancelBusyId(null);
    }
  };

  const openPayDialog = (order: KioskPendingOrderRow) => {
    setPayOrder(order);
    setPaidInput(order.total.toFixed(2));
  };

  const closePayDialog = () => {
    if (paying) return;
    setPayOrder(null);
    setPaidInput('');
  };

  const payChange =
    payOrder != null
      ? Math.max(0, (Number(paidInput) || 0) - payOrder.total)
      : 0;

  const handlePay = async () => {
    if (!payOrder) return;
    const paid = Number(paidInput);
    if (!Number.isFinite(paid) || paid < payOrder.total) {
      toast.warn('Paid amount must be at least the order total.');
      return;
    }
    setPaying(true);
    try {
      const res = await axios.post<{
        data: { paid: number; change: number; paymentStatus: string };
      }>(
        `/api/restaurant/kiosk-order/${encodeURIComponent(payOrder.id)}/pay`,
        { paid }
      );
      const change = res.data.data?.change ?? payChange;
      toast.success(
        `Payment completed — change €${formatMoney(change)}`
      );
      setPayOrder(null);
      setPaidInput('');
      await loadOrders();
      notifyChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not record payment.'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex h-full max-h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Kiosk orders
            </SheetTitle>
            <SheetDescription>
              Cash kiosk orders awaiting payment. Collect cash, print, edit, or
              cancel.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No pending cash kiosk orders.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {orders.map((order) => {
                  const printBusy = printBusyId === order.id;
                  const editBusy = editBusyId === order.id;
                  const cancelBusy = cancelBusyId === order.id;
                  const busy = printBusy || editBusy || cancelBusy || paying;
                  const label =
                    order.ticketNumber != null
                      ? `Ticket #${String(order.ticketNumber).padStart(2, '0')}`
                      : order.shortOrderId;
                  return (
                    <li
                      key={order.id}
                      className="flex flex-col gap-3 px-4 py-3 text-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' · Cash · Pending'}
                            {order.customerName
                              ? ` · ${order.customerName}`
                              : ''}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {order.itemCount} item
                            {order.itemCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">
                          €{formatMoney(order.total)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Print receipt"
                            disabled={busy}
                            onClick={() => void handlePrint(order.id)}
                          >
                            {printBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Printer className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit order"
                            disabled={busy}
                            onClick={() => void handleEdit(order.id)}
                          >
                            {editBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => openPayDialog(order)}
                          >
                            Pay
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleCancel(order.id)}
                          >
                            {cancelBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Cancel'
                            )}
                          </Button>
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

      <Dialog
        open={payOrder != null}
        onOpenChange={(open) => {
          if (!open) closePayDialog();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay with cash</DialogTitle>
          </DialogHeader>
          {payOrder ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order total</span>
                <span className="font-semibold tabular-nums">
                  €{formatMoney(payOrder.total)}
                </span>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Paid</label>
                <Input
                  className="h-9 bg-background"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={paidInput}
                  disabled={paying}
                  onChange={(e) => setPaidInput(e.target.value)}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Change</span>
                <span className="font-semibold tabular-nums">
                  €{formatMoney(payChange)}
                </span>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={paying}
              onClick={closePayDialog}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={paying || !payOrder}
              onClick={() => void handlePay()}
            >
              {paying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                'Complete payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
