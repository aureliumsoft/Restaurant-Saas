import { notFound } from 'next/navigation';

import { OnlinePaymentSuccess } from '@/components/order/online-payment-success';
import { orderInfoFromSearchParams } from '@/lib/order-search-params';

type Props = {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function OnlineSuccessPage({ params, searchParams }: Props) {
  const { type: typeParam, id } = await params;
  const resolved = await searchParams;

  const mode =
    typeParam === 'pickUp' || typeParam.toLowerCase() === 'pickup'
      ? 'pickUp'
      : typeParam === 'delivery'
      ? 'delivery'
      : null;
  if (!mode) notFound();

  const orderInfo = orderInfoFromSearchParams(resolved, mode);
  const trackingOrderId = pick(resolved, 'orderId').trim() || null;
  const sessionId = pick(resolved, 'session_id').trim() || null;
  const token = pick(resolved, 'token').trim() || null;
  const ticketRaw =
    pick(resolved, 'ticket').trim() || pick(resolved, 'ticketNumber').trim();
  const parsedTicket = ticketRaw ? Number(ticketRaw) : NaN;
  const ticketFromQuery = Number.isFinite(parsedTicket) ? parsedTicket : null;

  return (
    <OnlinePaymentSuccess
      flowOrderId={id}
      trackingOrderId={trackingOrderId}
      ticketFromQuery={ticketFromQuery}
      sessionId={sessionId}
      token={token}
      orderType={mode}
      orderInfo={orderInfo}
    />
  );
}
