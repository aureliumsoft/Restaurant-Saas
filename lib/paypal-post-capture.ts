import { db } from '@/lib/db';
import { parsePayPalCustomId, type PayPalOrderMetadata } from '@/lib/paypal-server';
import {
  captureRestaurantPayPalOrder,
  getRestaurantPayPalOrder,
} from '@/lib/restaurant-paypal-client';
import { getRestaurantPayPalRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';

export type PayPalPostCaptureResult = {
  paid: boolean;
  status: 'completed' | 'pending';
  metadata: PayPalOrderMetadata;
  orderSync: 'skipped' | 'completed' | 'already_completed';
  orderId?: string;
  shortOrderId?: string;
  ticketNumber?: number | null;
  restaurantId?: string;
  planSynced: boolean;
};

async function resolveRestaurantPayPalConfig(
  meta: PayPalOrderMetadata,
  intentMetadata?: Record<string, string>
) {
  const slug =
    (typeof meta.restaurantSlug === 'string' && meta.restaurantSlug.trim()) ||
    (typeof intentMetadata?.restaurantSlug === 'string' &&
      intentMetadata.restaurantSlug.trim()) ||
    '';
  if (!slug) return null;
  return getRestaurantPayPalRuntimeConfigBySlug(slug);
}

/**
 * Captures a PayPal order (or reads it if already captured) and applies the
 * resulting metadata to orders / stored intents / subscriptions.
 */
export async function applyPayPalPostCapture(opts: {
  orderToken: string;
  baseUrl: string;
  restaurantSlug?: string;
}): Promise<PayPalPostCaptureResult> {
  const { orderToken, baseUrl } = opts;

  let captured = false;
  let captureAmount = 0;
  let captureCurrency = 'EUR';
  let customIdRaw = '';

  let meta: PayPalOrderMetadata = opts.restaurantSlug
    ? { restaurantSlug: opts.restaurantSlug }
    : {};

  const earlyRow = opts.restaurantSlug
    ? await getRestaurantPayPalRuntimeConfigBySlug(opts.restaurantSlug)
    : null;

  if (earlyRow) {
    const preOrder = await getRestaurantPayPalOrder(
      earlyRow.config,
      orderToken
    ).catch(() => null);
    if (preOrder?.purchase_units?.[0]?.custom_id) {
      meta = {
        ...meta,
        ...parsePayPalCustomId(preOrder.purchase_units[0].custom_id),
      };
    }
  }

  let orderSync: PayPalPostCaptureResult['orderSync'] = 'skipped';
  let orderId: string | undefined;
  let shortOrderId: string | undefined;
  let ticketNumber: number | null | undefined;
  let restaurantIdResult: string | undefined;
  let planSynced = false;

  let intent: {
    endpoint?: '/api/customer/orders' | '/api/kiosk/orders' | null;
    payload?: unknown;
    metadata?: Record<string, string>;
    restaurantId?: string | null;
    status?: string;
  } | null = null;
  let intentKey: string | null = null;
  if (typeof meta.intentId === 'string' && meta.intentId.trim()) {
    intentKey = `paypal_order_intent:${meta.intentId.trim()}`;
    const row = await db.platformSetting.findUnique({
      where: { key: intentKey },
      select: { value: true },
    });
    if (row) {
      try {
        intent = JSON.parse(row.value);
        if (intent?.metadata && typeof intent.metadata === 'object') {
          meta = { ...intent.metadata, ...meta } as PayPalOrderMetadata;
        }
      } catch {
        intent = null;
      }
    }
  }

  const restaurantPayPal =
    earlyRow ?? (await resolveRestaurantPayPalConfig(
      meta,
      intent?.metadata as Record<string, string> | undefined
    ));

  if (!restaurantPayPal) {
    throw new Error('Restaurant PayPal credentials are not configured.');
  }

  try {
    const capture = await captureRestaurantPayPalOrder(
      restaurantPayPal.config,
      orderToken
    );
    const pu = capture.purchase_units?.[0];
    const cap = pu?.payments?.captures?.[0];
    customIdRaw = pu?.custom_id ?? customIdRaw;
    captured = String(cap?.status ?? '').toUpperCase() === 'COMPLETED';
    captureAmount = Number(cap?.amount?.value ?? 0) || 0;
    captureCurrency = String(cap?.amount?.currency_code ?? 'EUR').toUpperCase();
    if (!meta.intentId) {
      meta = { ...meta, ...parsePayPalCustomId(customIdRaw) };
    }
  } catch {
    const order = await getRestaurantPayPalOrder(
      restaurantPayPal.config,
      orderToken
    );
    const pu = order.purchase_units?.[0];
    customIdRaw = pu?.custom_id ?? customIdRaw;
    captured = String(order.status ?? '').toUpperCase() === 'COMPLETED';
    if (!meta.intentId) {
      meta = { ...meta, ...parsePayPalCustomId(customIdRaw) };
    }
  }

  if (captured) {
    if (typeof meta.orderId === 'string' && meta.orderId.trim()) {
      orderId = meta.orderId.trim();
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: { id: true, total: true, restaurantId: true },
      });
      if (order) {
        const lastPayment = await db.payment.findFirst({
          where: { orderId: order.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true },
        });
        if (lastPayment?.status === 'completed') {
          orderSync = 'already_completed';
        } else if (lastPayment) {
          await db.payment.update({
            where: { id: lastPayment.id },
            data: {
              status: 'completed',
              method: 'PayPal',
              amount: captureAmount > 0 ? captureAmount : order.total,
            },
          });
          orderSync = 'completed';
        } else {
          await db.payment.create({
            data: {
              orderId: order.id,
              amount: captureAmount > 0 ? captureAmount : order.total,
              status: 'completed',
              method: 'PayPal',
              restaurantId: order.restaurantId,
            },
          });
          orderSync = 'completed';
        }
      }
    } else if (intent?.endpoint && intent.payload && intentKey) {
      if (intent.status !== 'completed') {
        try {
          const res = await fetch(`${baseUrl}${intent.endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(typeof intent.payload === 'object' && intent.payload !== null
                ? intent.payload
                : {}),
              paymentStatus: 'completed',
              paymentMethod: 'PayPal',
            }),
          });
          if (res.ok) {
            const body = (await res.json().catch(() => ({}))) as {
              data?: {
                orderId?: string;
                shortOrderId?: string;
                restaurantId?: string;
                ticketNumber?: number | null;
              };
            };
            orderId =
              typeof body?.data?.orderId === 'string'
                ? body.data.orderId
                : undefined;
            shortOrderId =
              typeof body?.data?.shortOrderId === 'string'
                ? body.data.shortOrderId
                : undefined;
            restaurantIdResult =
              typeof body?.data?.restaurantId === 'string'
                ? body.data.restaurantId
                : undefined;
            ticketNumber =
              typeof body?.data?.ticketNumber === 'number'
                ? body.data.ticketNumber
                : null;
            await db.platformSetting.update({
              where: { key: intentKey },
              data: {
                value: JSON.stringify({
                  ...intent,
                  status: 'completed',
                  paypalOrderId: orderToken,
                  orderId,
                  shortOrderId,
                  ticketNumber,
                  completedAt: new Date().toISOString(),
                }),
              },
            });
            orderSync = 'completed';
          }
        } catch (e) {
          console.error('PayPal order intent sync failed:', e);
        }
      }
    }

    if (meta.source === 'subscription') {
      planSynced = false;
    }
  }

  return {
    paid: captured,
    status: captured ? 'completed' : 'pending',
    metadata: meta,
    orderSync,
    orderId,
    shortOrderId,
    ticketNumber,
    restaurantId: restaurantIdResult ?? restaurantPayPal.restaurantId,
    planSynced,
  };
}
