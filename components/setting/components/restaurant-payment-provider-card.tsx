'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { PremiumGate } from '@/components/premium/premium-gate';

type Provider = 'NONE' | 'PAYPAL' | 'STRIPE' | 'WALLETS';

type PaymentProviderState = {
  restaurantId?: string;
  provider: Provider;
  paymentTerminalIp: string | null;
  paypal: { configured: boolean; verified: boolean };
  stripe: { configured: boolean; verified: boolean };
  jazzcash: { configured: boolean; verified: boolean };
  easypaisa: { configured: boolean; verified: boolean };
};

function walletLabel(
  state: PaymentProviderState | null,
  t: (key: string) => string
): string {
  const notConfigured = ` (${t('settings.cards.paymentProvider.notConfigured')})`;
  if (!state) return notConfigured;
  const parts: string[] = [];
  if (state.jazzcash.verified) parts.push('JazzCash');
  else if (state.jazzcash.configured) {
    parts.push(
      `JazzCash ${t('settings.cards.paymentProvider.needsVerification')}`
    );
  }
  if (state.easypaisa.verified) parts.push('Easypaisa');
  else if (state.easypaisa.configured) {
    parts.push(
      `Easypaisa ${t('settings.cards.paymentProvider.needsVerification')}`
    );
  }
  if (parts.length === 0) return notConfigured;
  return ` (${parts.join(' + ')})`;
}

export function RestaurantPaymentProviderCard({
  cardPaymentsEnabled = true,
  onlinePaymentsLocked = false,
  terminalPaymentLocked = false,
}: {
  cardPaymentsEnabled?: boolean;
  onlinePaymentsLocked?: boolean;
  terminalPaymentLocked?: boolean;
}) {
  const { t } = useTranslation();
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
        if (!cancelled) {
          toast.error(t('settings.cards.paymentProvider.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  async function handleProviderChange(next: Provider) {
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
      toast.success(t('settings.cards.paymentProvider.paymentMethodUpdated'));
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : t('settings.cards.paymentProvider.updateFailed');
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
      toast.success(t('settings.cards.paymentProvider.terminalIpSaved'));
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : t('settings.cards.paymentProvider.terminalIpSaveFailed');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
          {t('settings.cards.paymentProvider.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.cards.paymentProvider.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PremiumGate
          locked={onlinePaymentsLocked}
          variant="crown"
          className="space-y-5"
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t('settings.cards.paymentProvider.activeGateway')}
            </p>
            <Select
              value={provider}
              onValueChange={(value) => handleProviderChange(value as Provider)}
              disabled={saving}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue
                  placeholder={t(
                    'settings.cards.paymentProvider.selectPaymentMethod'
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">
                  {t('settings.cards.paymentProvider.noneCashOnly')}
                </SelectItem>
                <SelectItem value="PAYPAL">
                  PayPal
                  {state?.paypal.verified
                    ? ` (${t('settings.cards.paymentProvider.configured')})`
                    : state?.paypal.configured
                      ? ` (${t('settings.cards.paymentProvider.needsVerification')})`
                      : ` (${t('settings.cards.paymentProvider.notConfigured')})`}
                </SelectItem>
                <SelectItem value="STRIPE">
                  Stripe
                  {state?.stripe.verified
                    ? ` (${t('settings.cards.paymentProvider.configured')})`
                    : state?.stripe.configured
                      ? ` (${t('settings.cards.paymentProvider.needsVerification')})`
                      : ` (${t('settings.cards.paymentProvider.notConfigured')})`}
                </SelectItem>
                <SelectItem value="WALLETS">
                  {t('settings.cards.paymentProvider.walletsLabel')}
                  {walletLabel(state, t)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/payments/paypal')}
            >
              {t('settings.cards.paymentProvider.configurePaypal')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/payments/stripe')}
            >
              {t('settings.cards.paymentProvider.configureStripe')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/payments/jazzcash')}
            >
              {t('settings.cards.paymentProvider.configureJazzcash')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/settings/payments/easypaisa')}
            >
              {t('settings.cards.paymentProvider.configureEasypaisa')}
            </Button>
          </div>
        </PremiumGate>

        {cardPaymentsEnabled ? (
          <PremiumGate
            locked={terminalPaymentLocked}
            variant="crown"
            className="space-y-2"
          >
            <label className="text-sm font-medium" htmlFor="payment-terminal-ip">
              {t('settings.cards.paymentProvider.terminalIpLabel')}
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
              <Button
                type="button"
                onClick={() => void handleSaveTerminalIp()}
                disabled={saving}
              >
                {t('settings.cards.paymentProvider.saveTerminalIp')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settings.cards.paymentProvider.terminalIpHint')}
            </p>
          </PremiumGate>
        ) : null}
      </CardContent>
    </Card>
  );
}
