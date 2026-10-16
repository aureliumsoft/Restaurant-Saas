'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  SendHorizonal,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PayPalSubscriptionButtons } from '@/components/payments/paypal-subscription-buttons';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { PRICING_MODULE_ROWS } from '@/lib/pricing-comparison';

type Props = {
  plan: string;
  planName: string;
  priceLabel: string;
  priceMajor?: number | null;
  billingInterval?: 'monthly' | 'yearly';
  description: string;
  features: string[];
  /** Custom plan: module ids included in this quote request */
  selectedModules?: string[];
  stripeReady: boolean;
  stripeConfigError?: string | null;
  signedIn: boolean;
  userEmail: string | null;
  restaurantId?: string | null;
};

export function PaymentCheckoutClient({
  plan,
  planName,
  priceLabel,
  priceMajor,
  billingInterval = 'monthly',
  description,
  features,
  selectedModules = [],
  stripeReady,
  stripeConfigError,
  signedIn,
  userEmail,
  restaurantId,
}: Props) {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = plan.toUpperCase() === 'CUSTOM';

  const localizedName = resolveBilingualText(planName, uiLang);
  const localizedPrice = resolveBilingualText(priceLabel, uiLang);
  const localizedDescription = resolveBilingualText(description, uiLang);
  const localizedFeatures = useMemo(
    () => features.map((f) => resolveBilingualText(f, uiLang)),
    [features, uiLang]
  );

  const customModuleRows = useMemo(() => {
    if (!isCustom) return [];
    const selected = new Set(selectedModules);
    return PRICING_MODULE_ROWS.filter((row) => {
      const access = row.byPlan.CUSTOM;
      if (access === 'full') return true;
      if (access === 'limited') return true;
      if (access === 'selection') return selected.has(row.id);
      return selected.has(row.id);
    }).map((row) => ({
      id: row.id,
      label: t(`marketingExtras.pricing.modules.${row.id}`, {
        defaultValue: row.label,
      }),
      isAddOn: row.byPlan.CUSTOM === 'selection',
      isLimited: row.byPlan.CUSTOM === 'limited',
    }));
  }, [isCustom, selectedModules, t]);

  const amount = (() => {
    if (typeof priceMajor === 'number' && priceMajor > 0) return priceMajor;
    const match = localizedPrice.match(/[\d]+(?:[\.,][\d]+)?/);
    if (!match) return 0;
    return Number(match[0].replace(',', '.'));
  })();

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-white px-4 py-12 text-zinc-900 dark:bg-black dark:text-white sm:px-6 lg:px-8"
      aria-busy={loading}
    >
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-fire-500/20 blur-3xl dark:bg-fire-500/25" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-fire-300/20 blur-3xl dark:bg-fire-700/20" />
      <div className="relative mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isCustom
                ? t('marketingExtras.pricing.custom.checkoutTitle')
                : t('marketingExtras.checkout.title')}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {isCustom
                ? t('marketingExtras.pricing.custom.checkoutSubtitle')
                : t('marketingExtras.checkout.subtitle')}
            </p>
            {!isCustom ? (
              <p className="mt-1 text-sm font-medium text-fire-600 dark:text-fire-400">
                {billingInterval === 'yearly'
                  ? t('marketingExtras.pricing.billing.billedYearly')
                  : t('marketingExtras.pricing.billing.billedMonthly')}
              </p>
            ) : null}
          </div>

          <Card className="border-zinc-200/80 bg-white/95 shadow-[0_20px_60px_-30px] shadow-black/20 dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">
            <CardHeader>
              <CardTitle>
                {isCustom
                  ? t('marketingExtras.pricing.custom.selectedModulesTitle')
                  : t('marketingExtras.checkout.whatYouGet')}
              </CardTitle>
              <CardDescription>{localizedDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {isCustom ? (
                <ul className="space-y-2 text-sm">
                  {customModuleRows.map((row) => (
                    <li key={row.id} className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                      <span>{row.label}</span>
                      {row.isAddOn ? (
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-800 dark:text-sky-300">
                          {t('marketingExtras.pricing.access.selection')}
                        </span>
                      ) : null}
                      {row.isLimited ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                          L
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2 text-sm">
                  {localizedFeatures.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-primary">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-primary" />
              <span>{t('marketingExtras.checkout.tlsEncryption')}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>{t('marketingExtras.checkout.pciCompliant')}</span>
            </div>
          </div>

          {!isCustom && !stripeReady ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {stripeConfigError ??
                t('marketingExtras.checkout.paypalNotConfigured')}{' '}
              {t('marketingExtras.checkout.paypalEnvHint')}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </p>
          ) : null}
        </div>

        <Card className="h-fit border-zinc-200/80 bg-white/95 shadow-[0_20px_60px_-30px] shadow-black/20 dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">
          <CardHeader>
            <CardTitle className="text-lg">
              {t('marketingExtras.checkout.orderSummary')}
            </CardTitle>
            <CardDescription>
              {t('marketingExtras.checkout.planLabel', {
                name: localizedName,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {isCustom
                  ? t('marketingExtras.pricing.custom.quoteLabel')
                  : t('marketingExtras.checkout.dueToday')}
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {localizedPrice}
              </span>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              <p>
                {isCustom
                  ? t('marketingExtras.pricing.custom.billingNote')
                  : t('marketingExtras.checkout.billingNote', { plan })}
              </p>
            </div>
            {signedIn && userEmail ? (
              <p className="text-xs text-muted-foreground">
                {t('marketingExtras.checkout.signedInAs', {
                  email: userEmail,
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('marketingExtras.checkout.notSignedIn')}
              </p>
            )}

            {isCustom ? (
              <CustomPlanRequestForm
                selectedModules={selectedModules}
                defaultEmail={userEmail ?? ''}
                restaurantId={restaurantId ?? null}
              />
            ) : stripeReady && amount > 0 && restaurantId ? (
              <PayPalSubscriptionButtons
                plan={plan}
                billingInterval={billingInterval}
                disabled={loading}
                onProcessingChange={setLoading}
                onApproved={async ({ subscriptionId }) => {
                  try {
                    const res = await fetch(
                      '/api/paypal/activate-subscription',
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          subscriptionId,
                          plan,
                          interval: billingInterval,
                        }),
                      }
                    );
                    const body = (await res.json().catch(() => ({}))) as {
                      data?: { synced?: boolean };
                      error?: unknown;
                    };
                    if (!res.ok || !body.data?.synced) {
                      throw new Error(
                        typeof body.error === 'string'
                          ? body.error
                          : t('marketingExtras.checkout.activationFailed')
                      );
                    }
                    toast.success(
                      t('marketingExtras.checkout.activationSuccess')
                    );
                    router.replace('/dashboard');
                    router.refresh();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : t('marketingExtras.checkout.unknownError')
                    );
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : t('marketingExtras.checkout.activationError')
                    );
                  }
                }}
                onError={(msg) => toast.error(msg)}
              />
            ) : stripeReady && amount > 0 && !restaurantId ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {t('marketingExtras.checkout.ownerRequired')}
              </p>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {t('marketingExtras.checkout.priceMissing')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="flex-1"
                asChild
                type="button"
                disabled={loading}
              >
                <Link href="/pricing">
                  <ArrowLeft className="mr-2 h-4 w-4" />{' '}
                  {t('marketingExtras.checkout.backToPricing')}
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                asChild
                type="button"
                disabled={loading}
              >
                <Link href="/restaurant-signup">
                  <UserPlus className="mr-2 h-4 w-4" />{' '}
                  {t('marketingExtras.checkout.restaurantSignup')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function CustomPlanRequestForm({
  selectedModules,
  defaultEmail,
  restaurantId,
}: {
  selectedModules: string[];
  defaultEmail: string;
  restaurantId: string | null;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [restaurant, setRestaurant] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedModules.length === 0) {
      toast.error(t('marketingExtras.pricing.custom.selectModulesFirst'));
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/custom-plan-request', {
        name: name.trim(),
        email: email.trim(),
        restaurant: restaurant.trim(),
        restaurantId: restaurantId || undefined,
        selectedModules,
      });
      setSubmitted(true);
    } catch (error: unknown) {
      const msg =
        axios.isAxiosError(error) && error.response?.data?.error
          ? typeof error.response.data.error === 'string'
            ? error.response.data.error
            : t('marketingExtras.pricing.custom.submitFailed')
          : t('marketingExtras.pricing.custom.submitFailed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-300/70 bg-emerald-50 px-4 py-5 text-center dark:border-emerald-500/40 dark:bg-emerald-500/10">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
          {t('marketingExtras.pricing.custom.successTitle')}
        </p>
        <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
          {t('marketingExtras.pricing.custom.successBody')}
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
        {t('marketingExtras.pricing.custom.formTitle')}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="custom-pay-name">
          {t('marketingExtras.pricing.custom.yourName')}
        </Label>
        <Input
          id="custom-pay-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-pay-email">
          {t('marketingExtras.pricing.custom.businessEmail')}
        </Label>
        <Input
          id="custom-pay-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-pay-restaurant">
          {t('marketingExtras.pricing.custom.restaurantName')}
        </Label>
        <Input
          id="custom-pay-restaurant"
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          required
          className="h-9"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-white hover:from-fire-400 hover:to-fire-500"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('marketingExtras.pricing.custom.submitting')}
          </>
        ) : (
          <>
            {t('marketingExtras.pricing.custom.requestToBuy')}
            <SendHorizonal className="ml-1 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
