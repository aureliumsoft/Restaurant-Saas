'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  Banknote,
  Check,
  ChefHat,
  ChevronDown,
  CreditCard,
  Loader2,
  RefreshCw,
  Table2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import {
  useOpenTableOrders,
  markOpenTableOrderKitchenSent,
  type OpenTableCard,
  type OpenTableOrderRow,
} from '@/hooks/use-open-table-orders';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';
import { apiErrorMessage } from '@/lib/api-error-message';
import eventBus from '@/lib/even';
import { cn } from '@/lib/utils';
import { PosOnScreenKeyboard } from '@/components/pos/pos-on-screen-keyboard';
import { Button } from '@/components/ui/button';
import { DeleteConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  onOrdersChanged?: () => void;
};

const KITCHEN_PREP_PRESETS = [10, 15, 30] as const;
const KITCHEN_PREP_MIN = 1;
const KITCHEN_PREP_MAX = 240;

function ticketLabel(order: OpenTableOrderRow): string {
  return order.ticketNumber != null
    ? `#${String(order.ticketNumber).padStart(2, '0')}`
    : order.shortOrderId.slice(0, 6).toUpperCase();
}

function kitchenTone(order: OpenTableOrderRow): {
  label: string;
  className: string;
} {
  if (!order.kitchenSent) {
    return {
      label: 'Held',
      className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    };
  }
  const s = String(order.kitchenStatus ?? 'making').toLowerCase();
  if (s === 'ready') {
    return {
      label: 'Ready',
      className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
    };
  }
  if (s === 'completed' || s === 'done' || s === 'served') {
    return {
      label: 'Done',
      className: 'bg-muted text-muted-foreground',
    };
  }
  return {
    label: 'Kitchen',
    className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  };
}

function isUnpaid(order: OpenTableOrderRow): boolean {
  const s = String(order.paymentStatus ?? '').toLowerCase();
  return s === 'pending' || s === 'pedding' || s === '';
}

function itemsPreview(order: OpenTableOrderRow): string {
  return order.items
    .map((it) => (it.quantity > 1 ? `${it.quantity}× ${it.name}` : it.name))
    .join(' · ');
}

function StatusChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold',
        className
      )}
    >
      {label}
    </span>
  );
}

export function PosTableOrdersSheet({
  open,
  onOpenChange,
  branchId,
  onOrdersChanged,
}: Props) {
  const { formatMoney } = useOwnerRestaurantRegional();
  const { settings: fulfillmentSettings } = useRestaurantFulfillmentSettings();
  const { cards, loading, removeTable, confirmInBackground, refresh } =
    useOpenTableOrders(branchId);

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payCard, setPayCard] = useState<OpenTableCard | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'card'>('cash');
  const [paidInput, setPaidInput] = useState('');
  const [paidKeyboardOpen, setPaidKeyboardOpen] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<OpenTableOrderRow | null>(
    null
  );
  const [cancellingOrder, setCancellingOrder] = useState(false);

  const [kitchenOrder, setKitchenOrder] = useState<OpenTableOrderRow | null>(
    null
  );
  const [kitchenPrepMinutes, setKitchenPrepMinutes] = useState(15);
  const [kitchenCustomMinutes, setKitchenCustomMinutes] = useState('');
  const [sendingToKitchen, setSendingToKitchen] = useState(false);
  const [expandedTicketIds, setExpandedTicketIds] = useState<Set<string>>(
    () => new Set()
  );

  const anyBusy =
    busyOrderId != null || paying || sendingToKitchen || cancellingOrder;

  const toggleTicketExpanded = (orderId: string) => {
    setExpandedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const notifyChanged = (diningTableId?: string, removeIfEmpty = false) => {
    if (diningTableId && removeIfEmpty) removeTable(diningTableId);
    confirmInBackground();
    window.setTimeout(() => {
      eventBus.emit('refreshRecentOrders');
      onOrdersChanged?.();
    }, 0);
  };

  const cancelOrderLabel = (order: OpenTableOrderRow) =>
    order.ticketNumber != null
      ? `Ticket #${String(order.ticketNumber).padStart(2, '0')}`
      : order.shortOrderId;

  const confirmCancelOrder = async () => {
    if (!cancelOrder) return;
    const order = cancelOrder;
    const label = cancelOrderLabel(order);
    setCancellingOrder(true);
    setBusyOrderId(order.id);
    try {
      const res = await axios.post<{
        data: { canceledOrderIds: string[] };
      }>('/api/restaurant/table-orders/cancel', {
        orderIds: [order.id],
      });
      toast.success(`${label} canceled.`);
      setCancelOrder(null);
      const remainingOnTable = cards
        .find((c) => c.diningTableId === order.diningTableId)
        ?.orders.filter(
          (o) =>
            o.id !== order.id &&
            !(res.data.data?.canceledOrderIds ?? []).includes(o.id)
        );
      notifyChanged(
        order.diningTableId,
        !remainingOnTable || remainingOnTable.length === 0
      );
      refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not cancel order.'));
      confirmInBackground();
    } finally {
      setCancellingOrder(false);
      setBusyOrderId(null);
    }
  };

  const openKitchenDialog = (order: OpenTableOrderRow) => {
    if (order.kitchenSent) {
      toast.info('This order is already in the kitchen.');
      return;
    }
    setKitchenOrder(order);
    setKitchenPrepMinutes(15);
    setKitchenCustomMinutes('');
  };

  const closeKitchenDialog = () => {
    if (sendingToKitchen) return;
    setKitchenOrder(null);
    setKitchenCustomMinutes('');
  };

  const resolvePrepMinutes = (): number | null => {
    const custom = kitchenCustomMinutes.trim();
    if (custom) {
      const n = Number(custom);
      if (
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n < KITCHEN_PREP_MIN ||
        n > KITCHEN_PREP_MAX
      ) {
        toast.warn(
          `Prep time must be between ${KITCHEN_PREP_MIN} and ${KITCHEN_PREP_MAX} minutes.`
        );
        return null;
      }
      return n;
    }
    return kitchenPrepMinutes;
  };

  const handleSendKitchenConfirm = async () => {
    if (!kitchenOrder) return;
    const minutes = resolvePrepMinutes();
    if (minutes == null) return;

    setSendingToKitchen(true);
    try {
      await axios.post('/api/restaurant/table-orders/send-kitchen', {
        orderIds: [kitchenOrder.id],
        selectedMinutes: minutes,
      });
      toast.success(
        `Sent to kitchen · ${minutes} min · ${
          kitchenOrder.ticketNumber != null
            ? `ticket #${String(kitchenOrder.ticketNumber).padStart(2, '0')}`
            : kitchenOrder.shortOrderId
        }`
      );
      setKitchenOrder(null);
      setKitchenCustomMinutes('');
      markOpenTableOrderKitchenSent(branchId, kitchenOrder.id);
      confirmInBackground();
      onOrdersChanged?.();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not send to kitchen.'));
      confirmInBackground();
    } finally {
      setSendingToKitchen(false);
    }
  };

  const openPay = (card: OpenTableCard) => {
    if (card.totalDue <= 0 || card.unpaidCount <= 0) {
      toast.info('This table has no unpaid tickets.');
      return;
    }
    if (card.kitchenPendingCount > 0) {
      toast.warn(
        `Send all tickets to kitchen first (${card.kitchenPendingCount} still held).`
      );
      return;
    }
    const unpaid = card.orders.filter((o) => {
      const s = String(o.paymentStatus ?? '').toLowerCase();
      return s === 'pending' || s === 'pedding';
    });
    const due = unpaid.reduce((s, o) => s + o.total, 0);
    if (unpaid.length === 0 || due <= 0) {
      toast.info('This table has no unpaid tickets.');
      return;
    }

    // Open instantly from current SWR cache — don't block UX on a slow refetch.
    setPayCard({
      ...card,
      orders: unpaid,
      orderCount: unpaid.length,
      unpaidCount: unpaid.length,
      totalDue: due,
    });
    setPayMethod('cash');
    setPaidInput(due.toFixed(2));
    setPaidKeyboardOpen(false);

    // Soft sync in background; update dialog if totals changed.
    const tableId = card.diningTableId;
    void refresh().then((freshCards) => {
      if (!freshCards) return;
      const latest = freshCards.find((c) => c.diningTableId === tableId);
      if (!latest) {
        toast.info('This table is no longer open.');
        setPayCard(null);
        return;
      }
      if (latest.kitchenPendingCount > 0) {
        toast.warn(
          `Send all tickets to kitchen first (${latest.kitchenPendingCount} still held).`
        );
        setPayCard(null);
        return;
      }
      const nextUnpaid = latest.orders.filter((o) => {
        const s = String(o.paymentStatus ?? '').toLowerCase();
        return s === 'pending' || s === 'pedding';
      });
      const nextDue = nextUnpaid.reduce((s, o) => s + o.total, 0);
      if (nextUnpaid.length === 0 || nextDue <= 0) {
        toast.info('This table has no unpaid tickets.');
        setPayCard(null);
        return;
      }
      setPayCard((prev) => {
        if (!prev || prev.diningTableId !== tableId) return prev;
        return {
          ...latest,
          orders: nextUnpaid,
          orderCount: nextUnpaid.length,
          unpaidCount: nextUnpaid.length,
          totalDue: nextDue,
        };
      });
      setPaidInput((prev) => {
        // Keep staff-typed amount unless they hadn't changed from the old due.
        const prevNum = Number(prev);
        if (Number.isFinite(prevNum) && Math.abs(prevNum - due) < 0.001) {
          return nextDue.toFixed(2);
        }
        return prev;
      });
    });
  };

  const closePay = () => {
    if (paying) return;
    setPayCard(null);
    setPayMethod('cash');
    setPaidInput('');
    setPaidKeyboardOpen(false);
  };

  const payChange =
    payCard != null && payMethod === 'cash'
      ? Math.max(0, (Number(paidInput) || 0) - payCard.totalDue)
      : 0;

  const handlePay = async () => {
    if (!payCard) return;
    if (payCard.kitchenPendingCount > 0) {
      toast.warn(
        `Send all tickets to kitchen first (${payCard.kitchenPendingCount} still held).`
      );
      setPayCard(null);
      return;
    }
    const unpaidIds = payCard.orders
      .filter((o) => {
        const s = String(o.paymentStatus ?? '').toLowerCase();
        return s === 'pending' || s === 'pedding';
      })
      .map((o) => o.id);
    if (unpaidIds.length === 0) {
      toast.info('This table has no unpaid tickets.');
      setPayCard(null);
      return;
    }
    const paid =
      payMethod === 'card' ? payCard.totalDue : Number(paidInput);
    if (!Number.isFinite(paid) || paid < payCard.totalDue) {
      toast.warn(
        payMethod === 'card'
          ? 'Card payment must cover the table total.'
          : 'Paid amount must be at least the table total.'
      );
      return;
    }
    setPaying(true);
    const tableId = payCard.diningTableId;
    try {
      const res = await axios.post<{
        data: {
          change: number;
          ticketCount?: number;
          tableCleared?: boolean;
          remainingUnpaidCount?: number;
        };
      }>('/api/restaurant/table-orders/pay', {
        diningTableId: tableId,
        paid,
        method: payMethod === 'card' ? 'Card' : 'Cash',
        orderIds: unpaidIds,
      });
      const change = res.data.data?.change ?? payChange;
      const ticketCount = res.data.data?.ticketCount ?? unpaidIds.length;
      const tableCleared = res.data.data?.tableCleared !== false;
      setPayCard(null);
      setPayMethod('cash');
      setPaidInput('');
      setPaidKeyboardOpen(false);
      toast.success(
        payMethod === 'card'
          ? `Table ${payCard.tableLabel} · ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} paid by card`
          : `Table ${payCard.tableLabel} · ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} paid — change ${formatMoney(change)}`
      );
      notifyChanged(tableId, tableCleared);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not complete payment.'));
      confirmInBackground();
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex h-full max-h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 border-b px-5 py-3.5 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              Table orders
              {cards.length > 0 ? (
                <span className="ml-0.5 rounded-full bg-fire-500 px-2 py-0.5 text-xs font-bold text-white">
                  {cards.length}
                </span>
              ) : null}
            </SheetTitle>
            <SheetDescription>
              Send held tickets, then collect payment for the whole table.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {loading && cards.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-2xl border border-border/50 p-3"
                  >
                    <div className="flex justify-between">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : cards.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <Table2 className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  No open tables
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  New table tickets will show up here.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {cards.map((card) => {
                  const canPay =
                    card.totalDue > 0 && card.kitchenPendingCount === 0;
                  return (
                    <li
                      key={card.diningTableId}
                      className="overflow-hidden rounded-2xl border border-border/60 bg-card"
                    >
                      <div className="flex items-center gap-3 border-b border-border/40 bg-muted/25 px-3.5 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fire-500/10 text-fire-600 dark:text-fire-400">
                          <Table2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {card.tableLabel}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <StatusChip
                              label={`${card.orderCount} ticket${card.orderCount === 1 ? '' : 's'}`}
                              className="bg-muted text-muted-foreground"
                            />
                            {card.unpaidCount > 0 ? (
                              <StatusChip
                                label={`${card.unpaidCount} unpaid`}
                                className="bg-amber-500/15 text-amber-800 dark:text-amber-300"
                              />
                            ) : (
                              <StatusChip
                                label="Paid"
                                className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                              />
                            )}
                            {card.kitchenPendingCount > 0 ? (
                              <StatusChip
                                label={`${card.kitchenPendingCount} held`}
                                className="bg-amber-500/15 text-amber-800 dark:text-amber-300"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {card.totalDue > 0 ? (
                            <p className="text-base font-bold tabular-nums text-fire-600 dark:text-fire-400">
                              {formatMoney(card.totalDue)}
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              Settled
                            </p>
                          )}
                        </div>
                      </div>

                      <ul className="divide-y divide-border/40">
                        {card.orders.map((order) => {
                          const orderBusy =
                            busyOrderId === order.id ||
                            (sendingToKitchen &&
                              kitchenOrder?.id === order.id);
                          const kitchen = kitchenTone(order);
                          const unpaid = isUnpaid(order);
                          const expanded = expandedTicketIds.has(order.id);
                          const preview = itemsPreview(order);

                          return (
                            <li key={order.id} className="px-3 py-2.5">
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() =>
                                    toggleTicketExpanded(order.id)
                                  }
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                                      {ticketLabel(order)}
                                      <ChevronDown
                                        className={cn(
                                          'h-3.5 w-3.5 text-muted-foreground transition-transform',
                                          expanded && 'rotate-180'
                                        )}
                                      />
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                                      {formatMoney(order.total)}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-1">
                                    <StatusChip
                                      label={kitchen.label}
                                      className={kitchen.className}
                                    />
                                    <StatusChip
                                      label={unpaid ? 'Unpaid' : 'Paid'}
                                      className={
                                        unpaid
                                          ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                                          : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                      }
                                    />
                                    {order.sourceType === 'KIOSK' ? (
                                      <StatusChip
                                        label="Kiosk"
                                        className="bg-muted text-muted-foreground"
                                      />
                                    ) : null}
                                  </div>
                                  {!expanded ? (
                                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                                      {preview || 'No items'}
                                    </p>
                                  ) : null}
                                </button>

                                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                  {!order.kitchenSent ? (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8 rounded-lg"
                                      title="Send to kitchen"
                                      disabled={anyBusy || orderBusy}
                                      onClick={() => openKitchenDialog(order)}
                                    >
                                      <ChefHat className="h-3.5 w-3.5" />
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    title="Cancel ticket"
                                    disabled={anyBusy || orderBusy}
                                    onClick={() => setCancelOrder(order)}
                                  >
                                    {busyOrderId === order.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <X className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {expanded ? (
                                <ul className="mt-2 space-y-0.5 rounded-lg bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                                  {order.items.map((it, idx) => (
                                    <li
                                      key={`${order.id}-${idx}`}
                                      className="flex justify-between gap-2"
                                    >
                                      <span className="min-w-0 truncate">
                                        {it.name}
                                      </span>
                                      <span className="shrink-0 tabular-nums">
                                        ×{it.quantity}
                                      </span>
                                    </li>
                                  ))}
                                  <li className="pt-1 text-[10px] text-muted-foreground/80">
                                    {order.shortOrderId}
                                    {order.customerName
                                      ? ` · ${order.customerName}`
                                      : ''}
                                  </li>
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>

                      <div className="border-t border-border/40 px-3 py-2.5">
                        {card.totalDue > 0 ? (
                          <div className="space-y-1.5">
                            {card.kitchenPendingCount > 0 ? (
                              <p className="text-center text-[11px] text-amber-700 dark:text-amber-300">
                                Send {card.kitchenPendingCount} held ticket
                                {card.kitchenPendingCount === 1 ? '' : 's'} before
                                paying
                              </p>
                            ) : null}
                            <Button
                              type="button"
                              className="h-11 w-full rounded-xl text-sm font-semibold"
                              disabled={anyBusy || !canPay}
                              onClick={() => openPay(card)}
                            >
                              <Banknote className="mr-2 h-4 w-4" />
                              Pay {formatMoney(card.totalDue)}
                            </Button>
                          </div>
                        ) : card.kitchenPendingCount > 0 ? (
                          <p className="text-center text-xs text-muted-foreground">
                            Paid — send {card.kitchenPendingCount} held ticket
                            {card.kitchenPendingCount === 1 ? '' : 's'} when ready
                          </p>
                        ) : (
                          <p className="text-center text-xs text-emerald-700 dark:text-emerald-300">
                            All tickets paid and in kitchen
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl"
              disabled={loading}
              onClick={() => void refresh()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <DeleteConfirmation
        open={cancelOrder != null}
        title="Cancel order?"
        description={
          cancelOrder
            ? `This cancels the ticket for table ${cancelOrder.tableLabel ?? ''}. Kitchen tickets for this order will also be canceled. Other rounds on the table stay open.`
            : 'This order will be canceled.'
        }
        itemName={
          cancelOrder
            ? `${cancelOrderLabel(cancelOrder)} · ${cancelOrder.shortOrderId}`
            : undefined
        }
        loading={cancellingOrder}
        confirmText="Cancel order"
        cancelText="Keep order"
        onConfirm={() => void confirmCancelOrder()}
        onCancel={() => {
          if (!cancellingOrder) setCancelOrder(null);
        }}
      />

      <Dialog
        open={kitchenOrder != null}
        onOpenChange={(next) => {
          if (!next) closeKitchenDialog();
        }}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => {
            if (sendingToKitchen) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (sendingToKitchen) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Send to kitchen</DialogTitle>
          </DialogHeader>
          {kitchenOrder ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose prep time to show this ticket on the kitchen display.
                Payment stays pending until the table is paid.
              </p>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">
                  Order{' '}
                  {kitchenOrder.ticketNumber != null
                    ? `#${String(kitchenOrder.ticketNumber).padStart(2, '0')}`
                    : kitchenOrder.shortOrderId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Table {kitchenOrder.tableLabel ?? '—'} ·{' '}
                  {kitchenOrder.shortOrderId}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Prep time (minutes)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {KITCHEN_PREP_PRESETS.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={
                        kitchenPrepMinutes === m && !kitchenCustomMinutes.trim()
                          ? 'default'
                          : 'outline'
                      }
                      disabled={sendingToKitchen}
                      onClick={() => {
                        setKitchenPrepMinutes(m);
                        setKitchenCustomMinutes('');
                      }}
                    >
                      {m} min
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={KITCHEN_PREP_MIN}
                  max={KITCHEN_PREP_MAX}
                  placeholder={`Custom (${KITCHEN_PREP_MIN}–${KITCHEN_PREP_MAX})`}
                  value={kitchenCustomMinutes}
                  disabled={sendingToKitchen}
                  onChange={(e) => setKitchenCustomMinutes(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={sendingToKitchen}
              onClick={closeKitchenDialog}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sendingToKitchen || !kitchenOrder}
              onClick={() => void handleSendKitchenConfirm()}
            >
              {sendingToKitchen ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Proceed to kitchen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={payCard != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closePay();
        }}
      >
        <DialogContent
          className="max-w-sm"
          // Keep pay dialog open while using the portaled amount keypad.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Pay table {payCard?.tableLabel ?? ''}</DialogTitle>
          </DialogHeader>
          {payCard ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Open tab ({payCard.unpaidCount} unpaid ticket
                  {payCard.unpaidCount === 1 ? '' : 's'})
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(payCard.totalDue)}
                </span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Payment method
                </label>
                <div
                  className={
                    fulfillmentSettings.cardPaymentsEnabled
                      ? 'grid grid-cols-2 gap-2'
                      : 'grid grid-cols-1 gap-2'
                  }
                >
                  <Button
                    type="button"
                    variant={payMethod === 'cash' ? 'default' : 'outline'}
                    className="h-10 justify-start gap-2"
                    disabled={paying}
                    onClick={() => {
                      setPayMethod('cash');
                      setPaidInput(payCard.totalDue.toFixed(2));
                    }}
                  >
                    <Banknote className="h-4 w-4" />
                    Cash
                  </Button>
                  {fulfillmentSettings.cardPaymentsEnabled ? (
                  <Button
                    type="button"
                    variant={payMethod === 'card' ? 'default' : 'outline'}
                    className="h-10 justify-start gap-2"
                    disabled={paying}
                    onClick={() => {
                      setPayMethod('card');
                      setPaidInput(payCard.totalDue.toFixed(2));
                      setPaidKeyboardOpen(false);
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                    Card
                  </Button>
                  ) : null}
                </div>
              </div>
              {payMethod === 'cash' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Cash paid
                    </label>
                    <Input
                      className="h-9 cursor-pointer bg-background tabular-nums"
                      inputMode="none"
                      autoComplete="off"
                      placeholder="0.00"
                      value={paidInput}
                      disabled={paying}
                      onChange={(e) => setPaidInput(e.target.value)}
                      onPointerDown={() => setPaidKeyboardOpen(true)}
                      onFocus={() => setPaidKeyboardOpen(true)}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Change</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(payChange)}
                    </span>
                  </div>
                  {paidKeyboardOpen ? (
                    <PosOnScreenKeyboard
                      portal={false}
                      mode="numeric"
                      value={paidInput}
                      maxLength={12}
                      onChange={setPaidInput}
                      onClose={() => setPaidKeyboardOpen(false)}
                    />
                  ) : null}
                </>
              ) : (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Charge {formatMoney(payCard.totalDue)} on the card terminal /
                  card machine, then complete payment.
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={paying}
              onClick={closePay}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={paying || !payCard}
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
