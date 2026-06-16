'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { extractApiErrorFromBody, extractApiErrorMessage } from '@/lib/extract-api-error';
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
import { Button } from '@/components/ui/button';

type TestStatus = 'idle' | 'passed' | 'failed';

type StripeFormState = {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: 'test' | 'live';
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  verified: boolean;
};

export default function StripeCredentialsPage() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [form, setForm] = useState<StripeFormState>({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    mode: 'test',
    hasSecretKey: false,
    hasWebhookSecret: false,
    verified: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stripeRes, providerRes] = await Promise.all([
          axios.get<{
            data?: {
              publishableKey?: string | null;
              mode?: string | null;
              hasSecretKey?: boolean;
              hasWebhookSecret?: boolean;
              verified?: boolean;
            };
          }>('/api/restaurant/payments/stripe'),
          axios.get<{ data?: { restaurantId?: string } }>(
            '/api/restaurant/payment-provider'
          ),
        ]);
        const data = stripeRes.data?.data;
        if (!cancelled) {
          setRestaurantId(providerRes.data?.data?.restaurantId ?? null);
          if (data) {
            setForm((prev) => ({
              ...prev,
              publishableKey: data.publishableKey ?? '',
              mode: data.mode === 'live' ? 'live' : 'test',
              hasSecretKey: data.hasSecretKey === true,
              hasWebhookSecret: data.hasWebhookSecret === true,
              verified: data.verified === true,
            }));
            if (data.verified === true) {
              setTestStatus('passed');
            }
          }
        }
      } catch {
        if (!cancelled) toast.error('Could not load Stripe settings.');
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
        '/api/restaurant/payments/stripe/test',
        {
          publishableKey: form.publishableKey,
          secretKey: form.secretKey || undefined,
          webhookSecret: form.webhookSecret || null,
          mode: form.mode,
        },
        { validateStatus: (status) => status < 500 }
      );
      if (res.status >= 200 && res.status < 300) {
        setTestStatus('passed');
        setForm((prev) => ({ ...prev, verified: true }));
        toast.success('Stripe connection successful.');
        return;
      }
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(
        extractApiErrorFromBody(res.data, 'Stripe connection test failed.')
      );
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(extractApiErrorMessage(e, 'Stripe connection test failed.'));
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await axios.put('/api/restaurant/payments/stripe', {
        publishableKey: form.publishableKey,
        secretKey: form.secretKey || undefined,
        webhookSecret: form.webhookSecret || null,
        mode: form.mode,
      });
      const data = res.data?.data;
      setForm((prev) => ({
        ...prev,
        secretKey: '',
        webhookSecret: '',
        hasSecretKey: data?.hasSecretKey === true,
        hasWebhookSecret: data?.hasWebhookSecret === true,
        verified: data?.verified === true,
      }));
      setTestStatus('passed');
      toast.success('Stripe credentials saved.');
    } catch (e: unknown) {
      setTestStatus('failed');
      setForm((prev) => ({ ...prev, verified: false }));
      toast.error(extractApiErrorMessage(e, 'Could not save Stripe credentials.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Remove Stripe credentials for this restaurant?')) return;
    try {
      await axios.delete('/api/restaurant/payments/stripe');
      setForm({
        publishableKey: '',
        secretKey: '',
        webhookSecret: '',
        mode: 'test',
        hasSecretKey: false,
        hasWebhookSecret: false,
        verified: false,
      });
      setTestStatus('idle');
      toast.success('Stripe credentials removed.');
    } catch {
      toast.error('Could not remove Stripe credentials.');
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
      ? `${window.location.origin}/api/webhooks/stripe/${restaurantId}`
      : '/api/webhooks/stripe/{your-restaurant-id}';

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
          <CardTitle>Stripe configuration</CardTitle>
          <CardDescription>
            Enter API keys from your Stripe Dashboard. Payments go directly to
            your Stripe account.
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
              Connection failed. Check your Stripe credentials and test again.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="stripe-publishable-key">Publishable key</Label>
            <Input
              id="stripe-publishable-key"
              value={form.publishableKey}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, publishableKey: e.target.value }));
              }}
              placeholder="pk_test_..."
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripe-secret-key">Secret key</Label>
            <Input
              id="stripe-secret-key"
              type="password"
              value={form.secretKey}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, secretKey: e.target.value }));
              }}
              placeholder={
                form.hasSecretKey
                  ? 'Leave blank to keep existing secret'
                  : 'sk_test_... (required on first save)'
              }
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(value: 'test' | 'live') => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, mode: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripe-webhook-secret">Webhook signing secret</Label>
            <Input
              id="stripe-webhook-secret"
              type="password"
              value={form.webhookSecret}
              onChange={(e) => {
                setTestStatus('idle');
                setForm((prev) => ({ ...prev, webhookSecret: e.target.value }));
              }}
              placeholder={
                form.hasWebhookSecret
                  ? 'Leave blank to keep existing secret'
                  : 'whsec_... (recommended)'
              }
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Register webhook URL: <code className="text-xs">{webhookUrl}</code>
              {' '}
              with event <code>checkout.session.completed</code>.
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
          {form.hasSecretKey ? (
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