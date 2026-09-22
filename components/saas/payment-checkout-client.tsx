'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PayPalSubscriptionButtons } from '@/components/payments/paypal-subscription-buttons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  plan: string;
  planName: string;
  priceLabel: string;
  priceMajor?: number | null;
  description: string;
  features: string[];
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
  description,
  features,
  stripeReady,
  stripeConfigError,
  signedIn,
  userEmail,
  restaurantId,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = (() => {
    if (typeof priceMajor === 'number' && priceMajor > 0) return priceMajor;
    const match = priceLabel.match(/[\d]+(?:[\.,][\d]+)?/);
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
              {t('marketingExtras.checkout.title')}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {t('marketingExtras.checkout.subtitle')}
            </p>
          </div>

          <Card className="border-zinc-200/80 bg-white/95 shadow-[0_20px_60px_-30px] shadow-black/20 dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">
            <CardHeader>
              <CardTitle>{t('marketingExtras.checkout.whatYouGet')}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-primary">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
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

          {!stripeReady ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {stripeConfigError ?? t('marketingExtras.checkout.paypalNotConfigured')}{' '}
              {t('marketingExtras.checkout.paypalEnvHint')}
            </p>
          ) : null}
        </div>

        <Card className="h-fit border-zinc-200/80 bg-white/95 shadow-[0_20px_60px_-30px] shadow-black/20 dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">
          <CardHeader>
            <CardTitle className="text-lg">{t('marketingExtras.checkout.orderSummary')}</CardTitle>
            <CardDescription>
              {t('marketingExtras.checkout.planLabel', { name: planName })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {t('marketingExtras.checkout.dueToday')}
              </span>
              <span className="text-2xl font-bold tabular-nums">{priceLabel}</span>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              <p>{t('marketingExtras.checkout.billingNote', { plan })}</p>
            </div>
            {signedIn && userEmail ? (
              <p className="text-xs text-muted-foreground">
                {t('marketingExtras.checkout.signedInAs', { email: userEmail })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('marketingExtras.checkout.notSignedIn')}
              </p>
            )}
            {stripeReady && amount > 0 && restaurantId ? (
              <PayPalSubscriptionButtons
                plan={plan}
                disabled={loading}
                onProcessingChange={setLoading}
                onApproved={async ({ subscriptionId }) => {
                  try {
                    const res = await fetch('/api/paypal/activate-subscription', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ subscriptionId, plan }),
                    });
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
                    toast.success(t('marketingExtras.checkout.activationSuccess'));
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
              <Button variant="outline" className="flex-1" asChild type="button" disabled={loading}>
                <Link href="/pricing">
                  <ArrowLeft className="h-4 w-4 mr-2" /> {t('marketingExtras.checkout.backToPricing')}
                </Link>
              </Button>
              <Button variant="ghost" className="flex-1" asChild type="button" disabled={loading}>
                <Link href="/restaurant-signup">
                  <UserPlus className="h-4 w-4 mr-2" /> {t('marketingExtras.checkout.restaurantSignup')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
