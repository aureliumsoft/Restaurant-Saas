'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import { CreditCard, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type BillingDto = {
  plan: string | null;
  planName: string | null;
  priceLabel: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  paypalSubscriptionId: string | null;
  paypalStatus: string | null;
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    paidAt: string;
    periodEnd: string | null;
  }>;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function AutoRenewToggle({
  value,
  disabled,
  onChange,
  onLabel,
  offLabel,
  ariaLabel,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  onLabel: string;
  offLabel: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={cn(
          'min-w-[2rem] text-right text-xs font-semibold tabular-nums',
          value ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {value ? onLabel : offLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          value ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-background shadow transition-transform',
            value ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

export function RestaurantBillingCard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingAutoRenew, setSavingAutoRenew] = useState(false);
  const [billing, setBilling] = useState<BillingDto | null>(null);

  const loadBilling = useCallback(async (refresh = false) => {
    const res = await axios.get<{ data: BillingDto }>(
      `/api/restaurant/billing${refresh ? '?refresh=1' : ''}`
    );
    setBilling(res.data?.data ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadBilling();
      } catch {
        if (!cancelled) {
          toast.error(t('settings.cards.billing.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBilling, t]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadBilling(true);
      toast.success(t('settings.cards.billing.refreshed'));
    } catch {
      toast.error(t('settings.cards.billing.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAutoRenewChange(next: boolean) {
    if (!billing) return;
    const previous = billing.autoRenew;
    setBilling({ ...billing, autoRenew: next });
    setSavingAutoRenew(true);
    try {
      const res = await axios.patch<{
        data: { autoRenew: boolean; message?: string | null };
      }>('/api/restaurant/billing/auto-renew', { autoRenew: next });
      setBilling((prev) =>
        prev ? { ...prev, autoRenew: res.data.data.autoRenew } : prev
      );
      if (res.data.data.message) {
        toast.info(res.data.data.message);
      } else {
        toast.success(
          next
            ? t('settings.cards.billing.autoRenewEnabled')
            : t('settings.cards.billing.autoRenewDisabled')
        );
      }
    } catch {
      setBilling((prev) =>
        prev ? { ...prev, autoRenew: previous } : prev
      );
      toast.error(t('settings.cards.billing.autoRenewUpdateFailed'));
    } finally {
      setSavingAutoRenew(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const hasSubscription = Boolean(billing?.paypalSubscriptionId);
  const statusLabel = billing?.status ?? t('settings.cards.billing.statusNone');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" aria-hidden />
          {t('settings.cards.billing.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.cards.billing.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!hasSubscription ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
            {t('settings.cards.billing.noActiveSubscription')}{' '}
            <Link href="/pricing" className="font-medium text-primary underline">
              {t('settings.cards.billing.choosePlan')}
            </Link>{' '}
            {t('settings.cards.billing.subscribeSuffix')}
          </div>
        ) : (
          <>
            <dl className="grid gap-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t('settings.cards.billing.planLabel')}
                </dt>
                <dd className="font-medium">
                  {billing?.planName ?? billing?.plan ?? '—'}
                  {billing?.priceLabel ? ` · ${billing.priceLabel}` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t('settings.cards.billing.statusLabel')}
                </dt>
                <dd className="font-medium">{statusLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t('settings.cards.billing.periodEndsLabel')}
                </dt>
                <dd>{formatDate(billing?.currentPeriodEnd ?? null)}</dd>
              </div>
            </dl>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 px-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {t('settings.cards.billing.autoRenewLabel')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {billing?.autoRenew
                    ? t('settings.cards.billing.autoRenewOnHint')
                    : t('settings.cards.billing.autoRenewOffHint')}
                </p>
              </div>
              <AutoRenewToggle
                value={billing?.autoRenew ?? true}
                disabled={savingAutoRenew}
                onChange={handleAutoRenewChange}
                onLabel={t('settings.cards.billing.toggleOnLabel')}
                offLabel={t('settings.cards.billing.toggleOffLabel')}
                ariaLabel={t('settings.cards.billing.toggleAriaLabel')}
              />
            </div>

            {billing?.recentPayments?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('settings.cards.billing.recentPaymentsLabel')}
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {billing.recentPayments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>
                        {formatDate(p.paidAt)}
                        {p.periodEnd
                          ? ` · ${t('settings.cards.billing.untilDate', {
                              date: formatDate(p.periodEnd),
                            })}`
                          : ''}
                      </span>
                      <span>
                        {p.currency} {p.amount.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
      {hasSubscription ? (
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || savingAutoRenew}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            {t('settings.cards.billing.refreshButton')}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
