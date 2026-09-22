'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ChefHat,
  CreditCard,
  Globe,
  Loader2,
  Monitor,
  RefreshCcw,
  ShoppingBag,
  Truck,
  Tv,
  UtensilsCrossed,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
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
  iconColor: string;
  iconBg: string;
}[] = [
    {
      key: 'deliveryEnabled',
      label: 'Delivery',
      description:
        'Delivery orders in POS, online store, and sales. When off, delivery options are hidden.',
      icon: Truck,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      key: 'dineInEnabled',
      label: 'Dine in',
      description:
        'Table and dine-in orders in POS, kiosk, and the Tables page. When off, dine-in options are hidden.',
      icon: UtensilsCrossed,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      key: 'cardPaymentsEnabled',
      label: 'Card payments',
      description:
        'Card terminal payments in POS and kiosk. Does not affect online store or subscription billing.',
      icon: CreditCard,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      key: 'websiteEnabled',
      label: 'Website',
      description:
        'Customer online store & ordering website. When off, website links are hidden and online store access is blocked.',
      icon: Globe,
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-500/10 border-sky-500/20',
    },
    {
      key: 'kioskEnabled',
      label: 'Kiosk',
      description:
        'In-store self-service ordering kiosk. When off, kiosk links are hidden and kiosk access is blocked.',
      icon: Monitor,
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      key: 'kdsEnabled',
      label: 'KDS (Kitchen Screen)',
      description:
        'Kitchen Display System & live ticket screen. When off, KDS modules are hidden, POS checkout directly completes orders, and working orders are managed via POS.',
      icon: ChefHat,
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-500/10 border-orange-500/20',
    },
    {
      key: 'orderDisplayEnabled',
      label: 'Order Display Screen',
      description:
        'Customer-facing live order queue status screen. When off, the order display module and public screen are blocked.',
      icon: Tv,
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-500/10 border-rose-500/20',
    },
  ];

function ChannelToggleCard({
  label,
  description,
  icon: Icon,
  iconColor,
  iconBg,
  enabled,
  saving,
  onToggle,
}: {
  label: string;
  description: string;
  icon: typeof Truck;
  iconColor: string;
  iconBg: string;
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200',
        enabled
          ? 'border-border/90 bg-card shadow-xs hover:border-primary/40 hover:shadow-sm'
          : 'border-border/40 bg-muted/15 opacity-80 hover:opacity-100 hover:border-border/80'
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                iconBg
              )}
            >
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm tracking-tight text-foreground truncate">
                  {label}
                </p>
                {enabled ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0 font-medium"
                  >
                    {t('settings.cards.fulfillment.active')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-muted-foreground/30 bg-muted/40 text-muted-foreground text-[10px] px-1.5 py-0 font-medium"
                  >
                    Off
                  </Badge>
                )}
              </div>
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
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              enabled ? 'bg-primary' : 'bg-muted'
            )}
          >
            {saving ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-background" />
              </span>
            ) : (
              <span
                className={cn(
                  'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-md transition-transform duration-200',
                  enabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            )}
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function RestaurantFulfillmentSettingsCard() {
  const { t } = useTranslation();
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
        `${CHANNELS.find((c) => c.key === key)?.label ?? 'Setting'} ${next[key] ? 'enabled' : 'disabled'
        }.`
      );
    } catch {
      toast.error('Could not update setting.');
    } finally {
      setSavingKey(null);
    }
  };

  const activeCount = CHANNELS.filter((c) => settings[c.key]).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span>{t('settings.cards.fulfillment.title')}</span>
              {!loading ? (
                <Badge variant="secondary" className="ml-1 text-[11px] font-medium">
                  {activeCount} of {CHANNELS.length} active
                </Badge>

                
              ) : null}
            </CardTitle>
            <CardDescription>
              {t('settings.cards.fulfillment.description')}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            disabled={loading}
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-xl border border-border/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CHANNELS.map((channel) => (
              <ChannelToggleCard
                key={channel.key}
                label={channel.label}
                description={channel.description}
                icon={channel.icon}
                iconColor={channel.iconColor}
                iconBg={channel.iconBg}
                enabled={settings[channel.key]}
                saving={savingKey === channel.key}
                onToggle={() => void toggle(channel.key)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
