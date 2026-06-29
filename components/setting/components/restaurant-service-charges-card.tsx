'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Percent, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type {
  RestaurantServiceCharges,
  ServiceChargeChannelConfig,
} from '@/lib/restaurant-service-charge';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { getRestaurantCurrencySymbol } from '@/lib/restaurant-regional';

type ChannelKey = keyof RestaurantServiceCharges;

const CHANNELS: {
  key: ChannelKey;
  label: string;
  description: string;
}[] = [
  {
    key: 'pos',
    label: 'POS',
    description: 'Added at POS checkout and on printed receipts.',
  },
  {
    key: 'kiosk',
    label: 'Kiosk',
    description: 'Shown at kiosk checkout before payment.',
  },
  {
    key: 'online',
    label: 'Online',
    description: 'Shown on online cart and checkout pages.',
  },
];

function emptyCharges(): RestaurantServiceCharges {
  return {
    pos: { enabled: false, amount: 0 },
    kiosk: { enabled: false, amount: 0 },
    online: { enabled: false, amount: 0 },
  };
}

function ChannelToggle({
  label,
  description,
  value,
  onChange,
  chargeAmountLabel,
}: {
  label: string;
  description: string;
  value: ServiceChargeChannelConfig;
  onChange: (next: ServiceChargeChannelConfig) => void;
  chargeAmountLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-label={`${label} service charge`}
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            value.enabled ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full bg-background shadow transition-transform',
              value.enabled ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>
      <div className="mt-4 space-y-2">
        <Label htmlFor={`${label}-charge-amount`}>{chargeAmountLabel}</Label>
        <Input
          id={`${label}-charge-amount`}
          type="number"
          min={0}
          max={999.99}
          step={0.01}
          inputMode="decimal"
          disabled={!value.enabled}
          value={Number.isFinite(value.amount) ? String(value.amount) : '0'}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            onChange({
              ...value,
              amount: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            });
          }}
          placeholder="0.99"
        />
      </div>
    </div>
  );
}

export function RestaurantServiceChargesCard() {
  const { regional } = useOwnerRestaurantRegional();
  const chargeAmountLabel = `Charge amount (${getRestaurantCurrencySymbol(regional.currencyCode)})`;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [charges, setCharges] = useState<RestaurantServiceCharges>(emptyCharges);

  const loadCharges = useCallback(async () => {
    const res = await axios.get<{ data: RestaurantServiceCharges }>(
      '/api/restaurant/service-charges'
    );
    setCharges(res.data?.data ?? emptyCharges());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadCharges();
      } catch {
        if (!cancelled) toast.error('Could not load service charges.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCharges]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await axios.patch<{ data: RestaurantServiceCharges }>(
        '/api/restaurant/service-charges',
        charges
      );
      setCharges(res.data?.data ?? charges);
      toast.success('Service charges saved.');
    } catch {
      toast.error('Could not save service charges.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" aria-hidden />
          System service charges
        </CardTitle>
        <CardDescription>
          Set a flat service charge per sales channel. When enabled, the amount
          is added to the customer total at checkout and on bills.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {CHANNELS.map((channel) => (
          <ChannelToggle
            key={channel.key}
            label={channel.label}
            description={channel.description}
            value={charges[channel.key]}
            chargeAmountLabel={chargeAmountLabel}
            onChange={(next) =>
              setCharges((prev) => ({ ...prev, [channel.key]: next }))
            }
          />
        ))}
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save service charges
        </Button>
      </CardFooter>
    </Card>
  );
}
