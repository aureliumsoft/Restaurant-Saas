'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { AcceptedPaymentMethods } from '@/components/payments/accepted-payment-methods';
import { defaultPayPalCountryForCurrency } from '@/lib/paypal-buyer-countries';

declare global {
  interface Window {
    paypal?: any;
  }
}

type PayPalCaptureResponse = {
  paid?: boolean;
  status?: string;
  orderSync?: 'skipped' | 'completed' | 'already_completed';
  orderId?: string;
  shortOrderId?: string;
  ticketNumber?: number | null;
  restaurantId?: string;
  planSynced?: boolean;
  metadata?: Record<string, unknown>;
  error?: unknown;
};

export type PayPalCheckoutMetadata = Record<string, string>;

export type PayPalCheckoutButtonsProps = {
  amount: number;
  currency?: string;
  title: string;
  /** Required for customer order checkout (multiparty payments to restaurant). */
  restaurantSlug?: string;
  source?: 'online' | 'kiosk' | 'subscription';
  endpoint?: '/api/customer/orders' | '/api/kiosk/orders';
  payload?: unknown;
  metadata?: PayPalCheckoutMetadata;
  disabled?: boolean;
  /** Full-page blocking overlay while PayPal creates, captures, and completes redirect. Default true. */
  showPageOverlay?: boolean;
  onProcessingChange?: (processing: boolean) => void;
  onApproved: (info: {
    paypalOrderId: string;
    capture: PayPalCaptureResponse;
  }) => void | Promise<void>;
  onError?: (message: string) => void;
  onCancel?: () => void;
};

type PayPalSdkConfig = {
  clientId: string;
  currency: string;
  mode: 'live' | 'sandbox';
  merchantId?: string;
  multiparty?: boolean;
  buyerCountry?: string;
};

type PaymentPhase = 'idle' | 'capture' | 'complete';

const configCache = new Map<string, PayPalSdkConfig>();
const configPromises = new Map<string, Promise<PayPalSdkConfig>>();

async function fetchPayPalConfig(restaurantSlug?: string): Promise<PayPalSdkConfig> {
  const cacheKey = restaurantSlug?.trim() || '__platform__';
  const cached = configCache.get(cacheKey);
  if (cached) return cached;

  const existing = configPromises.get(cacheKey);
  if (existing) return existing;

  const url = restaurantSlug?.trim()
    ? `/api/paypal/sdk-config?restaurantSlug=${encodeURIComponent(restaurantSlug.trim())}`
    : '/api/paypal/sdk-config';

  const promise = fetch(url, { cache: 'no-store' })
    .then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as {
        clientId?: string;
        merchantId?: string;
        currency?: string;
        mode?: string;
        multiparty?: boolean;
        buyerCountry?: string;
        error?: unknown;
      };
      if (!res.ok || !body.clientId) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'PayPal is not configured.'
        );
      }
      const config: PayPalSdkConfig = {
        clientId: body.clientId,
        currency: (body.currency ?? 'EUR').toUpperCase(),
        mode: body.mode === 'live' ? 'live' : 'sandbox',
        merchantId: body.merchantId,
        multiparty: body.multiparty === true,
        buyerCountry: body.buyerCountry?.trim().toUpperCase(),
      };
      configCache.set(cacheKey, config);
      return config;
    })
    .catch((e) => {
      configPromises.delete(cacheKey);
      throw e;
    });

  configPromises.set(cacheKey, promise);
  return promise;
}

const sdkPromises = new Map<string, Promise<void>>();

/** Align PayPal card-fields region with checkout currency (sandbox). */
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

function loadPayPalSdk(
  clientId: string,
  currency: string,
  merchantId?: string,
  buyerCountryOverride?: string
): Promise<void> {
  const buyerCountry =
    buyerCountryOverride?.trim().toUpperCase() ||
    buyerCountryForCurrency(currency);
  const key = `${clientId}:${currency}:${merchantId ?? 'platform'}:${buyerCountry ?? 'auto'}`;
  const existing = sdkPromises.get(key);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('PayPal SDK can only load in the browser.'));
      return;
    }
    const scriptSelector = `script[data-paypal-sdk-key="${key}"]`;
    if (document.querySelector(scriptSelector) && window.paypal) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    const params = new URLSearchParams({
      'client-id': clientId,
      currency,
      components: 'buttons',
      'enable-funding': 'card',
      'disable-funding': 'paylater,credit',
      intent: 'capture',
    });
    if (merchantId) {
      params.set('merchant-id', merchantId);
    }
    if (buyerCountry) {
      params.set('buyer-country', buyerCountry);
    }
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.dataset.paypalSdk = 'true';
    script.dataset.paypalSdkKey = key;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PayPal SDK.'));
    document.head.appendChild(script);
  });
  sdkPromises.set(key, p);
  return p;
}

function phaseMessage(phase: PaymentPhase): string {
  switch (phase) {
    case 'capture':
      return 'Processing your Secure Payment…';
    case 'complete':
      return 'Payment Successful! Redirecting…';
    default:
      return 'Processing Secure Payment…';
  }
}

function PayPalProcessingOverlay({
  message,
  mounted,
}: {
  message: string;
  mounted: boolean;
}) {
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-black/75 px-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden />
      <p className="max-w-sm text-center text-base font-semibold text-white">
        {message}
      </p>
      <p className="max-w-xs text-center text-sm text-white/80">
        Please do not close this page until you are redirected.
      </p>
    </div>,
    document.body
  );
}

/**
 * Renders inline **PayPal** and **Debit or Credit Card** buttons (Visa /
 * Mastercard / Amex via PayPal Guest Checkout). Shows a full-page loading
 * overlay only when PayPal approves the payment (capture + redirect), not
 * while the customer enters card details in the PayPal window.
 */
export function PayPalCheckoutButtons({
  amount,
  currency,
  title,
  restaurantSlug,
  source,
  endpoint,
  payload,
  metadata,
  disabled,
  showPageOverlay = true,
  onProcessingChange,
  onApproved,
  onError,
  onCancel,
}: PayPalCheckoutButtonsProps) {
  const paypalSlotRef = useRef<HTMLDivElement>(null);
  const cardSlotRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [sdkLoading, setSdkLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [portalMounted, setPortalMounted] = useState(false);
  const [resolvedCurrency, setResolvedCurrency] = useState<string>(
    (currency ?? 'EUR').toUpperCase()
  );

  const metadataKey = useMemo(() => JSON.stringify(metadata ?? {}), [metadata]);
  const payloadKey = useMemo(() => JSON.stringify(payload ?? null), [payload]);

  const latestRef = useRef({
    amount,
    currency: resolvedCurrency,
    title,
    source,
    endpoint,
    payload,
    metadata,
    onApproved,
    onError,
    onCancel,
  });
  latestRef.current = {
    amount,
    currency: resolvedCurrency,
    title,
    source,
    endpoint,
    payload,
    metadata,
    onApproved,
    onError,
    onCancel,
  };

  const setProcessingState = (active: boolean, nextPhase: PaymentPhase = 'idle') => {
    setProcessing(active);
    setPhase(active ? nextPhase : 'idle');
    onProcessingChange?.(active);
  };

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSdkLoading(true);
    setReady(false);
    (async () => {
      try {
        const config = await fetchPayPalConfig(restaurantSlug);
        if (!config) throw new Error('Missing PayPal configuration.');
        const wantedCurrency = (currency ?? config.currency).toUpperCase();
        await loadPayPalSdk(
          config.clientId,
          wantedCurrency,
          config.merchantId,
          config.buyerCountry
        );
        if (cancelled) return;
        setResolvedCurrency(wantedCurrency);
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'PayPal failed to load.';
        setError(msg);
        onError?.(msg);
      } finally {
        if (!cancelled) setSdkLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currency, onError, restaurantSlug]);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === 'undefined') return;
    const paypal = window.paypal;
    if (!paypal) return;

    const paypalSlot = paypalSlotRef.current;
    const cardSlot = cardSlotRef.current;
    if (paypalSlot) paypalSlot.innerHTML = '';
    if (cardSlot) cardSlot.innerHTML = '';

    const createOrder = async () => {
      const {
        amount: latestAmount,
        currency: latestCurrency,
        title: latestTitle,
        source: latestSource,
        endpoint: latestEndpoint,
        payload: latestPayload,
        metadata: latestMetadata,
      } = latestRef.current;
      const res = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: latestAmount,
            currency: latestCurrency,
            source: latestSource,
            title: latestTitle,
            metadata: latestMetadata,
            ...(latestEndpoint && latestPayload != null
              ? { endpoint: latestEndpoint, payload: latestPayload }
              : {}),
          }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: unknown;
      };
      if (!res.ok || !body.id) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'Could not start PayPal payment.'
        );
      }
      return body.id;
    };

    const onApprove = async (data: { orderID: string }) => {
      setProcessingState(true, 'capture');
      try {
        const slug = latestRef.current.metadata?.restaurantSlug;
        const res = await fetch('/api/paypal/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: data.orderID,
            ...(typeof slug === 'string' && slug.trim()
              ? { restaurantSlug: slug.trim() }
              : {}),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as PayPalCaptureResponse;
        if (!res.ok || !body.paid) {
          throw new Error(
            typeof body.error === 'string'
              ? body.error
              : 'Payment could not be confirmed.'
          );
        }
        setPhase('complete');
        await Promise.resolve(
          latestRef.current.onApproved({
            paypalOrderId: data.orderID,
            capture: body,
          })
        );
        // Keep overlay visible during navigation; page unloads on redirect.
      } catch (e) {
        setProcessingState(false);
        handleError(e);
      }
    };

    const handleError = (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err ?? '');
      const msg =
        /ADD_SHIPPING_ERROR|shipping/i.test(raw)
          ? 'Card payment could not start. Refresh the page and try again, or use the PayPal button.'
          : raw.trim() || 'Payment failed.';
      setError(msg);
      latestRef.current.onError?.(msg);
    };

    const renderButton = (
      fundingSource: string,
      slot: HTMLDivElement | null,
      label: 'paypal' | 'pay'
    ) => {
      if (!slot) return;
      const btn = paypal.Buttons({
        fundingSource,
        style: {
          layout: 'vertical',
          shape: 'rect',
          label,
          height: 44,
          color: label === 'paypal' ? 'gold' : 'black',
        },
        createOrder,
        onApprove,
        onError: (err: unknown) => {
          setProcessingState(false);
          handleError(err);
        },
        onCancel: () => {
          setProcessingState(false);
          latestRef.current.onCancel?.();
        },
      });
      if (btn.isEligible()) {
        btn.render(slot).catch((err: unknown) => {
          setProcessingState(false);
          handleError(err);
        });
      }
    };

    renderButton(paypal.FUNDING.PAYPAL, paypalSlot, 'paypal');
    renderButton(paypal.FUNDING.CARD, cardSlot, 'pay');

    return () => {
      if (paypalSlot) paypalSlot.innerHTML = '';
      if (cardSlot) cardSlot.innerHTML = '';
    };
  }, [ready, resolvedCurrency, metadataKey, payloadKey]);

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
      {showPageOverlay && processing ? (
        <PayPalProcessingOverlay
          message={phaseMessage(phase)}
          mounted={portalMounted}
        />
      ) : null}
      <div
        className={`relative flex flex-col gap-2 ${blocked ? 'pointer-events-none opacity-60' : ''}`}
        aria-busy={sdkLoading || processing}
      >
        {sdkLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            <Loader2 className="shrink-0 animate-spin text-primary text-center mx-auto" aria-hidden />   
          </div>
        ) : null}
        <div ref={paypalSlotRef} className="min-h-[44px]" />
        <div ref={cardSlotRef} className="min-h-[44px]" />
        <AcceptedPaymentMethods
          size="sm"
          showPayPal
          showLabel
          label="Pay with PayPal or Card"
          className="pt-1"
        />
      </div>
    </>
  );
}
