'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type StripeCheckoutButtonProps = {
  amount: number;
  currency?: string;
  title: string;
  restaurantSlug: string;
  source: 'online' | 'kiosk';
  endpoint?: '/api/customer/orders' | '/api/kiosk/orders';
  payload?: unknown;
  metadata?: Record<string, string>;
  successPath: string;
  cancelPath: string;
  disabled?: boolean;
  onProcessingChange?: (processing: boolean) => void;
  onError?: (message: string) => void;
};

export function StripeCheckoutButton({
  amount,
  currency = 'EUR',
  title,
  restaurantSlug,
  source,
  endpoint,
  payload,
  metadata,
  successPath,
  cancelPath,
  disabled,
  onProcessingChange,
  onError,
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    onProcessingChange?.(true);
    try {
      const res = await fetch('/api/stripe/create-order-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency,
          title,
          source,
          endpoint,
          payload,
          successPath,
          cancelPath,
          metadata: {
            ...(metadata ?? {}),
            restaurantSlug,
            source,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: unknown;
      };
      if (!res.ok || !body.url) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'Could not start Stripe checkout.'
        );
      }
      window.location.href = body.url;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Could not start Stripe checkout.';
      onError?.(msg);
      setLoading(false);
      onProcessingChange?.(false);
    }
  }

  return (
    <Button
      type="button"
      className="w-full"
      onClick={handlePay}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Pay with card (Stripe)
    </Button>
  );
}
