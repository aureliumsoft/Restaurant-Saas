'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  defaultCountryForCurrency,
  defaultCurrencyForCountry,
  RESTAURANT_COUNTRY_OPTIONS,
  RESTAURANT_CURRENCY_OPTIONS,
  type RestaurantCountryCode,
  type RestaurantCurrencyCode,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import { formatCurrency } from '@/lib/format-money';
import { useOptionalRestaurantRegionalContext } from '@/components/layout/restaurant-regional-provider';
import {
  revalidateStaffBootstrap,
  selectStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';

export function RestaurantRegionalSettingsCard() {
  const regionalContext = useOptionalRestaurantRegionalContext();
  const { data, isLoading: bootstrapLoading } = useStaffBootstrapSWR();
  const bootstrap = selectStaffBootstrap(data);
  const { regional, loading: regionalLoading } = useOwnerRestaurantRegional();
  const loading = bootstrapLoading || regionalLoading;
  const hasRestaurant = Boolean(bootstrap?.restaurant);
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState<RestaurantCurrencyCode>('EUR');
  const [countryCode, setCountryCode] = useState<RestaurantCountryCode>('ES');

  useEffect(() => {
    if (loading) return;
    setCurrencyCode(regional.currencyCode);
    setCountryCode(regional.countryCode);
  }, [loading, regional.currencyCode, regional.countryCode]);

  function handleCurrencyChange(next: RestaurantCurrencyCode) {
    setCurrencyCode(next);
    setCountryCode(defaultCountryForCurrency(next));
  }

  function handleCountryChange(next: RestaurantCountryCode) {
    setCountryCode(next);
    setCurrencyCode(defaultCurrencyForCountry(next));
  }

  async function handleSave() {
    if (!navigator.onLine) {
      toast.error('You are offline. Please check your internet connection.');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.patch<{ data: RestaurantRegionalSettings }>(
        '/api/restaurant/regional',
        { currencyCode, countryCode }
      );
      const d = res.data?.data;
      if (d) {
        setCurrencyCode(d.currencyCode);
        setCountryCode(d.countryCode);
      }
      toast.success('Currency and country saved.');
      regionalContext?.refresh();
      void revalidateStaffBootstrap();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      const flat = err.response?.data?.error;
      if (flat && typeof flat === 'object' && 'fieldErrors' in flat) {
        const fe = (flat as { fieldErrors?: Record<string, string[]> })
          .fieldErrors;
        const msg = fe
          ? Object.values(fe)
              .flat()
              .filter(Boolean)
              .join(' ')
          : '';
        toast.error(msg || 'Could not save regional settings.');
      } else {
        toast.error('Could not save regional settings.');
      }
    } finally {
      setSaving(false);
    }
  }

  const preview = formatCurrency(1234.5, { currencyCode, countryCode });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading currency and country…
        </CardContent>
      </Card>
    );
  }

  if (!hasRestaurant) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currency &amp; country</CardTitle>
        <CardDescription>
          Sets how prices appear in POS, kiosk, online ordering, and receipts.
          PayPal and Stripe use this currency for customer payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="restaurant-currency">Currency</Label>
          <Select
            value={currencyCode}
            onValueChange={(v) =>
              handleCurrencyChange(v as RestaurantCurrencyCode)
            }
          >
            <SelectTrigger id="restaurant-currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {RESTAURANT_CURRENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="restaurant-country">Country</Label>
          <Select
            value={countryCode}
            onValueChange={(v) =>
              handleCountryChange(v as RestaurantCountryCode)
            }
          >
            <SelectTrigger id="restaurant-country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {RESTAURANT_COUNTRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Preview: <span className="font-medium text-foreground">{preview}</span>
        </p>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}
