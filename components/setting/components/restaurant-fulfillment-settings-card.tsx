'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { CreditCard, Loader2, RefreshCcw, ShoppingBag, Truck, UtensilsCrossed } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RestaurantFulfillmentSettings } from '@/lib/restaurant-fulfillment-settings';
import { DEFAULT_RESTAURANT_FULFILLMENT_SETTINGS } from '@/lib/restaurant-fulfillment-settings';
import { revalidateStaffBootstrap } from '@/hooks/use-staff-bootstrap-swr';

const CHANNELS: {
  key: keyof RestaurantFulfillmentSettings;
  label: string;
  description: string;
  icon: typeof Truck;
}[] = [
  {
    key: 'deliveryEnabled',
    label: 'Delivery',
    description:
      'Delivery orders in POS, online store, and sales. When off, delivery options are hidden.',
    icon: Truck,
  },
  {
    key: 'dineInEnabled',
    label: 'Dine in',
    description:
      'Table and dine-in orders in POS, kiosk, and the Tables page. When off, dine-in options are hidden.',
    icon: UtensilsCrossed,
  },
  {
    key: 'cardPaymentsEnabled',
    label: 'Card payments',
    description:
      'Card terminal payments in POS and kiosk. Does not affect online store or subscription billing.',
    icon: CreditCard,
  },
];

function ChannelToggle({
  label,
  description,
  icon: Icon,
  enabled,
  saving,
  onToggle,
}: {
  label: string;
  description: string;
  icon: typeof Truck;
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${label} enabled`}
          disabled={saving}
          onClick={onToggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50',
            enabled ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full bg-background shadow transition-transform',
              enabled ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>
    </div>
  );
}

export function RestaurantFulfillmentSettingsCard() {
  const [settings, setSettings] = useState<RestaurantFulfillmentSettings>(
    DEFAULT_RESTAURANT_FULFILLMENT_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<
    keyof RestaurantFulfillmentSettings | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{ data: RestaurantFulfillmentSettings }>(
        '/api/restaurant/fulfillment-settings'
      );
      setSettings(res.data.data ?? DEFAULT_RESTAURANT_FULFILLMENT_SETTINGS);
    } catch {
      toast.error('Could not load channel settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: keyof RestaurantFulfillmentSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSavingKey(key);
    try {
      const res = await axios.patch<{ data: RestaurantFulfillmentSettings }>(
        '/api/restaurant/fulfillment-settings',
        { [key]: next[key] }
      );
      setSettings(res.data.data ?? next);
      void revalidateStaffBootstrap();
      toast.success(
        `${CHANNELS.find((c) => c.key === key)?.label ?? 'Setting'} ${
          next[key] ? 'enabled' : 'disabled'
        }.`
      );
    } catch {
      toast.error('Could not update setting.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Order channels
          </div>
          <Button variant="secondary" size="icon" disabled={loading} onClick={() => void load()}>
            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
          </Button>
        </CardTitle>
        <CardDescription>
          Turn delivery, dine-in, or in-person card payments on or off. Disabled
          channels are hidden in POS, kiosk, online store, and related pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          CHANNELS.map((channel) => (
            <ChannelToggle
              key={channel.key}
              label={channel.label}
              description={channel.description}
              icon={channel.icon}
              enabled={settings[channel.key]}
              saving={savingKey === channel.key}
              onToggle={() => void toggle(channel.key)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
