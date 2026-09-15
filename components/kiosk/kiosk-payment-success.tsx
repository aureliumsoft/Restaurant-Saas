'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { printKioskReceipt } from '@/lib/kiosk-print-receipt';
import { kioskBasePath, kioskCartStorageKey, kioskCheckoutDraftKey } from '@/lib/kiosk-path';
import { IconHome, IconPrinter } from '@tabler/icons-react';

type Props = {
  slug: string;
  branchId: string;
  orderId: string | null;
  ticketFromQuery: number | null;
  sessionId: string | null;
  token?: string | null;
  initialMethod?: string | null;
  initialPayStatus?: string | null;
  isMobile?: boolean;
};

export function KioskPaymentSuccess({
  slug,
  branchId,
  orderId,
  ticketFromQuery,
  sessionId,
  token,
  initialMethod,
  initialPayStatus,
  isMobile = false,
}: Props) {
  const router = useRouter();
  const [ticket, setTicket] = useState<number | null>(ticketFromQuery);
  const [paymentStatus, setPaymentStatus] = useState<string>(
    initialPayStatus ?? (sessionId || token ? 'pending' : initialMethod?.toLowerCase().includes('cash') ? 'pending' : 'completed')
  );
  const [paymentMethod, setPaymentMethod] = useState<string | null>(initialMethod ?? null);
  const [trackingId, setTrackingId] = useState<string | null>(orderId);

  useEffect(() => {
    try {
      localStorage.removeItem(kioskCartStorageKey(slug, branchId));
      localStorage.removeItem(kioskCheckoutDraftKey(slug, branchId));
    } catch {
      // ignore storage errors
    }
  }, [slug, branchId]);

  useEffect(() => {
    const paymentToken = sessionId ?? token ?? null;
    if (!paymentToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/stripe/verify-session?token=${encodeURIComponent(paymentToken)}`
        );
        const body = (await res.json().catch(() => ({}))) as {
          status?: string;
          paid?: boolean;
        };
        if (!cancelled) {
          setPaymentStatus(body.paid ? 'completed' : body.status ?? 'pending');
          setPaymentMethod('Card');
        }
      } catch {
        if (!cancelled) setPaymentStatus('pending');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/kiosk/order-tracking?orderId=${encodeURIComponent(orderId)}`
        );
        const body = (await res.json().catch(() => ({}))) as {
          data?: {
            shortOrderId?: string;
            ticketNumber?: number | null;
            payment?: { status?: string; method?: string } | null;
          };
        };
        if (!cancelled && body.data) {
          setTrackingId(body.data.shortOrderId ?? orderId);
          if (body.data.ticketNumber != null) {
            setTicket(body.data.ticketNumber);
          }
          if (body.data.payment?.status) {
            setPaymentStatus(body.data.payment.status);
          }
          if (body.data.payment?.method) {
            setPaymentMethod(body.data.payment.method);
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const autoPrintedRef = useRef(false);

  useEffect(() => {
    if (isMobile) return;
    if (!orderId || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    const timer = window.setTimeout(() => {
      void printKioskReceipt({ slug, branchId, orderId });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [orderId, slug, branchId, isMobile]);

  const printTicket = async () => {
    if (!orderId) {
      window.print();
      return;
    }
    await printKioskReceipt({ slug, branchId, orderId });
  };

  const isCash = (paymentMethod ?? '').toLowerCase().includes('cash');
  const isPending =
    paymentStatus.toLowerCase() === 'pending' ||
    paymentStatus.toLowerCase() === 'pedding';
  const isCashPending = isCash && isPending;

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10 text-[#0f172a]">
      <div className="mx-auto max-w-xl">
        <Card className="border border-[#e2e8f0] bg-white text-[#0f172a] shadow-sm dark:border-[#e2e8f0] dark:bg-white dark:text-[#0f172a] dark:shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0f172a] dark:text-[#0f172a]">
              Kiosk order confirmed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-[#e2e8f0] bg-white p-4 text-center dark:border-[#e2e8f0] dark:bg-white">
              <p className="text-xs text-[#64748b] dark:text-[#64748b]">Ticket Number</p>
              <p className="text-4xl font-bold tabular-nums text-[#0f172a] dark:text-[#0f172a]">
                {ticket != null ? `#${ticket}` : '—'}
              </p>
            </div>
            <div className="text-sm text-[#0f172a] dark:text-[#0f172a]">
              <p>
                <strong>Tracking ID:</strong> {trackingId ?? '—'}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <strong>Payment:</strong>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isCashPending
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isCashPending
                    ? 'Cash at counter (Pending)'
                    : 'Paid'}
                </span>
              </div>
              {isCashPending ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Cash payment required</p>
                  <p className="mt-0.5 text-amber-700">
                    Please proceed to the counter to pay. Your order will be prepared as soon as payment is received.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              {isMobile ? null : (
                <Button
                  type="button"
                  className="bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                  onClick={printTicket}
                >
                  <IconPrinter className="w-4 h-4 mr-2" />
                  Print Ticket
                </Button>
              )}
              <Button
                type="button"
                className={
                  isMobile
                    ? 'w-full bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90'
                    : 'border border-primary bg-white text-primary hover:bg-primary/10 hover:text-primary dark:border-primary dark:bg-white dark:text-primary dark:hover:bg-primary/10'
                }
                onClick={() =>
                  router.push(
                    isMobile
                      ? `${kioskBasePath(slug, branchId)}?Mobile=true`
                      : kioskBasePath(slug, branchId)
                  )
                }
              >
                <IconHome className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
