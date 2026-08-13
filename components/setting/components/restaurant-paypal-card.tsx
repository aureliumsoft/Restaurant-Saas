'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { CreditCard, ExternalLink, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type PayPalStatusDto = {
  restaurantId: string;
  trackingId: string;
  paypalMerchantId: string | null;
  permissionsGranted: boolean;
  accountStatus: string | null;
  paymentsReceivable: boolean;
  primaryEmail: string | null;
  countryCode: string | null; 
  currencyCode: string | null;
  onboardedAt: string | null;
  paymentsReady: boolean;
};

function maskMerchantId(id: string | null): string {
  if (!id) return '—';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function RestaurantPayPalCard() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [partnerConfigured, setPartnerConfigured] = useState(true);
  const [integration, setIntegration] = useState<PayPalStatusDto | null>(null);

  const loadStatus = useCallback(async (refresh = false) => {
    try {
      const res = await axios.get<{
        data: PayPalStatusDto | null;
        partnerConfigured?: boolean;
      }>(`/api/restaurant/paypal/status${refresh ? '?refresh=1' : ''}`);
      setIntegration(res.data?.data ?? null);
      setPartnerConfigured(res.data?.partnerConfigured !== false);
    } catch {
      toast.error('Could not load PayPal status.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadStatus();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await axios.post<{ data?: { actionUrl?: string } }>(
        '/api/restaurant/paypal/onboard'
      );
      const url = res.data?.data?.actionUrl;
      if (!url) {
        throw new Error('Missing PayPal onboarding URL');
      }
      window.location.href = url;
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : 'Could not start PayPal onboarding.';
      toast.error(msg);
      setConnecting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadStatus(true);
      toast.success('PayPal status updated.');
    } finally {
      setRefreshing(false);
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

  const ready = integration?.paymentsReady === true;
  const pending =
    integration?.paypalMerchantId &&
    !integration.paymentsReceivable;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" aria-hidden />
          Online payments (PayPal)
        </CardTitle>
        <CardDescription>
          Connect your PayPal Business account so customers pay you directly for
          online orders. Your platform subscription is billed separately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!partnerConfigured ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            PayPal partner mode is not configured on this platform yet. Contact
            support to enable merchant payments.
          </p>
        ) : null}

        {ready ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-100">
            Payments enabled — customer checkout deposits funds to your PayPal
            account.
          </div>
        ) : pending ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            PayPal account linked but not fully verified yet. Complete any
            remaining steps in PayPal, then refresh status.
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
            Not connected — online customers cannot pay by PayPal until you
            connect a PayPal Business account.
          </div>
        )}

        {integration?.paypalMerchantId ? (
          <dl className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between gap-4">
              <dt>Merchant ID</dt>
              <dd className="font-mono">
                {maskMerchantId(integration.paypalMerchantId)}
              </dd>
            </div>
            {integration.primaryEmail ? (
              <div className="flex justify-between gap-4">
                <dt>PayPal email</dt>
                <dd>{integration.primaryEmail}</dd>
              </div>
            ) : null}
            {integration.accountStatus ? (
              <div className="flex justify-between gap-4">
                <dt>Status</dt>
                <dd>{integration.accountStatus}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleConnect}
          disabled={!partnerConfigured || connecting}
        >
          {connecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          {integration?.paypalMerchantId ? 'Reconnect PayPal' : 'Connect PayPal'}
        </Button>
        {integration?.paypalMerchantId ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh status
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
