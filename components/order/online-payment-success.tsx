'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Copy, Home } from 'lucide-react';
import { toast } from 'react-toastify';

import { WebAppRestaurantTitle } from '@/components/customer-app/web-app-restaurant-title';
import { clearOnlineOrderPreferences } from '@/lib/online-order-preferences';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrderInfo } from '@/components/order/order-types';
import {
  restaurantStorefrontPath,
  restaurantTrackOrderPath,
} from '@/lib/customer-storefront-paths';
import { useOrderInfo } from '@/hooks/use-order-info';
import {
  buildCustomerLightSurfaceVars,
  buildStorefrontThemeVars,
} from '@/lib/restaurant-theme';
import { cn } from '@/lib/utils';

function formatTokenNumber(ticket: number | null): string {
  if (ticket == null || ticket < 0) return '—';
  return `#${String(ticket).padStart(2, '0')}`;
}

type Props = {
  flowOrderId: string;
  trackingOrderId: string | null;
  ticketFromQuery?: number | null;
  sessionId: string | null;
  token?: string | null;
  orderType: 'delivery' | 'pickUp';
  orderInfo?: OrderInfo;
};

export function OnlinePaymentSuccess({
  flowOrderId,
  trackingOrderId,
  ticketFromQuery = null,
  sessionId,
  token,
  orderType,
  orderInfo: initialOrderInfo,
}: Props) {
  const orderInfo = useOrderInfo(flowOrderId, orderType, initialOrderInfo);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paid, setPaid] = useState<boolean | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ticket, setTicket] = useState<number | null>(ticketFromQuery);
  const [resolvedTrackingId, setResolvedTrackingId] = useState<string | null>(
    trackingOrderId
  );
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );
  const [slugFromVerify, setSlugFromVerify] = useState('');
  const verifyStartedRef = useRef(false);

  const slugFromUrl =
    searchParams.get('restaurantSlug')?.trim() ||
    searchParams.get('slug')?.trim() ||
    '';
  const slugForVerify =
    orderInfo?.restaurantSlug?.trim() || slugFromUrl || '';
  const restaurantSlug = slugForVerify || slugFromVerify || '';
  const displayTrackingId = resolvedTrackingId ?? trackingOrderId;
  const storefrontHome = restaurantStorefrontPath(restaurantSlug);

  const pageThemeVars = useMemo(
    () =>
      ({
        ...buildStorefrontThemeVars(themePrimaryColor),
        ...buildCustomerLightSurfaceVars(themePrimaryColor),
        colorScheme: 'light',
      }) as CSSProperties,
    [themePrimaryColor]
  );

  const panelClass =
    'overflow-hidden border border-[#e8eaef] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.08)] dark:border-[#e8eaef] dark:bg-white';

  const copyTrackingId = useCallback(async () => {
    if (!displayTrackingId) return;
    try {
      await navigator.clipboard.writeText(displayTrackingId);
      setCopied(true);
      toast.success('Tracking ID copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy tracking ID');
    }
  }, [displayTrackingId]);

  useEffect(() => {
    try {
      localStorage.removeItem(`cart-${flowOrderId}`);
      clearOnlineOrderPreferences(flowOrderId);
    } catch {
      // ignore storage errors
    }
  }, [flowOrderId]);

  useEffect(() => {
    setTicket(ticketFromQuery);
  }, [ticketFromQuery]);

  useEffect(() => {
    setResolvedTrackingId(trackingOrderId);
  }, [trackingOrderId]);

  useEffect(() => {
    const slug = restaurantSlug;
    if (!slug) return;
    let cancelled = false;
    void fetch(`/api/customer/restaurant?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json: { data?: { themePrimaryColor?: string | null } }) => {
        if (cancelled) return;
        const c =
          typeof json?.data?.themePrimaryColor === 'string'
            ? json.data.themePrimaryColor.trim()
            : '';
        setThemePrimaryColor(c || null);
      })
      .catch(() => {
        if (!cancelled) setThemePrimaryColor(null);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  useEffect(() => {
    if (!displayTrackingId) return;
    if (ticket != null) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          orderId: displayTrackingId,
        });
        if (restaurantSlug) {
          params.set('restaurantSlug', restaurantSlug);
        }
        const res = await fetch(
          `/api/customer/order-tracking?${params.toString()}`
        );
        const body = (await res.json().catch(() => ({}))) as {
          data?: { ticketNumber?: number | null; shortOrderId?: string | null };
        };
        if (!cancelled && body.data) {
          const tn = body.data.ticketNumber;
          if (typeof tn === 'number' && tn >= 0) {
            setTicket(tn);
          }
        }
      } catch {
        // ignore — tracking ID still shown
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayTrackingId, restaurantSlug, ticket]);

  useEffect(() => {
    const paymentToken = sessionId?.trim() || token?.trim() || null;
    if (!paymentToken) return;
    if (verifyStartedRef.current) return;

    const isStripeSession =
      Boolean(sessionId?.trim()) || paymentToken.startsWith('cs_');

    let cancelled = false;
    verifyStartedRef.current = true;
    setVerifying(true);
    setSyncError(null);

    (async () => {
      try {
        const verifyParams = new URLSearchParams();
        if (isStripeSession) {
          verifyParams.set('session_id', paymentToken);
          if (slugForVerify) {
            verifyParams.set('restaurantSlug', slugForVerify);
          }
        } else {
          verifyParams.set('token', paymentToken);
        }

        const verifyUrl = isStripeSession
          ? `/api/stripe/verify-order-session?${verifyParams.toString()}`
          : `/api/stripe/verify-session?${verifyParams.toString()}`;

        const res = await fetch(verifyUrl);
        const body = (await res.json().catch(() => ({}))) as {
          paid?: boolean;
          shortOrderId?: string;
          orderId?: string;
          ticketNumber?: number | null;
          orderSync?: string;
          error?: string;
          metadata?: { restaurantSlug?: string };
        };

        if (cancelled) return;

        const metaSlug =
          typeof body.metadata?.restaurantSlug === 'string'
            ? body.metadata.restaurantSlug.trim()
            : '';
        if (metaSlug) {
          setSlugFromVerify(metaSlug);
        }

        setPaid(res.ok && body.paid === true);
        const ref = body.shortOrderId ?? body.orderId;
        if (typeof ref === 'string' && ref.trim()) {
          setResolvedTrackingId(ref.trim());
        }
        if (typeof body.ticketNumber === 'number') {
          setTicket(body.ticketNumber);
        }

        if (body.orderSync === 'failed' && body.error) {
          setSyncError(body.error);
          toast.error(body.error);
        } else if (!res.ok) {
          const msg =
            typeof body.error === 'string'
              ? body.error
              : 'Could not confirm payment.';
          setSyncError(msg);
        }
      } catch {
        if (!cancelled) {
          setPaid(false);
          setSyncError('Could not confirm payment. Please contact the restaurant.');
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
      verifyStartedRef.current = false;
    };
  }, [sessionId, token, slugForVerify]);

  return (
    <div
      className="web-app-customer min-h-screen bg-[#f4f4f6] px-4 py-12 text-[#1f1f2e] dark:bg-[#f4f4f6] dark:text-[#1f1f2e]"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-xl space-y-6">
        <WebAppRestaurantTitle
          restaurantName={orderInfo?.restaurantName}
          size="compact"
        />
        <Card className={cn(panelClass, 'text-[#1f1f2e] dark:text-[#1f1f2e]')}>
          <CardHeader>
            <CardTitle className="text-2xl text-[#1f1f2e] dark:text-[#1f1f2e]">
              Payment successful
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#8e8e9a] dark:text-[#8e8e9a]">
              {verifying
                ? 'Confirming your payment and placing your order…'
                : syncError
                  ? syncError
                  : paid === false
                    ? 'Payment confirmation is still syncing. Please keep your order token and tracking ID.'
                    : 'Your order is confirmed. Note your order token and tracking ID below.'}
            </p>
            <div className="rounded-lg border border-[#e8eaef] bg-white p-4 text-center dark:border-[#e8eaef] dark:bg-white">
              <p className="text-xs text-[#8e8e9a] dark:text-[#8e8e9a]">
                Order token
              </p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-[#1f1f2e] dark:text-[#1f1f2e]">
                {formatTokenNumber(ticket)}
              </p>
              <p className="mt-2 text-xs text-[#8e8e9a] dark:text-[#8e8e9a]">
                {orderType === 'pickUp'
                  ? 'Show this number when you pick up your order.'
                  : 'Your order number for today at this restaurant.'}
              </p>
            </div>
            <div className="rounded-lg border border-[#e8eaef] bg-white p-4 dark:border-[#e8eaef] dark:bg-white">
              <p className="text-xs text-[#8e8e9a] dark:text-[#8e8e9a]">
                Tracking ID
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="min-w-0 break-all font-mono text-lg font-semibold text-[#1f1f2e] dark:text-[#1f1f2e]">
                  {displayTrackingId ?? 'Unavailable'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-[#e8eaef] bg-white text-primary hover:bg-white dark:border-[#e8eaef] dark:bg-white dark:text-primary dark:hover:bg-white"
                  onClick={copyTrackingId}
                  disabled={!displayTrackingId}
                  aria-label="Copy tracking ID"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="ms-2">{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-[#e8eaef] bg-white text-primary hover:bg-white dark:border-[#e8eaef] dark:bg-white dark:text-primary dark:hover:bg-white"
                onClick={() => router.push(storefrontHome)}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Button
                asChild
                className="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                disabled={!displayTrackingId}
              >
                <Link
                  href={restaurantTrackOrderPath(restaurantSlug, {
                    orderId: displayTrackingId ?? undefined,
                  })}
                >
                  Track your order
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
