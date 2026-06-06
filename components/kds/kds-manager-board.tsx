'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'react-toastify';

import {
  KdsOrderActionDialog,
  type KdsOrderActionKind,
} from '@/components/kds/kds-order-action-dialog';
import { kdsFetchErrorMessage } from '@/lib/kds-api-errors';

type PendingOrder = {
  id: string;
  /** Daily token number (resets per restaurant per day). */
  ticketNumber: number | null;
  /** 6-char public-facing tracking id. */
  shortOrderId: string | null;
  status: string;
  total: number;
  sourceType: string;
  createdAt: string;
  customer: { name: string } | null;
  items: {
    id: string;
    quantity: number;
    menuItem: { name: string };
    modifiers: { name: string; quantity: number }[];
  }[];
};

function tokenLabel(o: {
  ticketNumber: number | null;
  shortOrderId: string | null;
  id: string;
}): string {
  if (typeof o.ticketNumber === 'number' && o.ticketNumber >= 0) {
    return String(o.ticketNumber).padStart(2, '0');
  }
  // Fallback for legacy orders without a token: use the short id so the
  // staff still has a recognisable identifier to call out.
  return (o.shortOrderId ?? o.id.slice(0, 6)).toUpperCase();
}

function trackingLabel(o: { shortOrderId: string | null; id: string }): string {
  return (o.shortOrderId ?? o.id.slice(0, 6)).toUpperCase();
}

function normalizeLineName(rawName: string, rawQty: number) {
  const trimmed = String(rawName || '').trim();
  const trailingQty = trimmed.match(/^(.*)\s+x(\d+)$/i);
  if (!trailingQty) {
    return { name: trimmed, quantity: rawQty };
  }

  const parsed = Number(trailingQty[2]);
  const safeParsed = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const baseName = trailingQty[1].trim();
  const effectiveQty = rawQty > 1 ? rawQty * safeParsed : safeParsed;
  return {
    name: baseName || trimmed,
    quantity: effectiveQty,
  };
}

function fmt(v: number) {
  return v.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MIN_CUSTOM_MINUTES = 1;
const MAX_CUSTOM_MINUTES = 240;
/** Matches KDS kitchen screen polling interval. */
const REFRESH_INTERVAL_MS = 5000;

export function KdsManagerBoard() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  /** Resolved prep minutes per order (from presets or custom input). */
  const [prepMinutes, setPrepMinutes] = useState<Record<string, number>>({});
  /** Raw text for the optional custom minutes field per order. */
  const [customMinutesText, setCustomMinutesText] = useState<
    Record<string, string>
  >({});
  const [activeSubmittingOrderId, setActiveSubmittingOrderId] = useState<
    string | null
  >(null);
  const [activeSubmitCount, setActiveSubmitCount] = useState(0);
  const [activeCancelOrderId, setActiveCancelOrderId] = useState<string | null>(
    null
  );
  const [activeCancelCount, setActiveCancelCount] = useState(0);
  const [pendingAction, setPendingAction] = useState<{
    kind: KdsOrderActionKind;
    orderId: string;
    label: string;
    minutes?: number;
  } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/restaurant/kds/manager-orders', {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) {
        toast.error(await kdsFetchErrorMessage(res, 'load'));
        setOrders([]);
        return;
      }
      const json = (await res.json()) as { data?: PendingOrder[] };
      setOrders(json.data ?? []);
    } catch {
      setOrders([]);
      toast.error('Could not load pending orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onBranch = () => void load();
    window.addEventListener('branch-changed', onBranch);
    return () => window.removeEventListener('branch-changed', onBranch);
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return '—';
    return lastUpdated.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [lastUpdated]);

  function resolveMinutesForOrder(orderId: string): number | null {
    const raw = customMinutesText[orderId]?.trim();
    if (raw) {
      const n = Math.round(Number(raw));
      if (
        Number.isFinite(n) &&
        n >= MIN_CUSTOM_MINUTES &&
        n <= MAX_CUSTOM_MINUTES
      ) {
        return n;
      }
      return null;
    }
    const fallback = prepMinutes[orderId] ?? 10;
    if (fallback >= MIN_CUSTOM_MINUTES && fallback <= MAX_CUSTOM_MINUTES) {
      return fallback;
    }
    return null;
  }

  async function proceed(orderId: string): Promise<boolean> {
    const minutes = resolveMinutesForOrder(orderId);
    if (minutes === null) {
      toast.warn(
        `Enter a valid prep time (${MIN_CUSTOM_MINUTES}–${MAX_CUSTOM_MINUTES} minutes), or use a preset.`
      );
      return false;
    }
    setActiveSubmitCount((prev) => prev + 1);
    setActiveSubmittingOrderId(orderId);
    try {
      const res = await fetch('/api/restaurant/kds/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          selectedMinutes: minutes,
        }),
      });
      if (!res.ok) {
        toast.error(await kdsFetchErrorMessage(res, 'proceed'));
        return false;
      }
      toast.success('Order sent to kitchen');
      await load();
      return true;
    } catch {
      toast.error('Could not proceed order.');
      return false;
    } finally {
      setActiveSubmitCount((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setActiveSubmittingOrderId(null);
        }
        return next;
      });
    }
  }

  async function cancelOrder(orderId: string): Promise<boolean> {
    setActiveCancelCount((prev) => prev + 1);
    setActiveCancelOrderId(orderId);
    try {
      const res = await fetch(
        `/api/restaurant/kds/manager-orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
        }
      );
      if (!res.ok) {
        toast.error(await kdsFetchErrorMessage(res, 'cancel'));
        return false;
      }
      toast.success('Order canceled');
      await load();
      return true;
    } catch {
      toast.error('Could not cancel order.');
      return false;
    } finally {
      setActiveCancelCount((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setActiveCancelOrderId(null);
        }
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">KDS Manager</h1>
          <p className="text-sm text-muted-foreground">
            Choose a preset or enter custom minutes, then proceed the order to
            making. Live · refreshes every {REFRESH_INTERVAL_MS / 1000}s · last
            sync {lastUpdatedText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="default">
            <Link href="/kds-screen" target="_blank">
              Open KDS Screen
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Loader2 className="animate-spin text-primary text-center mx-auto" />
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No pending orders.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Token
                      </span>
                      <span className="font-mono text-2xl font-extrabold leading-none tabular-nums">
                        {tokenLabel(o)}
                      </span>
                    </div>
                    <span className="hidden h-5 w-px bg-border sm:inline-block" />
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Tracking
                      </span>
                      <span className="font-mono text-sm font-semibold uppercase tracking-wider">
                        {trackingLabel(o)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary">{o.sourceType}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      {o.customer?.name || 'Walk-in'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString()}
                    </p>
                    <div className="space-y-1">
                      {o.items.map((it) => {
                        const base = normalizeLineName(
                          it.menuItem.name,
                          it.quantity
                        );
                        return (
                          <div key={it.id} className="text-xs leading-snug">
                            <p>
                              <span className="font-semibold tabular-nums">
                                {base.quantity}×
                              </span>{' '}
                              {base.name}
                            </p>
                            {it.modifiers?.map((m, idx) => {
                              const mod = normalizeLineName(m.name, m.quantity);
                              return (
                                <p
                                  key={`${it.id}-m-${idx}`}
                                  className="pl-4 text-muted-foreground"
                                >
                                  <span className="font-semibold tabular-nums">
                                    {mod.quantity}×
                                  </span>{' '}
                                  {mod.name}
                                </p>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs font-semibold">€{fmt(o.total)}</p>
                  </div>

                  <div className="flex w-full justify-between flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-col justify-between">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Select time:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[10, 15, 30].map((m) => (
                            <Button
                              key={m}
                              type="button"
                              variant={
                                (prepMinutes[o.id] ?? 10) === m
                                  ? 'default'
                                  : 'outline'
                              }
                              onClick={() => {
                                setPrepMinutes((prev) => ({
                                  ...prev,
                                  [o.id]: m,
                                }));
                                setCustomMinutesText((prev) => {
                                  const next = { ...prev };
                                  delete next[o.id];
                                  return next;
                                });
                              }}
                            >
                              {m}m
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`kds-custom-min-${o.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Custom (minutes)
                        </label>
                        <Input
                          id={`kds-custom-min-${o.id}`}
                          className="h-9"
                          inputMode="numeric"
                          placeholder={`${MIN_CUSTOM_MINUTES}–${MAX_CUSTOM_MINUTES}`}
                          value={customMinutesText[o.id] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCustomMinutesText((prev) => ({
                              ...prev,
                              [o.id]: v,
                            }));
                            const n = Math.round(Number(v));
                            if (
                              v.trim() !== '' &&
                              Number.isFinite(n) &&
                              n >= MIN_CUSTOM_MINUTES &&
                              n <= MAX_CUSTOM_MINUTES
                            ) {
                              setPrepMinutes((prev) => ({
                                ...prev,
                                [o.id]: n,
                              }));
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        className="w-full"
                        type="button"
                        disabled={
                          (activeSubmitCount > 0 &&
                            activeSubmittingOrderId !== o.id) ||
                          (activeSubmittingOrderId !== null &&
                            activeSubmittingOrderId === o.id) ||
                          (activeCancelCount > 0 &&
                            activeCancelOrderId === o.id)
                        }
                        onClick={() => {
                          const minutes = resolveMinutesForOrder(o.id);
                          if (minutes === null) {
                            toast.warn(
                              `Enter a valid prep time (${MIN_CUSTOM_MINUTES}–${MAX_CUSTOM_MINUTES} minutes), or use a preset.`
                            );
                            return;
                          }
                          setPendingAction({
                            kind: 'proceed',
                            orderId: o.id,
                            label: tokenLabel(o),
                            minutes,
                          });
                        }}
                      >
                        {activeSubmitCount > 0 &&
                        activeSubmittingOrderId === o.id ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />{' '}
                            <span className="text-sm font-medium">
                              Proceeding...
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-5 w-5" />{' '}
                            <span className="text-sm font-medium">Proceed</span>
                          </>
                        )}
                      </Button>
                      <Button
                        className="w-full"
                        variant="destructive"
                        type="button"
                        disabled={
                          (activeCancelCount > 0 &&
                            activeCancelOrderId !== o.id) ||
                          (activeCancelOrderId !== null &&
                            activeCancelOrderId === o.id) ||
                          (activeSubmitCount > 0 &&
                            activeSubmittingOrderId === o.id)
                        }
                        onClick={() =>
                          setPendingAction({
                            kind: 'cancel',
                            orderId: o.id,
                            label: tokenLabel(o),
                          })
                        }
                      >
                        {activeCancelCount > 0 &&
                        activeCancelOrderId === o.id ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />{' '}
                            <span className="text-sm font-medium">
                              Canceling...
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-5 w-5" />{' '}
                            <span className="text-sm font-medium">
                              Cancel Order
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <KdsOrderActionDialog
        open={pendingAction !== null}
        kind={pendingAction?.kind ?? 'proceed'}
        itemName={pendingAction?.label}
        detail={
          pendingAction?.kind === 'proceed' && pendingAction.minutes != null
            ? `Prep time: ${pendingAction.minutes} minutes`
            : undefined
        }
        loading={
          pendingAction?.kind === 'proceed'
            ? activeSubmitCount > 0 &&
              activeSubmittingOrderId === pendingAction.orderId
            : pendingAction?.kind === 'cancel'
              ? activeCancelCount > 0 &&
                activeCancelOrderId === pendingAction.orderId
              : false
        }
        onCancel={() => setPendingAction(null)}
        iconConfirm={
          pendingAction?.kind === 'proceed' ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )
        }
        iconLoading={<Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        onConfirm={async () => {
          if (!pendingAction) return;
          const { kind, orderId } = pendingAction;
          const ok =
            kind === 'proceed'
              ? await proceed(orderId)
              : await cancelOrder(orderId);
          if (ok) setPendingAction(null);
        }}
      />
    </div>
  );
}
