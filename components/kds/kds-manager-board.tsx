'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  ExternalLink,
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
import { OrderCustomerExtras } from '@/components/order/order-customer-extras';
import { kdsFetchErrorMessage } from '@/lib/kds-api-errors';
import {
  buildKitchenTicketItemRows,
  parseKitchenTicketItemDisplay,
} from '@/lib/kitchen-ticket-items';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { isPendingPaymentStatus } from '@/lib/sales-order-status';
import { FeatureDisabledScreen } from '@/components/common/feature-disabled-screen';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/lib/i18n/client';

type PendingOrder = {
  id: string;
  /** Daily token number (resets per restaurant per day). */
  ticketNumber: number | null;
  /** 6-char public-facing tracking id. */
  shortOrderId: string | null;
  status: string;
  total: number;
  sourceType: string;
  cutleryRequested: boolean;
  customerComment: string | null;
  orderScheduleMode: string | null;
  orderScheduleSlot: string | null;
  orderScheduleAt: string | null;
  createdAt: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  customer: { name: string } | null;
  items: {
    id: string;
    quantity: number;
    productName?: string | null;
    menuItem: { name: string } | null;
    modifiers: {
      name: string;
      quantity: number;
      menuItemId?: string | null;
      groupName?: string | null;
    }[];
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

function getLocalizedName(val: string, lang: string) {
  try {
    const obj = JSON.parse(val);
    if (typeof obj === 'object' && obj !== null) {
      return obj[lang] || obj.en || Object.values(obj)[0] || val;
    }
    return val;
  } catch {
    return val;
  }
}

const MIN_CUSTOM_MINUTES = 1;
const MAX_CUSTOM_MINUTES = 240;

export function KdsManagerBoard() {
  const { t } = useTranslation();
  const { formatMoney } = useOwnerRestaurantRegional();
  const { settings: fulfillmentSettings, loading: settingsLoading } =
    useRestaurantFulfillmentSettings();
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
      toast.error(t('kds.errorLoadPendingOrders'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
    }
  }, []);

  useRealtimeRefresh('realtime:kds.manager', () => void load());

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
    const order = orders.find((o) => o.id === orderId);
    if (order && isPendingPaymentStatus(order.paymentStatus)) {
      toast.warn(t('kds.paymentPendingWarning'));
      return false;
    }
    const minutes = resolveMinutesForOrder(orderId);
    if (minutes === null) {
      toast.warn(
        t('kds.invalidPrepTime', {
          min: MIN_CUSTOM_MINUTES,
          max: MAX_CUSTOM_MINUTES,
        })
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
      toast.success(t('kds.orderSentToKitchen'));
      await load();
      return true;
    } catch {
      toast.error(t('kds.errorProceedOrder'));
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
      toast.success(t('kds.orderCanceled'));
      await load();
      return true;
    } catch {
      toast.error(t('kds.errorCancelOrder'));
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

  if (!settingsLoading && !fulfillmentSettings.kdsEnabled) {
    return <FeatureDisabledScreen feature="kds" homeUrl="/dashboard" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{t('kds.managerTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('kds.managerSubtitle', { time: lastUpdatedText })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void load()}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button asChild variant="default">
            <Link href="/kds-screen" target="_blank">
              {t('kds.openKdsScreen')}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <Loader2 className="animate-spin text-primary text-center mx-auto" />
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {t('kds.noPendingOrders')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const paymentPending = isPendingPaymentStatus(o.paymentStatus);
            return (
              <Card key={o.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {t('kds.token')}
                        </span>
                        <span className="font-mono text-2xl font-extrabold leading-none tabular-nums">
                          {tokenLabel(o)}
                        </span>
                      </div>
                      <span className="hidden h-5 w-px bg-border sm:inline-block" />
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {t('kds.tracking')}
                        </span>
                        <span className="font-mono text-sm font-semibold uppercase tracking-wider">
                          {trackingLabel(o)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {paymentPending ? (
                        <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300">
                          {t('kds.paymentPending')}
                          {o.paymentMethod ? ` · ${o.paymentMethod}` : ''}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary">{o.sourceType}</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        {o.customer?.name || t('kds.walkIn')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString()}
                      </p>
                      {o.orderScheduleMode === 'later' && o.orderScheduleAt ? (
                        <p className="text-xs font-medium text-primary">
                          {t('kds.scheduledFor', {
                            time: new Date(o.orderScheduleAt).toLocaleString(),
                          })}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-primary">
                          {t('kds.asap')}
                        </p>
                      )}

                      <div className="space-y-1">
                        {buildKitchenTicketItemRows(
                          o.items.map((it) => ({
                            quantity: it.quantity,
                            productName: it.productName,
                            menuItem: it.menuItem,
                            modifiers: (it.modifiers ?? []).map((m) => ({
                              name: m.name,
                              quantity: m.quantity,
                              menuItemId: m.menuItemId,
                              groupName: m.groupName,
                            })),
                          }))
                        ).map((row, idx) => {
                          const parsed = parseKitchenTicketItemDisplay(
                            row.productName,
                            row.quantity
                          );
                          const lang =
                            typeof i18n !== 'undefined' ? i18n.language : 'en';
                          const name = getLocalizedName(parsed.name, lang);
                          if (parsed.kind === 'branch') {
                            return (
                              <p
                                key={`${o.id}-k-${idx}`}
                                className="text-xs font-medium text-muted-foreground"
                              >
                                ↳ {name}
                              </p>
                            );
                          }
                          if (
                            parsed.kind === 'nested' ||
                            parsed.kind === 'addon'
                          ) {
                            return (
                              <p
                                key={`${o.id}-k-${idx}`}
                                className="pl-3 text-xs text-muted-foreground"
                              >
                                + {name}
                              </p>
                            );
                          }
                          if (parsed.kind === 'personalize') {
                            return (
                              <p
                                key={`${o.id}-k-${idx}`}
                                className="pl-3 text-xs italic text-amber-600 dark:text-amber-500"
                              >
                                • {name}
                              </p>
                            );
                          }
                          return (
                            <p
                              key={`${o.id}-k-${idx}`}
                              className="text-xs leading-snug"
                            >
                              <span className="font-semibold tabular-nums">
                                {parsed.quantity}×
                              </span>{' '}
                              {name}
                            </p>
                          );
                        })}
                      </div>
                      <p className="text-xs font-semibold">
                        {formatMoney(o.total)}
                      </p>
                    </div>

                    <div className="flex w-full justify-between flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                      <div className="flex flex-col justify-between">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {t('kds.selectTime')}
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
                            {t('kds.customMinutes')}
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

                      {paymentPending ? (
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                          {t('kds.collectPaymentFirst')}
                        </p>
                      ) : null}

                      {o.orderScheduleMode === 'later' && o.orderScheduleAt ? (
                        <p className="text-xs text-muted-foreground">
                          {t('kds.scheduledKitchenNote', {
                            time: new Date(o.orderScheduleAt).toLocaleString(),
                          })}
                        </p>
                      ) : null}

                      <div className='flex flex-col gap-2'>
                        <OrderCustomerExtras
                          cutleryRequested={o.cutleryRequested}
                          customerComment={o.customerComment}
                          compact
                        />

<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                                {t('kds.canceling')}
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-2 h-5 w-5" />{' '}
                              <span className="text-sm font-medium">
                                {t('kds.cancelOrder')}
                              </span>
                            </>
                          )}
                        </Button>
                        <Button
                          className="w-full"
                          type="button"
                          disabled={
                            paymentPending ||
                            (activeSubmitCount > 0 &&
                              activeSubmittingOrderId !== o.id) ||
                            (activeSubmittingOrderId !== null &&
                              activeSubmittingOrderId === o.id) ||
                            (activeCancelCount > 0 &&
                              activeCancelOrderId === o.id)
                          }
                          onClick={() => {
                            if (paymentPending) {
                              toast.warn(t('kds.paymentPendingWarning'));
                              return;
                            }
                            const minutes = resolveMinutesForOrder(o.id);
                            if (minutes === null) {
                              toast.warn(
                                t('kds.invalidPrepTime', {
                                  min: MIN_CUSTOM_MINUTES,
                                  max: MAX_CUSTOM_MINUTES,
                                })
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
                                {t('kds.proceeding')}
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-5 w-5" />{' '}
                              <span className="text-sm font-medium">
                                {t('kds.proceed')}
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                      </div>
                     
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <KdsOrderActionDialog
        open={pendingAction !== null}
        kind={pendingAction?.kind ?? 'proceed'}
        itemName={pendingAction?.label}
        detail={
          pendingAction?.kind === 'proceed' && pendingAction.minutes != null
            ? t('kds.prepTimeDetail', { minutes: pendingAction.minutes })
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
