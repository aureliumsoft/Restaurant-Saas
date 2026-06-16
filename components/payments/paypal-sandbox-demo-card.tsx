'use client';

import { useState } from 'react';
import { Copy, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { sandboxDemoCardForCurrency } from '@/lib/paypal-sandbox-demo-cards';
import { cn } from '@/lib/utils';

type Props = {
  currency?: string;
  className?: string;
  /** Shown on SaaS subscription checkout (guest card in PayPal popup). */
  variant?: 'subscription' | 'default';
};

async function copyValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

function DetailRow({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono font-medium tabular-nums">
        {value}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label={`Copy ${label}`}
          onClick={() => copyValue(copyLabel ?? label, value)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </span>
    </div>
  );
}

export function PayPalSandboxDemoCard({
  currency = 'EUR',
  className,
  variant = 'default',
}: Props) {
  const [open, setOpen] = useState(true);
  const card = sandboxDemoCardForCurrency(currency);
  const billing = card.billing;

  return (
    <div
      className={cn(
        'rounded-md border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30',
        className
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-amber-950 dark:text-amber-100"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
          PayPal sandbox demo card
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 opacity-70" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        )}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-amber-200/60 px-3 py-3 dark:border-amber-900/40">
          {variant === 'subscription' ? (
            <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
              Click <strong>Subscribe</strong>, then choose{' '}
              <strong>Pay with Debit or Credit Card</strong> in the PayPal window.
              Type these values into PayPal&apos;s secure fields (auto-fill is not
              allowed).
            </p>
          ) : (
            <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
              Use these sandbox card details in PayPal&apos;s secure card fields.
            </p>
          )}

          <div className="space-y-1.5 rounded-md bg-white/60 p-2.5 dark:bg-black/20">
            <DetailRow label="Card" value={`${card.brand} ${card.number}`} copyLabel="Card number" />
            <DetailRow label="Expiry" value={card.expiry} />
            <DetailRow label="CVV" value={card.cvv} />
            <DetailRow label="Name" value={card.name} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-amber-950/80 dark:text-amber-100/80">
              Billing address (if asked)
            </p>
            <div className="space-y-1 rounded-md bg-white/60 p-2.5 text-xs dark:bg-black/20">
              <DetailRow label="Street" value={billing.line1} />
              <DetailRow label="City" value={billing.city} />
              {billing.state ? (
                <DetailRow label="State" value={billing.state} />
              ) : null}
              <DetailRow label="Postal" value={billing.postalCode} />
              <DetailRow label="Country" value={billing.countryCode} />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-amber-300/80 bg-white/80 text-xs dark:border-amber-800 dark:bg-amber-950/50"
            onClick={() => copyValue('Card number', card.number)}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy card number
          </Button>
        </div>
      ) : null}
    </div>
  );
}
