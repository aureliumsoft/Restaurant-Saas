'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

type Props = {
  featureLabel: string;
  restaurantName?: string;
  upgradeHref?: string;
  description?: string;
};

/** Public website/kiosk wall when the module is Paid on the restaurant plan. */
export function PlanUpgradeScreen({
  featureLabel,
  restaurantName,
  upgradeHref = '/pricing',
  description,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent blur-3xl"
        aria-hidden
      />
      <div className="relative z-10 mx-auto w-full max-w-lg">
        <div className="overflow-hidden rounded-3xl bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8 ">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-600">
              <Crown className="h-10 w-10" />
            </div>
            {restaurantName ? (
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {restaurantName}
              </p>
            ) : null}
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t('premium.requiresUpgrade', { feature: featureLabel })}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description ??
                t('premium.channelNotIncluded', {
                  feature: featureLabel.toLowerCase(),
                })}
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                className="rounded-2xl bg-gradient-to-r from-fire-500 to-fire-600 font-semibold text-white shadow-lg shadow-fire-500/25 hover:from-fire-400 hover:to-fire-500"
              >
                <Link href={upgradeHref}>{t('premium.viewPricing')}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/">{t('premium.returnHome')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
