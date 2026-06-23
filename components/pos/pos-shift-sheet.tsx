'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Banknote, Loader2, Printer, Receipt } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { PosShiftPayload, PosShiftSummary } from '@/lib/pos-shift';
import { printPosShiftRecord } from '@/lib/pos-shift-print';
import { apiErrorMessage } from '@/lib/api-error-message';
import { isCanceledOrderStatus } from '@/lib/sales-order-status';
import { cn } from '@/lib/utils';

function formatMoney(n: number) {
  return n.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}€${formatMoney(Math.abs(n))}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  brandName?: string;
  branchName?: string | null;
  logoUrl?: string | null;
  onShiftUpdated?: (shift: PosShiftPayload | null) => void;
  onShiftClosed?: (summary: Pick<
    PosShiftSummary,
    'lastClosingCashInLocker' | 'lastShiftEndedAt'
  >) => void;
};

export function PosShiftSheet({
  open,
  onOpenChange,
  branchId,
  brandName = 'Restaurant',
  branchName,
  logoUrl,
  onShiftUpdated,
  onShiftClosed,
}: Props) {
  const [shift, setShift] = useState<PosShiftPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [cashInLocker, setCashInLocker] = useState('');
  const onShiftUpdatedRef = useRef(onShiftUpdated);
  const onShiftClosedRef = useRef(onShiftClosed);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    onShiftUpdatedRef.current = onShiftUpdated;
    onShiftClosedRef.current = onShiftClosed;
  }, [onShiftUpdated, onShiftClosed]);

  const cashLeftInLocker = useMemo(() => {
    const raw = cashInLocker.trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }, [cashInLocker]);

  const cashDifference = useMemo(() => {
    if (!shift || cashLeftInLocker == null) return null;
    return cashLeftInLocker - shift.expectedCashInLocker;
  }, [shift, cashLeftInLocker]);

  const loadShift = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const res = await axios.get<{ data: PosShiftPayload }>(
        '/api/restaurant/pos-shift',
        {
          params: branchId ? { branchId } : undefined,
        }
      );
      if (requestId !== loadRequestRef.current) return;
      setShift(res.data.data);
      onShiftUpdatedRef.current?.(res.data.data);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setShift(null);
      onShiftUpdatedRef.current?.(null);
      toast.error(apiErrorMessage(error, 'Could not load shift.'));
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [branchId]);

  useEffect(() => {
    if (!open) return;
    void loadShift();
  }, [open, branchId, loadShift]);

  useEffect(() => {
    if (!open) setCashInLocker('');
  }, [open]);

  const handlePrint = () => {
    if (!shift) return;
    const ok = printPosShiftRecord({
      shift,
      cashLeftInLocker,
      brandName,
      branchName,
      logoUrl,
    });
    if (!ok) {
      toast.error('Could not open print preview.');
    }
  };

  const endShift = async () => {
    if (!shift || ending) return;
    if (cashLeftInLocker == null) {
      toast.warn('Enter the cash left in the money locker for this shift.');
      return;
    }

    setEnding(true);
    try {
      const res = await axios.post<{
        data: { closedShift: PosShiftPayload; nextShift: PosShiftPayload | null };
      }>('/api/restaurant/pos-shift', {
        shiftId: shift.id,
        closingCashInLocker: cashLeftInLocker,
        branchId: branchId || undefined,
      });
      const { closedShift, nextShift } = res.data.data;
      toast.success('Shift ended. A new shift has started.');
      setCashInLocker('');
      setShift(nextShift);
      onShiftUpdatedRef.current?.(nextShift);
      if (
        closedShift.closingCashInLocker != null &&
        closedShift.endedAt
      ) {
        onShiftClosedRef.current?.({
          lastClosingCashInLocker: closedShift.closingCashInLocker,
          lastShiftEndedAt: closedShift.endedAt,
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not end shift.'));
    } finally {
      setEnding(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
          <SheetTitle>End shift</SheetTitle>
          <SheetDescription>
            Review this shift&apos;s orders, then enter the cash you leave in
            the locker when ending your shift.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : shift ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
              <div className="grid shrink-0 grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="font-medium">
                    {new Date(shift.startedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Opened by</p>
                  <p className="font-medium">{shift.openedByName ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed orders</p>
                  <p className="font-semibold tabular-nums">{shift.orderCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total sales</p>
                  <p className="font-semibold tabular-nums">
                    €{formatMoney(shift.totalSales)}
                  </p>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                  <Receipt className="h-4 w-4" />
                  Shift orders ({shift.orders.length})
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border">
                  {shift.orders.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No orders in this shift yet.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {shift.orders.map((order) => {
                        const canceled = isCanceledOrderStatus(order.status);
                        return (
                        <li
                          key={order.id}
                          className={cn(
                            'flex items-start justify-between gap-3 px-4 py-3 text-sm',
                            canceled && 'bg-muted/30'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={cn(
                                  'font-medium',
                                  canceled && 'text-muted-foreground line-through'
                                )}
                              >
                                {order.ticketNumber != null
                                  ? `Ticket #${String(order.ticketNumber).padStart(2, '0')}`
                                  : order.shortOrderId}
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
                              {new Date(order.createdAt).toLocaleString()}
                              {order.paymentMethod
                                ? ` · ${order.paymentMethod}`
                                : ''}
                              {order.customerName
                                ? ` · ${order.customerName}`
                                : ''}
                            </p>
                          </div>
                          <p
                            className={cn(
                              'shrink-0 font-semibold tabular-nums',
                              canceled && 'text-muted-foreground line-through'
                            )}
                          >
                            €{formatMoney(order.total)}
                          </p>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="shrink-0 space-y-3 rounded-xl border bg-background p-4 text-sm">
                <p className="text-sm font-semibold">Cash reconciliation</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Previous cash left</span>
                    <span className="font-medium tabular-nums">
                      {shift.previousClosingCashInLocker != null
                        ? `€${formatMoney(shift.previousClosingCashInLocker)}`
                        : '—'}
                    </span>
                  </div>
                  {shift.previousShiftEndedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last shift ended{' '}
                      {new Date(shift.previousShiftEndedAt).toLocaleString()}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Cash sales (shift)</span>
                    <span className="font-medium tabular-nums">
                      €{formatMoney(shift.cashSalesTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Card / other sales</span>
                    <span className="font-medium tabular-nums">
                      €{formatMoney(shift.nonCashSalesTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-2 font-semibold">
                    <span>Expected in locker</span>
                    <span className="tabular-nums">
                      €{formatMoney(shift.expectedCashInLocker)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="pos-shift-cash-locker">
                    Cash left in money locker
                  </Label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="pos-shift-cash-locker"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-9"
                      value={cashInLocker}
                      onChange={(e) => setCashInLocker(e.target.value)}
                      disabled={ending}
                    />
                  </div>
                  {cashLeftInLocker != null ? (
                    <div
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                        cashDifference != null && cashDifference < 0
                          ? 'border-red-500/30 bg-red-500/5'
                          : cashDifference != null && cashDifference > 0
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-muted bg-muted/20'
                      )}
                    >
                      <span className="font-medium">Difference</span>
                      <span className="font-semibold tabular-nums">
                        {cashDifference != null
                          ? formatSignedMoney(cashDifference)
                          : '—'}
                      </span>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Total cash you leave in the locker for the next shift.
                    Difference compares this to expected (previous cash left +
                    cash sales).
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t bg-background px-6 py-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={ending}
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  disabled={ending || cashLeftInLocker == null}
                  onClick={() => void endShift()}
                >
                  {ending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  End shift
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="text-sm text-muted-foreground">
              No active shift could be loaded.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export async function fetchPosShiftSummary(
  branchId: string | null
): Promise<PosShiftSummary> {
  const res = await axios.get<{ data: PosShiftSummary }>(
    '/api/restaurant/pos-shift',
    {
      params: {
        ...(branchId ? { branchId } : {}),
        summary: '1',
      },
    }
  );
  return res.data.data;
}
