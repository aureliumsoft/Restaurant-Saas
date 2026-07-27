'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

function submitHostedForm(
  gatewayUrl: string,
  fields: Record<string, string>
): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = gatewayUrl;
  form.style.display = 'none';
  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export type EasypaisaCheckoutButtonProps = {
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

export function EasypaisaCheckoutButton({
  amount,
  currency = 'PKR',
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
}: EasypaisaCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    onProcessingChange?.(true);
    try {
      const res = await fetch('/api/easypaisa/create-order-checkout', {
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
        gatewayUrl?: string;
        fields?: Record<string, string>;
        error?: unknown;
      };
      if (!res.ok || !body.gatewayUrl || !body.fields) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'Could not start Easypaisa checkout.'
        );
      }
      submitHostedForm(body.gatewayUrl, body.fields);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Could not start Easypaisa checkout.';
      onError?.(msg);
      setLoading(false);
      onProcessingChange?.(false);
    }
  }

  return (
    <Button
      type="button"
      className="w-full"
      variant="secondary"
      onClick={handlePay}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Pay with Easypaisa
    </Button>
  );
}
