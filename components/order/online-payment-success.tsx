'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Copy, Home, TrainTrack } from 'lucide-react';
import { toast } from 'react-toastify';

import { WebAppRestaurantTitle } from '@/components/customer-app/web-app-restaurant-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrderInfo } from '@/components/order/order-types';
import { TrackNextIcon } from '@radix-ui/react-icons';

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
  orderInfo,
}: Props) {
  const router = useRouter();
  const [paid, setPaid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [ticket, setTicket] = useState<number | null>(ticketFromQuery);

  const copyTrackingId = useCallback(async () => {
    if (!trackingOrderId) return;
    try {
      await navigator.clipboard.writeText(trackingOrderId);
      setCopied(true);
      toast.success('Tracking ID copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy tracking ID');
    }
  }, [trackingOrderId]);
  const restaurantSlug = orderInfo?.restaurantSlug?.trim() || '';
  const storefrontHome = `/web-app/${encodeURIComponent(restaurantSlug)}`;

  useEffect(() => {
    try {
      localStorage.removeItem(`cart-${flowOrderId}`);
    } catch {
      // ignore storage errors
    }
  }, [flowOrderId]);

  useEffect(() => {
    setTicket(ticketFromQuery);
  }, [ticketFromQuery]);

  useEffect(() => {
    if (!trackingOrderId) return;
    if (ticket != null) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          orderId: trackingOrderId,
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
  }, [trackingOrderId, restaurantSlug, ticket]);

  useEffect(() => {
    const paymentToken = sessionId ?? token ?? null;
    if (!paymentToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/stripe/verify-session?token=${encodeURIComponent(paymentToken)}`
        );
        const body = (await res.json().catch(() => ({}))) as { paid?: boolean };
        if (!cancelled) setPaid(res.ok && body.paid === true);
      } catch {
        if (!cancelled) setPaid(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <WebAppRestaurantTitle
          restaurantName={orderInfo?.restaurantName}
          size="compact"
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Payment successful</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {paid === false
                ? 'Payment confirmation is still syncing. Please keep your order token and tracking ID.'
                : 'Your order is confirmed. Note your order token and tracking ID below.'}
            </p>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground">Order token</p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums">
                {formatTokenNumber(ticket)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {orderType === 'pickUp'
                  ? 'Show this number when you pick up your order.'
                  : 'Your order number for today at this restaurant.'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Tracking ID</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="min-w-0 break-all font-mono text-lg font-semibold">
                  {trackingOrderId ?? 'Unavailable'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={copyTrackingId}
                  disabled={!trackingOrderId}
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
                onClick={() => router.push(storefrontHome)}
                disabled={!restaurantSlug}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Button asChild>
                <Link
                  href={`/web-app/${encodeURIComponent(restaurantSlug)}/track-order${
                    trackingOrderId
                      ? `?orderId=${encodeURIComponent(trackingOrderId)}`
                      : ''
                  }`}
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