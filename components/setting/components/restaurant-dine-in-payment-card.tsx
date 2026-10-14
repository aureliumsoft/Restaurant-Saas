'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ChefHat, Loader2, Save, Wallet } from 'lucide-react';

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
import {
  DEFAULT_DINE_IN_PAYMENT_TIMING,
  type DineInPaymentTiming,
} from '@/lib/restaurant-dine-in-payment';

const OPTION_META: {
  value: DineInPaymentTiming;
  i18nKey: string;
  icon: typeof Wallet;
}[] = [
  {
    value: 'BEFORE_KITCHEN',
    i18nKey: 'beforeKitchen',
    icon: Wallet,
  },
  {
    value: 'ON_LEAVE',
    i18nKey: 'onLeave',
    icon: ChefHat,
  },
];

export function RestaurantDineInPaymentCard() {
  const { t } = useTranslation();
  const options = OPTION_META.map((meta) => ({
    ...meta,
    title: t(`settings.cards.dineInPayments.options.${meta.i18nKey}.title`),
    description: t(
      `settings.cards.dineInPayments.options.${meta.i18nKey}.description`
    ),
  }));
  const [timing, setTiming] = useState<DineInPaymentTiming>(
    DEFAULT_DINE_IN_PAYMENT_TIMING
  );
  const [savedTiming, setSavedTiming] = useState<DineInPaymentTiming>(
    DEFAULT_DINE_IN_PAYMENT_TIMING
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{
        data?: { dineInPaymentTiming?: DineInPaymentTiming };
      }>('/api/restaurant/dine-in-payment');
      const next =
        data.data?.dineInPaymentTiming ?? DEFAULT_DINE_IN_PAYMENT_TIMING;
      setTiming(next);
      setSavedTiming(next);
    } catch {
      toast.error(t('settings.cards.dineInPayments.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = timing !== savedTiming;

  async function save() {
    setSaving(true);
    try {
      const { data } = await axios.patch<{
        data?: { dineInPaymentTiming?: DineInPaymentTiming };
      }>('/api/restaurant/dine-in-payment', {
        dineInPaymentTiming: timing,
      });
      const next =
        data.data?.dineInPaymentTiming ?? timing;
      setTiming(next);
      setSavedTiming(next);
      toast.success(t('settings.cards.dineInPayments.saved'));
    } catch {
      toast.error(t('settings.cards.dineInPayments.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.cards.dineInPayments.title')}</CardTitle>
        <CardDescription>
          {t('settings.cards.dineInPayments.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('dashboard.common.loading')}
          </div>
        ) : (
          options.map((option) => {
            const selected = timing === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTiming(option.value)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border bg-muted/20 hover:bg-muted/40'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                <span
                  className={cn(
                    'mt-1 h-4 w-4 shrink-0 rounded-full border-2',
                    selected
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/40'
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          type="button"
          disabled={loading || saving || !dirty}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t('dashboard.common.save')}
        </Button>
      </CardFooter>
    </Card>
  );
}
