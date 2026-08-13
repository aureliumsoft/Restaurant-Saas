'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  Check,
  ChefHat,
  Loader2,
  Table2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import {
  useOpenTableOrders,
  type OpenTableCard,
  type OpenTableOrderRow,
} from '@/hooks/use-open-table-orders';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { apiErrorMessage } from '@/lib/api-error-message';
import eventBus from '@/lib/even';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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

function titleCase(value: string): string {
  const t = value.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function orderKitchenLabel(order: OpenTableOrderRow): string {
  if (!order.kitchenSent) return 'Held';
  const s = String(order.kitchenStatus ?? 'making').toLowerCase();
  if (s === 'pending' || s === 'making') return 'In kitchen';
  if (s === 'ready') return 'Ready';
  if (s === 'completed' || s === 'done' || s === 'served') return 'Done';
  return titleCase(s);
}

function orderPaymentLabel(order: OpenTableOrderRow): string {
  const s = String(order.paymentStatus ?? 'pending').toLowerCase();
  if (s === 'pending') return 'Pay pending';
  if (s === 'completed') return 'Paid';
  return titleCase(s);
}

function orderStatusLabel(order: OpenTableOrderRow): string {
  const s = String(order.status ?? '').toLowerCase();
  if (!s || s === 'pedding') return 'Pending';
  return titleCase(s);
}

function OrderStatusBadges({ order }: { order: OpenTableOrderRow }) {
  const kitchen = orderKitchenLabel(order);
  const payment = orderPaymentLabel(order);
  const status = orderStatusLabel(order);

  return (
    <div className="flex flex-wrap gap-1">
      <Badge
        variant="secondary"
        className={cn(
          'text-[10px] font-medium',
          !order.kitchenSent &&
            'bg-amber-500/15 text-amber-800 dark:text-amber-300'
        )}
      >
        Kitchen: {kitchen}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] font-medium',
          payment === 'Paid' &&
            'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
          payment === 'Pay pending' &&
            'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
        )}
      >
        {payment}
      </Badge>
      <Badge variant="outline" className="text-[10px] font-medium">
        {status}
      </Badge>
      <Badge variant="outline" className="text-[10px] font-medium">
        {order.sourceType}
      </Badge>
    </div>
  );
}

export function PosTableOrdersSheet({
  open,
  onOpenChange,
  branchId,
  onOrdersChanged,
}: Props) {
  const { formatMoney } = useOwnerRestaurantRegional();
  const { cards, loading, removeTable, confirmInBackground, refresh } =
    useOpenTableOrders(branchId);

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payCard, setPayCard] = useState<OpenTableCard | null>(null);
  const [paidInput, setPaidInput] = useState('');
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

  const anyBusy =
    busyOrderId != null || paying || sendingToKitchen || cancellingOrder;

  const notifyChanged = (diningTableId?: string, removeIfEmpty = false) => {
    if (diningTableId && removeIfEmpty) removeTable(diningTableId);
    confirmInBackground();
    window.setTimeout(() => {
      eventBus.emit('refreshRecentOrders');
      eventBus.emit('refreshTableOrders');
      eventBus.emit('refreshKioskOrders');
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
      confirmInBackground();
      refresh();
      eventBus.emit('refreshTableOrders');
      onOrdersChanged?.();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not send to kitchen.'));
      confirmInBackground();
    } finally {
      setSendingToKitchen(false);
    }
  };

  const openPay = (card: OpenTableCard) => {
    if (card.totalDue <= 0) {
      toast.info('This table has no unpaid tickets.');
      return;
    }
    if (card.kitchenPendingCount > 0) {
      toast.warn(
        `Send all tickets to kitchen first (${card.kitchenPendingCount} still held).`
      );
      return;
    }
    setPayCard(card);
    setPaidInput(card.totalDue.toFixed(2));
  };

  const closePay = () => {
    if (paying) return;
    setPayCard(null);
    setPaidInput('');
  };

  const payChange =
    payCard != null
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
    const paid = Number(paidInput);
    if (!Number.isFinite(paid) || paid < payCard.totalDue) {
      toast.warn('Paid amount must be at least the table total.');
      return;
    }
    setPaying(true);
    const tableId = payCard.diningTableId;
    try {
      const res = await axios.post<{
        data: { change: number };
      }>('/api/restaurant/table-orders/pay', {
        diningTableId: tableId,
        paid,
        method: 'Cash',
      });
      const change = res.data.data?.change ?? payChange;
      setPayCard(null);
      setPaidInput('');
      toast.success(
        `Table ${payCard.tableLabel} paid — change ${formatMoney(change)}`
      );
      notifyChanged(tableId, true);
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
        <SheetContent className="flex h-full max-h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              Table orders
              {cards.length > 0 ? (
                <span className="ml-1 rounded-full bg-fire-500 px-2 py-0.5 text-xs font-bold text-white">
                  {cards.length}
                </span>
              ) : null}
            </SheetTitle>
            <SheetDescription>
              Tickets stay here until paid and sent to kitchen. Each ticket can
              be canceled or sent separately; pay settles unpaid tickets for
              the table.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : cards.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No open table orders — nothing waiting for kitchen or payment.
              </p>
            ) : (
              <ul className="space-y-4">
                {cards.map((card) => {
                  return (
                    <li
                      key={card.diningTableId}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-2 text-base font-semibold">
                            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                            Table {card.tableLabel}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {card.orderCount} ticket
                            {card.orderCount === 1 ? '' : 's'}
                            {card.unpaidCount > 0
                              ? ` · ${card.unpaidCount} unpaid`
                              : ' · all paid'}
                            {card.kitchenPendingCount > 0
                              ? ` · ${card.kitchenPendingCount} held`
                              : ''}
                            {card.kitchenSentCount > 0
                              ? ` · ${card.kitchenSentCount} in kitchen`
                              : ''}
                          </p>
                        </div>
                        {card.totalDue > 0 ? (
                          <p className="shrink-0 text-lg font-semibold tabular-nums">
                            {formatMoney(card.totalDue)}
                          </p>
                        ) : (
                          <p className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            Paid
                          </p>
                        )}
                      </div>

                      <ul className="mt-3 space-y-3 border-t border-border/60 pt-3">
                        {card.orders.map((order) => {
                          const orderBusy =
                            busyOrderId === order.id ||
                            (sendingToKitchen && kitchenOrder?.id === order.id);
                          return (
                            <li
                              key={order.id}
                              className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5"
                            >
                              <div className="flex justify-between gap-2 text-sm font-medium">
                                <span>
                                  {order.ticketNumber != null
                                    ? `Ticket #${String(order.ticketNumber).padStart(2, '0')}`
                                    : order.shortOrderId}
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    {order.shortOrderId}
                                  </span>
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {formatMoney(order.total)}
                                </span>
                              </div>

                              <div className="mt-1.5">
                                <OrderStatusBadges order={order} />
                              </div>

                              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                                {order.items.map((it, idx) => (
                                  <li key={`${order.id}-${idx}`}>
                                    {it.quantity}× {it.name}
                                  </li>
                                ))}
                              </ul>

                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  className="flex-1"
                                  disabled={anyBusy || orderBusy}
                                  onClick={() => setCancelOrder(order)}
                                >
                                  {busyOrderId === order.id ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  <X className="mr-1.5 h-3.5 w-3.5" />
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1"
                                  disabled={
                                    anyBusy || orderBusy || order.kitchenSent
                                  }
                                  onClick={() => openKitchenDialog(order)}
                                >
                                  <ChefHat className="mr-1.5 h-3.5 w-3.5" />
                                  {order.kitchenSent
                                    ? 'In kitchen'
                                    : 'Send to kitchen'}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="mt-3 space-y-1.5">
                        {card.totalDue > 0 ? (
                          <>
                            {card.kitchenPendingCount > 0 ? (
                              <p className="text-center text-xs text-amber-700 dark:text-amber-300">
                                Send all tickets to kitchen before paying (
                                {card.kitchenPendingCount} held).
                              </p>
                            ) : null}
                            <Button
                              type="button"
                              className="w-full"
                              disabled={anyBusy || card.kitchenPendingCount > 0}
                              onClick={() => openPay(card)}
                            >
                              Pay table · {formatMoney(card.totalDue)}
                            </Button>
                          </>
                        ) : card.kitchenPendingCount > 0 ? (
                          <p className="text-center text-xs text-muted-foreground">
                            All tickets paid — send {card.kitchenPendingCount}{' '}
                            to kitchen when ready.
                          </p>
                        ) : null}
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
              onClick={() => void refresh()}
            >
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay table {payCard?.tableLabel ?? ''}</DialogTitle>
          </DialogHeader>
          {payCard ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Open tab ({payCard.orderCount} ticket
                  {payCard.orderCount === 1 ? '' : 's'})
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(payCard.totalDue)}
                </span>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Cash paid
                </label>
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
                  {formatMoney(payChange)}
                </span>
              </div>
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
