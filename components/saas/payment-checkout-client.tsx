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
            <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Subscribe with PayPal. Monthly billing and renewals are handled
              securely by PayPal.
            </p>
          </div>

          <Card className="border-zinc-200/80 bg-white/95 shadow-[0_20px_60px_-30px] shadow-black/20 dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">
            <CardHeader>
              <CardTitle>What you get</CardTitle>
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
              <span>256-bit TLS encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>PCI-compliant checkout (PayPal)</span>
            </div>
          </div>

          {!stripeReady ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {stripeConfigError ?? 'PayPal is not configured on this server.'} Set{' '}
              <code className="rounded bg-muted px-1">PAYPAL_CLIENT_ID</code> and{' '}
              <code className="rounded bg-muted px-1">PAYPAL_CLIENT_SECRET</code> to enable payments.
            </p>
          ) : null}
        </div>

        <Card className="h-fit border-zinc-200/80 bg-white/95 shadow-[0_20px_60px_-30px] shadow-black/20 dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">
          <CardHeader>
            <CardTitle className="text-lg">Order summary</CardTitle>
            <CardDescription>Plan {planName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Due today</span>
              <span className="text-2xl font-bold tabular-nums">{priceLabel}</span>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              <p>
                Monthly billing for plan <strong>{plan}</strong>. PayPal manages
                your subscription and renewals.
              </p>
            </div>
            {signedIn && userEmail ? (
              <p className="text-xs text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{userEmail}</span>.
                After payment, your restaurant subscription will update automatically.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                You are not signed in. Sign in first to attach this payment to your restaurant.
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
                          : 'Subscription could not be activated.'
                      );
                    }
                    toast.success('Subscription active. Welcome to Dashboard!');
                    router.replace('/dashboard');
                    router.refresh();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'An unknown error occurred'
                    );
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : 'Subscription activation failed.'
                    );
                  }
                }}
                onError={(msg) => toast.error(msg)}
              />
            ) : stripeReady && amount > 0 && !restaurantId ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Sign in with a restaurant owner account before paying so the
                subscription can be attached automatically.
              </p>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Plan price could not be read. Update the subscription catalog
                price for this plan.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="flex-1" asChild type="button" disabled={loading}>
                <Link href="/pricing"> <ArrowLeft className="h-4 w-4 mr-2" /> Back to pricing</Link>
              </Button>
              <Button variant="ghost" className="flex-1" asChild type="button" disabled={loading}>
                <Link href="/restaurant-signup"> <UserPlus className="h-4 w-4 mr-2" /> Restaurant signup</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
