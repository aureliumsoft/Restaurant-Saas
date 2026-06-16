'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PAYPAL_BUYER_COUNTRIES,
  defaultPayPalCountryForCurrency,
} from '@/lib/paypal-buyer-countries';
import { extractApiErrorFromBody, extractApiErrorMessage } from '@/lib/extract-api-error';

type TestStatus = 'idle' | 'passed' | 'failed';

type PayPalFormState = {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  mode: 'sandbox' | 'live';
  currency: string;
  countryCode: string;
  hasClientSecret: boolean;
  verified: boolean;
};

export default function PayPalCredentialsPage() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [form, setForm] = useState<PayPalFormState>({
    clientId: '',
    clientSecret: '',
    webhookId: '',
    mode: 'sandbox',
    currency: 'EUR',
    countryCode: 'DE',
    hasClientSecret: false,
    verified: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [paypalRes, providerRes] = await Promise.all([
          axios.get<{
            data?: {
              clientId?: string | null;
              webhookId?: string | null;
              mode?: string | null;
              currency?: string | null;
              countryCode?: string | null;
              hasClientSecret?: boolean;
              verified?: boolean;
            };
          }>('/api/restaurant/payments/paypal'),
          axios.get<{ data?: { restaurantId?: string } }>(
            '/api/restaurant/payment-provider'
          ),
        ]);
        const data = paypalRes.data?.data;
        if (!cancelled) {
          setRestaurantId(providerRes.data?.data?.restaurantId ?? null);
          if (data) {
            setForm((prev) => ({
              ...prev,
              clientId: data.clientId ?? '',
              webhookId: data.webhookId ?? '',
              mode: data.mode === 'live' ? 'live' : 'sandbox',
              currency: data.currency ?? 'EUR',
              countryCode: data.countryCode ?? 'DE',
              hasClientSecret: data.hasClientSecret === true,
              verified: data.verified === true,
            }));
            if (data.verified === true) {
              setTestStatus('passed');
            }
          }
        }
      } catch {
        if (!cancelled) toast.error('Could not load PayPal settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTest() {
    setTesting(true);
    try {
      const res = await axios.post(
        '/api/restaurant/payments/paypal/test',
        {
          clientId: form.clientId,
          clientSecret: form.clientSecret || undefined,
          webhookId: form.webhookId || null,
          mode: form.mode,
          currency: form.currency,
          countryCode: form.countryCode,
        },
        { validateStatus: (status) => status < 500 }
      );
      if (res.status >= 200 && res.status < 300) {
        setTestStatus('passed');
        setForm((prev) => ({ ...prev, verified: true }));
        toast.success('PayPal connection successful.');
        return;
      }
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorFromBody(res.data, 'PayPal connection test failed.')
      );
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(extractApiErrorMessage(e, 'PayPal connection test failed.'));
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await axios.put('/api/restaurant/payments/paypal', {
        clientId: form.clientId,
        clientSecret: form.clientSecret || undefined,
        webhookId: form.webhookId || null,
        mode: form.mode,
        currency: form.currency,
        countryCode: form.countryCode,
      });
      const data = res.data?.data;
      setForm((prev) => ({
        ...prev,
        clientSecret: '',
        hasClientSecret: data?.hasClientSecret === true,
        verified: data?.verified === true,
      }));
      setTestStatus('passed');
      toast.success('PayPal credentials saved.');
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(extractApiErrorMessage(e, 'Could not save PayPal credentials.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Remove PayPal credentials for this restaurant?')) return;
    try {
      await axios.delete('/api/restaurant/payments/paypal');
      setForm({
        clientId: '',
        clientSecret: '',
        webhookId: '',
        mode: 'sandbox',
        currency: 'EUR',
        countryCode: 'DE',
        hasClientSecret: false,
        verified: false,
      });
      setTestStatus('idle');
      toast.success('PayPal credentials removed.');
    } catch {
      toast.error('Could not remove PayPal credentials.');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const webhookUrl =
    typeof window !== 'undefined' && restaurantId
      ? `${window.location.origin}/api/webhooks/paypal/${restaurantId}`
      : '/api/webhooks/paypal/{your-restaurant-id}';

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Button type="button" variant="ghost" className="gap-2" asChild>
        <Link href="/settings?section=payments">
          <ArrowLeft className="h-4 w-4" />
          Back to payment methods
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>PayPal configuration</CardTitle>
          <CardDescription>
            Enter API credentials from your PayPal Developer app. Payments go
            directly to your PayPal Business account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.verified && testStatus !== 'failed' ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              Credentials verified and saved.
            </p>
          ) : null}

          {testStatus === 'failed' ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              Connection failed. Check your PayPal credentials and test again.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="paypal-client-id">Client ID</Label>
            <Input
              id="paypal-client-id"
              value={form.clientId}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, clientId: e.target.value }));
              }}
              placeholder="From PayPal Developer Dashboard"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paypal-client-secret">Client secret</Label>
            <Input
              id="paypal-client-secret"
              type="password"
              value={form.clientSecret}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, clientSecret: e.target.value }));
              }}
              placeholder={
                form.hasClientSecret
                  ? 'Leave blank to keep existing secret'
                  : 'Required on first save'
              }
              autoComplete="new-password"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={form.mode}
                onValueChange={(value: 'sandbox' | 'live') => {
                  setTestStatus('idle');
                  setForm((prev) => ({ ...prev, mode: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (test)</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paypal-currency">Currency</Label>
              <Input
                id="paypal-currency"
                value={form.currency}
                onChange={(e) => {
                  const nextCurrency = e.target.value.toUpperCase();
                  setTestStatus('idle');
                  setForm((prev) => ({
                    ...prev,
                    currency: nextCurrency,
                    countryCode: defaultPayPalCountryForCurrency(nextCurrency),
                  }));
                }}
                maxLength={3}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default country (checkout)</Label>
            <Select
              value={form.countryCode}
              onValueChange={(value) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, countryCode: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {PAYPAL_BUYER_COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.label} ({country.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pre-selects the customer&apos;s country in PayPal card and guest
              checkout.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paypal-webhook-id">Webhook ID (recommended)</Label>
            <Input
              id="paypal-webhook-id"
              value={form.webhookId}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, webhookId: e.target.value }));
              }}
              placeholder="WH-..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Register webhook URL: <code className="text-xs">{webhookUrl}</code>
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing || testStatus === 'passed'}
            className={
              testStatus === 'passed'
                ? 'border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800 disabled:opacity-100'
                : testStatus === 'failed'
                  ? 'border-red-600 text-red-700 hover:bg-red-50 hover:text-red-800'
                  : undefined
            }
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : testStatus === 'passed' ? (
              <Check className="mr-2 h-4 w-4" aria-hidden />
            ) : testStatus === 'failed' ? (
              <X className="mr-2 h-4 w-4" aria-hidden />
            ) : null}
            {testStatus === 'passed'
              ? 'Connection verified'
              : testStatus === 'failed'
                ? 'Connection failed'
                : 'Test connection'}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save credentials
          </Button>
          {form.hasClientSecret ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
