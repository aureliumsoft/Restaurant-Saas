'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { AcceptedPaymentMethods } from '@/components/payments/accepted-payment-methods';
import { PayPalSandboxDemoCard } from '@/components/payments/paypal-sandbox-demo-card';

type SubscriptionConfig = {
  clientId: string;
  planId: string;
  currency: string;
  mode: 'live' | 'sandbox';
};

type PayPalSubscriptionButtonsProps = {
  plan: string;
  disabled?: boolean;
  onProcessingChange?: (processing: boolean) => void;
  onApproved: (info: { subscriptionId: string }) => void | Promise<void>;
  onError?: (message: string) => void;
  onCancel?: () => void;
};

const configCache = new Map<string, SubscriptionConfig>();
const sdkPromises = new Map<string, Promise<void>>();

async function fetchSubscriptionConfig(plan: string): Promise<SubscriptionConfig> {
  const cached = configCache.get(plan);
  if (cached) return cached;

  const res = await fetch(
    `/api/paypal/subscription-config?plan=${encodeURIComponent(plan)}`,
    { cache: 'no-store' }
  );
  const body = (await res.json().catch(() => ({}))) as {
    clientId?: string;
    planId?: string;
    currency?: string;
    mode?: string;
    error?: unknown;
  };
  if (!res.ok || !body.clientId || !body.planId) {
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : 'Could not load subscription plan.'
    );
  }
  const config: SubscriptionConfig = {
    clientId: body.clientId,
    planId: body.planId,
    currency: (body.currency ?? 'EUR').toUpperCase(),
    mode: body.mode === 'live' ? 'live' : 'sandbox',
  };
  configCache.set(plan, config);
  return config;
}

function buyerCountryForCurrency(currency: string): string | undefined {
  switch (currency.toUpperCase()) {
    case 'EUR':
      return 'DE';
    case 'GBP':
      return 'GB';
    case 'USD':
      return 'US';
    case 'AUD':
      return 'AU';
    case 'CAD':
      return 'CA';
    default:
      return undefined;
  }
}

function loadSubscriptionSdk(clientId: string, currency: string): Promise<void> {
  const buyerCountry = buyerCountryForCurrency(currency);
  const key = `sub:${clientId}:${currency}:${buyerCountry ?? 'auto'}`;
  const existing = sdkPromises.get(key);
  if (existing) return existing;

  const p = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('PayPal SDK can only load in the browser.'));
      return;
    }
    if (
      document.querySelector(`script[data-paypal-sub-sdk="${key}"]`) &&
      (window as Window & { paypal?: unknown }).paypal
    ) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    const params = new URLSearchParams({
      'client-id': clientId,
      currency,
      components: 'buttons',
      vault: 'true',
      intent: 'subscription',
      'enable-funding': 'card',
    });
    if (buyerCountry) {
      params.set('buyer-country', buyerCountry);
    }
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.dataset.paypalSubSdk = key;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PayPal SDK.'));
    document.head.appendChild(script);
  });
  sdkPromises.set(key, p);
  return p;
}

export function PayPalSubscriptionButtons({
  plan,
  disabled,
  onProcessingChange,
  onApproved,
  onError,
  onCancel,
}: PayPalSubscriptionButtonsProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [checkoutCurrency, setCheckoutCurrency] = useState('EUR');

  const latestRef = useRef({ plan, onApproved, onError, onCancel });
  latestRef.current = { plan, onApproved, onError, onCancel };

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    setReady(false);
    (async () => {
      try {
        const config = await fetchSubscriptionConfig(plan);
        await loadSubscriptionSdk(config.clientId, config.currency);
        if (cancelled) return;
        setSandboxMode(config.mode === 'sandbox');
        setCheckoutCurrency(config.currency);
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'PayPal failed to load.';
        setError(msg);
        onError?.(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, onError]);

  useEffect(() => {
    if (!ready) return;
    const paypal = (window as Window & { paypal?: any }).paypal;
    const slot = slotRef.current;
    if (!paypal || !slot) return;
    slot.innerHTML = '';

    let config: SubscriptionConfig;
    const setup = async () => {
      config = await fetchSubscriptionConfig(latestRef.current.plan);

      const btn = paypal.Buttons({
        style: {
          layout: 'vertical',
          shape: 'rect',
          label: 'subscribe',
          height: 44,
        },
        createSubscription(
          _data: unknown,
          actions: {
            subscription: {
              create: (arg: { plan_id: string }) => Promise<string>;
            };
          }
        ) {
          return actions.subscription.create({ plan_id: config.planId });
        },
        onApprove: async (data: { subscriptionID?: string }) => {
          const subscriptionId = data.subscriptionID;
          if (!subscriptionId) {
            latestRef.current.onError?.('Missing PayPal subscription id.');
            return;
          }
          setProcessing(true);
          onProcessingChange?.(true);
          try {
            await Promise.resolve(
              latestRef.current.onApproved({ subscriptionId })
            );
          } catch (e) {
            setProcessing(false);
            onProcessingChange?.(false);
            const msg =
              e instanceof Error ? e.message : 'Subscription activation failed.';
            setError(msg);
            latestRef.current.onError?.(msg);
          }
        },
        onError: (err: unknown) => {
          setProcessing(false);
          onProcessingChange?.(false);
          const msg =
            err instanceof Error ? err.message : 'PayPal subscription failed.';
          setError(msg);
          latestRef.current.onError?.(msg);
        },
        onCancel: () => {
          setProcessing(false);
          onProcessingChange?.(false);
          latestRef.current.onCancel?.();
        },
      });

      if (btn.isEligible()) {
        await btn.render(slot);
      }
    };

    setup().catch((e) => {
      const msg = e instanceof Error ? e.message : 'PayPal render failed.';
      setError(msg);
      onError?.(msg);
    });

    return () => {
      slot.innerHTML = '';
    };
  }, [ready, plan, onProcessingChange, onError]);

  const blocked = disabled || processing;

  if (error && !processing) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
        {error}
      </div>
    );
  }

  return (
    <>
      {processing
        ? portalMounted
          ? createPortal(
              <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-black/75 px-6 backdrop-blur-sm">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-center text-base font-semibold text-white">
                  Activating your subscription…
                </p>
              </div>,
              document.body
            )
          : null
        : null}
      <div
        className={`flex flex-col gap-2 ${blocked ? 'pointer-events-none opacity-60' : ''}`}
        aria-busy={loading || processing}
      >
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}
        <div ref={slotRef} className="min-h-[44px]" />
        {sandboxMode ? (
          <PayPalSandboxDemoCard
            currency={checkoutCurrency}
            variant="subscription"
          />
        ) : null}
        <AcceptedPaymentMethods
          size="sm"
          showPayPal
          showLabel
          label="Subscribe with PayPal or card"
          className="pt-1"
        />
        <p className="text-xs text-muted-foreground">
          PayPal handles monthly billing and renewals. Manage your subscription
          in your PayPal account.
        </p>
      </div>
    </>
  );
}
