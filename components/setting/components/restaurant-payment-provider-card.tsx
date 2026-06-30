'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type PaymentProviderState = {
  restaurantId?: string;
  provider: 'NONE' | 'PAYPAL' | 'STRIPE';
  paymentTerminalIp: string | null;
  paypal: { configured: boolean; verified: boolean };
  stripe: { configured: boolean; verified: boolean };
};

export function RestaurantPaymentProviderCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<PaymentProviderState | null>(null);
  const [terminalIp, setTerminalIp] = useState('');

  const load = useCallback(async () => {
    const res = await axios.get<{ data?: PaymentProviderState }>(
      '/api/restaurant/payment-provider'
    );
    const nextState = res.data?.data ?? null;
    setState(nextState);
    setTerminalIp(nextState?.paymentTerminalIp ?? '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) toast.error('Could not load payment settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleProviderChange(next: 'NONE' | 'PAYPAL' | 'STRIPE') {
    if (!state || next === state.provider) return;
    setSaving(true);
    try {
      const res = await axios.put<{ data?: PaymentProviderState }>(
        '/api/restaurant/payment-provider',
        { provider: next, paymentTerminalIp: terminalIp.trim() || null }
      );
      const nextState = res.data?.data ?? null;
      setState(nextState);
      setTerminalIp(nextState?.paymentTerminalIp ?? '');
      toast.success('Payment method updated.');
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : 'Could not update payment method.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTerminalIp() {
    if (!state) return;
    setSaving(true);
    try {
      const res = await axios.put<{ data?: PaymentProviderState }>(
        '/api/restaurant/payment-provider',
        {
          provider: state.provider,
          paymentTerminalIp: terminalIp.trim() || null,
        }
      );
      const nextState = res.data?.data ?? null;
      setState(nextState);
      setTerminalIp(nextState?.paymentTerminalIp ?? '');
      toast.success('Payment terminal IP saved.');
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : 'Could not save payment terminal IP.';
      toast.error(msg);
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

  const provider = state?.provider ?? 'NONE';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" aria-hidden />
          Customer payment method
        </CardTitle>
        <CardDescription>
          Choose one gateway for online customer payments. Configure credentials
          on the PayPal or Stripe setup page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">Active payment gateway</p>
          <Select
            value={provider}
            onValueChange={(value) =>
              handleProviderChange(value as 'NONE' | 'PAYPAL' | 'STRIPE')
            }
            disabled={saving}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">None — cash / in-person only</SelectItem>
              <SelectItem value="PAYPAL">
                PayPal
                {state?.paypal.verified
                  ? ' (configured)'
                  : state?.paypal.configured
                    ? ' (needs verification)'
                    : ' (not configured)'}
              </SelectItem>
              <SelectItem value="STRIPE">
                Stripe
                {state?.stripe.verified
                  ? ' (configured)'
                  : state?.stripe.configured
                    ? ' (needs verification)'
                    : ' (not configured)'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="payment-terminal-ip">
            Payment terminal IP
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="payment-terminal-ip"
              value={terminalIp}
              onChange={(e) => setTerminalIp(e.target.value)}
              placeholder="192.168.1.50"
              disabled={saving}
              className="max-w-sm"
            />
            <Button type="button" onClick={() => void handleSaveTerminalIp()} disabled={saving}>
              Save terminal IP
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Used for card-terminal integrations and terminal-based payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/settings/payments/paypal')}
          >
            Configure PayPal
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/settings/payments/stripe')}
          >
            Configure Stripe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
