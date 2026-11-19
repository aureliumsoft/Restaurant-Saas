'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

type Billing = {
  plan: string | null;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

function daysRemaining(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function DashboardTrialBanner() {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<Billing | null>(null);

  useEffect(() => {
    let mounted = true;
    axios
      .get<{ data: Billing }>('/api/restaurant/billing')
      .then((res) => {
        if (mounted) setBilling(res.data.data ?? null);
      })
      .catch(() => {
        if (mounted) setBilling(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!billing || billing.status !== 'TRIAL') return null;

  const days = daysRemaining(billing.trialEndsAt ?? billing.currentPeriodEnd);
  const message =
    days == null
      ? t('dashboard.trial.running')
      : days <= 0
        ? t('dashboard.trial.ended')
        : days === 1
          ? t('dashboard.trial.dayLeft')
          : t('dashboard.trial.daysLeft', { count: days });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-fire-500/40 bg-fire-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{message}</p>
      <Button type="button" className="shrink-0" asChild>
        <Link href="/pricing">{t('dashboard.trial.choosePlan')}</Link>
      </Button>
    </div>
  );
}
