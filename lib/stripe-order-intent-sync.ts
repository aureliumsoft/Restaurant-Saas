import Stripe from 'stripe';

import { db } from '@/lib/db';
import {
  createCustomerOrder,
  customerOrderPayloadError,
  parseCustomerOrderPayload,
} from '@/lib/orders/create-customer-order';
import { fromStripeUnitAmount } from '@/lib/stripe-server';

export function resolveBaseUrlFromHeaders(headers: Headers): string {
  const envRaw = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envRaw) {
    try {
      const parsed = new URL(envRaw);
      const isLocal =
        parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
      if (!(process.env.NODE_ENV === 'production' && isLocal)) {
        return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '');
      }
    } catch {
      // Ignore invalid env and fall back to request headers.
    }
  }

  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000';
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

type OrderIntentPayload = {
  endpoint?: '/api/customer/orders' | '/api/kiosk/orders';
  payload?: unknown;
  customerAccountId?: string | null;
  status?: string;
};

export async function processOrderIntentFromSession(
  session: Stripe.Checkout.Session,
  baseUrl: string
): Promise<{
  status: 'skipped' | 'completed' | 'already_completed' | 'failed';
  orderId?: string;
  shortOrderId?: string;
  ticketNumber?: number | null;
  error?: string;
}> {
  if (session.payment_status !== 'paid') return { status: 'skipped' };
  const intentId =
    typeof session.metadata?.intentId === 'string' ? session.metadata.intentId.trim() : '';
  if (!intentId) return { status: 'skipped' };

  const key = `stripe_order_intent:${intentId}`;
  const row = await db.platformSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  if (!row) return { status: 'skipped' };

  let parsed: OrderIntentPayload | undefined;
  try {
    parsed = JSON.parse(row.value) as OrderIntentPayload;
  } catch {
    throw new Error(`Invalid order intent payload for ${key}`);
  }

  if (!parsed?.endpoint || !parsed.payload) return { status: 'skipped' };
  if (parsed.status === 'completed') {
    const parsedCompleted = JSON.parse(row.value) as {
      orderId?: string;
      shortOrderId?: string;
      ticketNumber?: number | null;
    };
    return {
      status: 'already_completed',
      orderId:
        typeof parsedCompleted.orderId === 'string'
          ? parsedCompleted.orderId
          : undefined,
      shortOrderId:
        typeof parsedCompleted.shortOrderId === 'string'
          ? parsedCompleted.shortOrderId
          : undefined,
      ticketNumber:
        typeof parsedCompleted.ticketNumber === 'number'
          ? parsedCompleted.ticketNumber
          : null,
    };
  }

  if (parsed.endpoint === '/api/customer/orders') {
    const orderPayload = {
      ...(typeof parsed.payload === 'object' && parsed.payload !== null
        ? parsed.payload
        : {}),
      paymentStatus: 'completed',
      paymentMethod: 'Stripe',
    };
    const orderData = parseCustomerOrderPayload(orderPayload);
    if (!orderData) {
      const reason =
        customerOrderPayloadError(orderPayload) ?? 'Invalid order payload';
      await db.platformSetting.update({
        where: { key },
        data: {
          value: JSON.stringify({
            ...parsed,
            status: 'failed',
            stripeSessionId: session.id,
            lastError: reason.slice(0, 500),
            lastAttemptedAt: new Date().toISOString(),
          }),
        },
      });
      return { status: 'failed', error: reason };
    }
    const created = await createCustomerOrder({
      data: orderData,
      customerAccountId: parsed.customerAccountId ?? null,
      paidExternally: true,
    });
    if (!created.ok) {
      if (created.status < 400) {
        return { status: 'already_completed' };
      }
      const reason =
        typeof created.error === 'string'
          ? created.error.slice(0, 500)
          : 'Order creation failed';
      await db.platformSetting.update({
        where: { key },
        data: {
          value: JSON.stringify({
            ...parsed,
            status: 'failed',
            stripeSessionId: session.id,
            lastError: reason,
            lastStatusCode: created.status,
            lastAttemptedAt: new Date().toISOString(),
          }),
        },
      });
      console.error(
        `Stripe order intent ${intentId} failed (${created.status}): ${reason}`
      );
      return { status: 'failed', error: reason };
    }

    await db.platformSetting.update({
      where: { key },
      data: {
        value: JSON.stringify({
          ...parsed,
          status: 'completed',
          stripeSessionId: session.id,
          orderId: created.orderId,
          shortOrderId: created.shortOrderId,
          ticketNumber: created.ticketNumber,
          completedAt: new Date().toISOString(),
        }),
      },
    });

    return {
      status: 'completed',
      orderId: created.orderId,
      shortOrderId: created.shortOrderId,
      ticketNumber: created.ticketNumber,
    };
  }

  const res = await fetch(`${baseUrl}${parsed.endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(typeof parsed.payload === 'object' && parsed.payload !== null
        ? parsed.payload
        : {}),
      paymentStatus: 'completed',
      paymentMethod: 'Stripe',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const reason = body.slice(0, 500) || `Order creation failed (${res.status})`;
    await db.platformSetting.update({
      where: { key },
      data: {
        value: JSON.stringify({
          ...parsed,
          status: 'failed',
          stripeSessionId: session.id,
          lastError: reason,
          lastStatusCode: res.status,
          lastAttemptedAt: new Date().toISOString(),
        }),
      },
    });
    console.error(
      `Stripe order intent ${intentId} failed for ${parsed.endpoint} (${res.status}): ${reason}`
    );
    return { status: 'failed', error: reason };
  }

  const body = (await res.json().catch(() => ({}))) as {
    data?: { orderId?: string; shortOrderId?: string; ticketNumber?: number | null };
  };
  const orderId =
    typeof body?.data?.orderId === 'string' ? body.data.orderId : undefined;
  const shortOrderId =
    typeof body?.data?.shortOrderId === 'string' ? body.data.shortOrderId : undefined;
  const ticketNumber =
    typeof body?.data?.ticketNumber === 'number' ? body.data.ticketNumber : null;

  await db.platformSetting.update({
    where: { key },
    data: {
      value: JSON.stringify({
        ...parsed,
        status: 'completed',
        stripeSessionId: session.id,
        orderId,
        shortOrderId,
        ticketNumber,
        completedAt: new Date().toISOString(),
      }),
    },
  });

  return { status: 'completed', orderId, shortOrderId, ticketNumber };
}

export async function markExistingOrderPaidFromSession(
  session: Stripe.Checkout.Session
): Promise<'skipped' | 'updated' | 'already_completed'> {
  if (session.payment_status !== 'paid') return 'skipped';

  const orderId =
    typeof session.metadata?.orderId === 'string' ? session.metadata.orderId.trim() : '';
  if (!orderId) return 'skipped';

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, restaurantId: true, total: true },
  });
  if (!order) return 'skipped';

  const existingPayment = await db.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

  if (existingPayment?.status === 'completed') {
    return 'already_completed';
  }

  const amountFromStripe = fromStripeUnitAmount(session.amount_total, session.currency ?? 'eur');

  if (existingPayment) {
    await db.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: 'completed',
        method: 'Stripe',
        amount: amountFromStripe > 0 ? amountFromStripe : order.total,
      },
    });
  } else {
    await db.payment.create({
      data: {
        orderId: order.id,
        amount: amountFromStripe > 0 ? amountFromStripe : order.total,
        status: 'completed',
        method: 'Stripe',
        restaurantId: order.restaurantId,
      },
    });
  }

  return 'updated';
}
