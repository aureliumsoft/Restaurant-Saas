'use client';

import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Headphones,
  Lock,
  RefreshCcw,
  SendHorizonal,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  PricingComparisonTable,
  PricingPlanFeatureList,
} from '@/components/saas/pricing-comparison';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import {
  getCustomBaseModuleIds,
  PRICING_MODULE_ROWS,
} from '@/lib/pricing-comparison';
import { cn } from '@/lib/utils';

export type PricingPlanView = {
  plan: string;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  features: string[];
};

type PricingPageViewProps = {
  isLoggedIn: boolean;
  currentPlanSlug: string | null;
  subscriptionPeriodActive: boolean;
  periodEndLabel: string | null;
  plans: PricingPlanView[];
};

function buildPaymentHref(
  plan: string,
  isLoggedIn: boolean,
  modules?: string[]
): string {
  const params = new URLSearchParams({ plan });
  if (modules && modules.length > 0) {
    params.set('modules', modules.join(','));
  }
  const path = `/payment?${params.toString()}`;
  if (isLoggedIn) return path;
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

export function PricingPageView({
  isLoggedIn,
  currentPlanSlug,
  subscriptionPeriodActive,
  periodEndLabel,
  plans,
}: PricingPageViewProps) {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();

  const [customSelected, setCustomSelected] = useState<Set<string>>(
    () => new Set()
  );

  const localizedPlans = useMemo(
    () =>
      plans.map((p) => ({
        ...p,
        name: resolveBilingualText(p.name, uiLang),
        priceLabel: resolveBilingualText(p.priceLabel, uiLang),
        description: resolveBilingualText(p.description, uiLang),
        features: p.features.map((f) => resolveBilingualText(f, uiLang)),
      })),
    [plans, uiLang]
  );

  const toggleCustomModule = useCallback((moduleId: string, next: boolean) => {
    setCustomSelected((prev) => {
      const nextSet = new Set(prev);
      if (next) nextSet.add(moduleId);
      else nextSet.delete(moduleId);
      return nextSet;
    });
  }, []);

  /** Base + limited + checked add-ons for the payment page. */
  const customModulesForPayment = useMemo(() => {
    const base = getCustomBaseModuleIds();
    const limitedIds = PRICING_MODULE_ROWS.filter(
      (r) => r.byPlan.CUSTOM === 'limited'
    ).map((r) => r.id);
    return [...new Set([...base, ...limitedIds, ...customSelected])];
  }, [customSelected]);

  function onContinueCustom() {
    if (customSelected.size === 0) {
      toast.info(t('marketingExtras.pricing.custom.selectModulesFirst'));
      return;
    }
    const href = buildPaymentHref('CUSTOM', isLoggedIn, customModulesForPayment);
    window.location.href = href;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f4ef] px-6 py-10 text-zinc-900 dark:bg-[#08090d] dark:text-white">
      <div className="pointer-events-none absolute inset-x-0 top-16 mx-auto h-44 max-w-3xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.35),transparent_70%)] blur-xl dark:bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.28),transparent_70%)]" />
      <div className="pointer-events-none absolute -left-16 top-36 h-56 w-56 rounded-full bg-fire-200/40 blur-3xl dark:bg-fire-900/30" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-56 w-56 rounded-full bg-fire-100/40 blur-3xl dark:bg-fire-900/25" />

      <div className="relative mx-auto w-full p-8 md:p-12">
        <div className="mb-10 text-center md:mb-12">
          <span className="inline-flex items-center rounded-full border border-fire-300/70 bg-fire-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-fire-700 dark:border-fire-500/40 dark:bg-fire-500/10 dark:text-fire-300">
            {t('marketingExtras.pricing.badge')}
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
            {t('marketingExtras.pricing.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-600 dark:text-zinc-300">
            {t('marketingExtras.pricing.subtitle')}
          </p>
          <div className="mt-5">
            <Button
              variant="outline"
              asChild
              className="border-fire-300 bg-fire-50 text-fire-700 hover:bg-fire-100 dark:border-fire-500/40 dark:bg-white/5 dark:text-fire-200 dark:hover:bg-white/10"
            >
              <Link href="/demo-request">
                {t('marketingExtras.pricing.requestDemoTrial')}
              </Link>
            </Button>
          </div>
        </div>

        {localizedPlans.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
            {t('marketingExtras.pricing.noPlans')}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {localizedPlans.map((plan) => {
              const planKey = plan.plan.toUpperCase();
              const planMatches =
                currentPlanSlug !== null &&
                planKey === currentPlanSlug.toUpperCase();
              const isCurrentPlan = planMatches && subscriptionPeriodActive;
              const isExpiredCurrentPlan =
                planMatches && !subscriptionPeriodActive;
              const isFeatured = planKey === 'GROWTH';
              const isCustom = planKey === 'CUSTOM';

              const paymentHref = buildPaymentHref(plan.plan, isLoggedIn);

              return (
                <article
                  key={plan.plan}
                  className={cn(
                    'relative flex flex-col rounded-2xl border p-6 transition-transform duration-300',
                    isFeatured
                      ? 'border-fire-300 bg-fire-50/10 shadow-[0_30px_70px_-30px] shadow-fire-400/70 md:-translate-y-1 dark:border-fire-500/50 dark:bg-gradient-to-b dark:from-fire-500/15 dark:to-zinc-900/70 dark:shadow-fire-900/80'
                      : 'border-zinc-200/80 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/50'
                  )}
                >
                  {isFeatured ? (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 rounded-full border border-fire-300 bg-fire-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-fire-700 dark:border-fire-500/40 dark:bg-fire-500/15 dark:text-fire-200">
                      {t('marketingExtras.pricing.mostPopular')}
                    </span>
                  ) : null}
                  <h2 className="text-3xl font-semibold">{plan.name}</h2>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-fire-600 dark:text-fire-400">
                    {plan.priceLabel}
                  </p>
                  <p className="mt-2 min-h-10 text-sm text-zinc-600 dark:text-zinc-300">
                    {plan.description}
                  </p>
                  <div className="mt-5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {t('marketingExtras.pricing.featuresHeading')}
                  </div>
                  {isCustom ? (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('marketingExtras.pricing.custom.hint')}
                    </p>
                  ) : null}
                  <PricingPlanFeatureList
                    plan={plan.plan}
                    selectedModules={isCustom ? customSelected : undefined}
                    filterToSelected={false}
                    onToggleModule={isCustom ? toggleCustomModule : undefined}
                  />

                  {isCurrentPlan ? (
                    <p className="mt-6 rounded-lg border border-fire-300 bg-fire-100 px-4 py-3 text-center text-sm font-medium text-fire-700 dark:border-fire-500/40 dark:bg-fire-500/15 dark:text-fire-100">
                      {t('marketingExtras.pricing.yourCurrentPlan')}
                      {periodEndLabel ? (
                        <span className="mt-1 block text-xs font-normal opacity-90">
                          {t('marketingExtras.pricing.activeUntil', {
                            date: periodEndLabel,
                          })}
                        </span>
                      ) : null}
                    </p>
                  ) : isExpiredCurrentPlan && !isCustom ? (
                    <>
                      <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                        {t('marketingExtras.pricing.planExpired')}
                      </p>
                      <Button
                        className="mt-3 w-full bg-gradient-to-r from-fire-500 to-fire-600 text-white hover:from-fire-400 hover:to-fire-500"
                        asChild
                      >
                        <Link href={paymentHref}>
                          <span>
                            {t('marketingExtras.pricing.renewPlan', {
                              name: plan.name,
                            })}
                          </span>
                          <RefreshCcw className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </>
                  ) : isCustom ? (
                    <>
                      <Button
                        type="button"
                        className="mt-6 w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        onClick={onContinueCustom}
                      >
                        <span>
                          {t('marketingExtras.pricing.choosePlan', {
                            name: plan.name,
                          })}
                        </span>
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                      <p className="mt-2 text-center text-[11px] text-zinc-500">
                        {t('marketingExtras.pricing.custom.selectedCount', {
                          count: customSelected.size,
                        })}
                      </p>
                    </>
                  ) : (
                    <>
                      <Button
                        className={cn(
                          'mt-6 w-full',
                          isFeatured
                            ? 'bg-gradient-to-r from-fire-500 to-fire-600 text-white hover:from-fire-400 hover:to-fire-500'
                            : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                        )}
                        asChild
                      >
                        <Link href={paymentHref}>
                          <span>
                            {t('marketingExtras.pricing.choosePlan', {
                              name: plan.name,
                            })}
                          </span>
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        className="mt-2 w-full border-zinc-300 bg-white/70 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                        variant="outline"
                        asChild
                      >
                        <Link href="/demo-request">
                          {t('marketingExtras.pricing.requestDemoForTrial')}{' '}
                          <SendHorizonal className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {localizedPlans.length > 0 ? (
          <PricingComparisonTable
            plans={localizedPlans.map((p) => ({
              plan: p.plan,
              name: p.name,
            }))}
          />
        ) : null}

        <div className="mt-10 grid gap-3 rounded-2xl border border-zinc-200/80 bg-[#fff7ef] p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <TrustFeature
            icon={<ShieldCheck className="h-4 w-4" />}
            title={t('marketingExtras.pricing.trust.noHiddenFees.title')}
            text={t('marketingExtras.pricing.trust.noHiddenFees.text')}
          />
          <TrustFeature
            icon={<RefreshCcw className="h-4 w-4" />}
            title={t('marketingExtras.pricing.trust.cancelAnytime.title')}
            text={t('marketingExtras.pricing.trust.cancelAnytime.text')}
          />
          <TrustFeature
            icon={<Headphones className="h-4 w-4" />}
            title={t('marketingExtras.pricing.trust.support.title')}
            text={t('marketingExtras.pricing.trust.support.text')}
          />
          <TrustFeature
            icon={<Lock className="h-4 w-4" />}
            title={t('marketingExtras.pricing.trust.secure.title')}
            text={t('marketingExtras.pricing.trust.secure.text')}
          />
        </div>
      </div>
    </main>
  );
}

function TrustFeature({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="flex items-start gap-3 rounded-xl border border-fire-200/70 bg-white/80 px-3 py-3 dark:border-fire-500/30 dark:bg-zinc-950/50">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fire-100 text-fire-600 dark:bg-fire-500/15 dark:text-fire-300">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          {text}
        </p>
      </div>
    </article>
  );
}
