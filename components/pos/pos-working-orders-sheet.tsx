'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Globe,
  Loader2,
  Monitor,
  Package,
  RefreshCw,
  Search,
  Store,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import {
  usePosWorkingOrders,
  type PosWorkingOrderRow,
} from '@/hooks/use-pos-working-orders';
import { apiErrorMessage } from '@/lib/api-error-message';
import eventBus from '@/lib/even';
import { cn } from '@/lib/utils';
import { salesOrderMethodLabel } from '@/lib/order-fulfillment';

export type { PosWorkingOrderRow };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  onOrderCountChange?: (count: number) => void;
};

function formatElapsedTime(isoString: string): string {
  try {
    const elapsedSec = Math.floor(
      (Date.now() - new Date(isoString).getTime()) / 1000
    );
    if (elapsedSec < 60) return `${Math.max(1, elapsedSec)}s ago`;
    const mins = Math.floor(elapsedSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m ago`;
  } catch {
    return '';
  }
}

function channelMeta(sourceType: string): {
  label: string;
  icon: typeof Globe;
  badgeClass: string;
} {
  const norm = String(sourceType ?? '').toUpperCase();
  if (norm === 'ONLINE') {
    return {
      label: 'Online Store',
      icon: Globe,
      badgeClass:
        'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    };
  }
  if (norm === 'KIOSK') {
    return {
      label: 'Kiosk',
      icon: Monitor,
      badgeClass:
        'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    };
  }
  return {
    label: 'POS',
    icon: Store,
    badgeClass:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  };
}

export function PosWorkingOrdersSheet({
  open,
  onOpenChange,
  branchId,
  onOrderCountChange,
}: Props) {
  const { formatMoney } = useOwnerRestaurantRegional();
  const {
    orders,
    count,
    loading,
    refreshing,
    refresh,
    removeOrder,
    confirmInBackground,
  } = usePosWorkingOrders(branchId);

  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'ONLINE' | 'KIOSK' | 'POS'>('ALL');

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PosWorkingOrderRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    onOrderCountChange?.(count);
  }, [count, onOrderCountChange]);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const handleCompleteOrder = async (order: PosWorkingOrderRow) => {
    setCompletingId(order.id);
    try {
      await axios.post(`/api/restaurant/pos-order/${encodeURIComponent(order.id)}/complete`);
      const token = order.ticketNumber ? `#${order.ticketNumber}` : (order.shortOrderId ?? order.id.slice(0, 6));
      toast.success(`Order ${token} marked as completed.`);
      removeOrder(order.id);
      confirmInBackground();
      window.setTimeout(() => {
        eventBus.emit('refreshSalesOrders');
        eventBus.emit('refreshRecentOrders');
        eventBus.emit('refreshWorkingOrders');
        eventBus.emit('refreshCompletedOrders');
        eventBus.emit('refreshTableOrders');
        eventBus.emit('refreshKioskOrders');
      }, 0);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not complete order.'));
      refresh();
    } finally {
      setCompletingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    setCancelling(true);
    try {
      await axios.patch(`/api/restaurant/pos-order/${encodeURIComponent(target.id)}/cancel`);
      const token = target.ticketNumber
        ? `#${target.ticketNumber}`
        : (target.shortOrderId ?? target.id.slice(0, 6));
      toast.success(`Order ${token} has been canceled.`);
      removeOrder(target.id);
      setCancelTarget(null);
      confirmInBackground();
      window.setTimeout(() => {
        eventBus.emit('refreshSalesOrders');
        eventBus.emit('refreshRecentOrders');
        eventBus.emit('refreshWorkingOrders');
        eventBus.emit('refreshCompletedOrders');
        eventBus.emit('refreshTableOrders');
        eventBus.emit('refreshKioskOrders');
      }, 0);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not cancel order.'));
      setCancelTarget(null);
      refresh();
    } finally {
      setCancelling(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (channelFilter !== 'ALL') {
        const src = String(o.sourceType ?? '').toUpperCase();
        if (src !== channelFilter) return false;
      }
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const token = String(o.ticketNumber ?? '');
      const shortId = (o.shortOrderId ?? '').toLowerCase();
      const name = (o.customer?.name ?? '').toLowerCase();
      const phone = (o.customer?.phone ?? '').toLowerCase();
      const table = (o.tableLabel ?? '').toLowerCase();
      return (
        token.includes(q) ||
        shortId.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        table.includes(q)
      );
    });
  }, [orders, channelFilter, search]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl"
        >
          {/* Header */}
          <SheetHeader className="border-b border-border p-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fire-500/10 text-fire-600 dark:text-fire-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-lg font-bold">
                      Working Orders
                    </SheetTitle>
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-fire-500 text-white font-bold px-2 py-0.5 text-xs"
                    >
                      {orders.length}
                    </Badge>
                  </div>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Active incoming orders across Online, Kiosk, and POS
                  </SheetDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={loading || refreshing}
                onClick={() => refresh()}
                className="h-8 w-8 shrink-0 rounded-lg"
              >
                <RefreshCw
                  className={cn('h-4 w-4', loading || refreshing ? 'animate-spin' : '')}
                />
              </Button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search ticket #, order ID, customer…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 overflow-x-auto">
                {(['ALL', 'ONLINE', 'KIOSK', 'POS'] as const).map((ch) => (
                  <Button
                    key={ch}
                    type="button"
                    variant={channelFilter === ch ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setChannelFilter(ch)}
                    className={cn(
                      'h-7 rounded-lg px-2.5 text-xs font-medium',
                      channelFilter === ch && 'bg-fire-500 hover:bg-fire-600'
                    )}
                  >
                    {ch === 'ALL' ? 'All' : ch === 'ONLINE' ? 'Online' : ch === 'KIOSK' ? 'Kiosk' : 'POS'}
                  </Button>
                ))}
              </div>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
            {loading && orders.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border p-4 space-y-3"
                  >
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center">
                <Package className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {search ? 'No matching working orders' : 'No active working orders'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {search
                    ? 'Try adjusting your search or channel filter.'
                    : 'New online, kiosk, or in-progress POS orders will appear here in real time.'}
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const ch = channelMeta(order.sourceType);
                const ChannelIcon = ch.icon;
                const tokenDisplay =
                  typeof order.ticketNumber === 'number'
                    ? `#${order.ticketNumber}`
                    : (order.shortOrderId ?? order.id.slice(0, 6)).toUpperCase();
                const elapsed = formatElapsedTime(order.createdAt);
                const methodLabel = salesOrderMethodLabel({
                  address: order.address,
                  sourceType: order.sourceType,
                  tableLabel: order.tableLabel,
                });

                const isCompleting = completingId === order.id;

                return (
                  <div
                    key={order.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-fire-500/30 hover:shadow-md"
                  >
                    {/* Card Top Header */}
                    <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black tracking-tight text-fire-600 dark:text-fire-400">
                          {tokenDisplay}
                        </span>
                        {order.shortOrderId && order.shortOrderId !== tokenDisplay.replace('#', '') ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            ({order.shortOrderId})
                          </span>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            'flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border',
                            ch.badgeClass
                          )}
                        >
                          <ChannelIcon className="h-3 w-3" />
                          <span>{ch.label}</span>
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{elapsed}</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 space-y-3">
                      {/* Customer / Location / Schedule */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {order.customer?.name ? (
                          <div className="flex items-center gap-1 font-medium text-foreground">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{order.customer.name}</span>
                          </div>
                        ) : null}

                        {order.customer?.phone && order.customer.phone !== 'N/A' ? (
                          <span>Tel: {order.customer.phone}</span>
                        ) : null}

                        {order.tableLabel ? (
                          <div className="flex items-center gap-1 font-medium text-fire-600 dark:text-fire-400">
                            <UtensilsCrossed className="h-3.5 w-3.5" />
                            <span>Table {order.tableLabel}</span>
                          </div>
                        ) : methodLabel ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {methodLabel}
                          </Badge>
                        ) : null}

                        {order.orderScheduleSlot ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Slot: {order.orderScheduleSlot}
                          </span>
                        ) : null}
                      </div>

                      {/* Items list */}
                      <div className="space-y-1.5 rounded-xl bg-muted/20 p-2.5">
                        {order.items.map((item, idx) => {
                          const itemName =
                            item.productName || item.menuItem?.name || 'Item';
                          return (
                            <div
                              key={item.id || idx}
                              className="text-xs leading-tight"
                            >
                              <div className="flex items-start justify-between font-medium">
                                <span className="text-foreground">
                                  <span className="font-bold text-fire-600 dark:text-fire-400">
                                    {item.quantity}&times;
                                  </span>{' '}
                                  {itemName}
                                </span>
                              </div>
                              {item.modifiers && item.modifiers.length > 0 ? (
                                <div className="pl-4 text-[11px] text-muted-foreground">
                                  {item.modifiers
                                    .map((m) =>
                                       m.quantity > 1
                                        ? `${m.quantity}× ${m.name}`
                                        : m.name
                                    )
                                    .join(', ')}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {/* Comment / Note */}
                      {order.customerComment ? (
                        <p className="rounded-lg bg-amber-500/10 p-2 text-xs italic text-amber-800 dark:text-amber-300">
                          &ldquo;{order.customerComment}&rdquo;
                        </p>
                      ) : null}

                      {/* Total and Payment */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Total:
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {formatMoney(order.total)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              order.paymentStatus === 'completed' || order.paymentStatus === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            )}
                          >
                            {order.paymentStatus === 'completed' || order.paymentStatus === 'paid'
                              ? 'Paid'
                              : 'Pending Pay'}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions Footer: Complete & Cancel */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Button
                          type="button"
                          variant="default"
                          disabled={isCompleting}
                          onClick={() => void handleCompleteOrder(order)}
                          className="flex-1 rounded-xl bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                          {isCompleting ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              <span>Completing…</span>
                            </>
                          ) : (
                            <>
                              <Check className="mr-1.5 h-4 w-4" />
                              <span>Complete</span>
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isCompleting}
                          onClick={() => setCancelTarget(order)}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Cancel Order</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to cancel order{' '}
              <strong className="text-foreground">
                {cancelTarget?.ticketNumber
                  ? `#${cancelTarget.ticketNumber}`
                  : cancelTarget?.shortOrderId ?? cancelTarget?.id.slice(0, 6)}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              onClick={() => setCancelTarget(null)}
            >
              Keep Order
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void handleConfirmCancel()}
            >
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Canceling…
                </>
              ) : (
                'Yes, Cancel Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
