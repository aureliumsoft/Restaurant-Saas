import { db } from '@/lib/db';
import {
  createCustomerOrder,
  parseCustomerOrderPayload,
} from '@/lib/orders/create-customer-order';

type OrderIntentPayload = {
  endpoint?: '/api/customer/orders' | '/api/kiosk/orders';
  payload?: unknown;
  customerAccountId?: string | null;
  status?: string;
  orderId?: string;
  shortOrderId?: string;
  ticketNumber?: number | null;
};

export type WalletOrderIntentResult = {
  status: 'skipped' | 'completed' | 'already_completed' | 'failed';
  orderId?: string;
  shortOrderId?: string;
  ticketNumber?: number | null;
};

async function fulfillWalletOrderIntent(params: {
  intentKey: string;
  paymentMethod: 'JazzCash' | 'Easypaisa';
  providerTxnId: string;
  baseUrl: string;
}): Promise<WalletOrderIntentResult> {
  const row = await db.platformSetting.findUnique({
    where: { key: params.intentKey },
    select: { value: true },
  });
  if (!row) return { status: 'skipped' };

  let parsed: OrderIntentPayload | undefined;
  try {
    parsed = JSON.parse(row.value) as OrderIntentPayload;
  } catch {
    throw new Error(`Invalid order intent payload for ${params.intentKey}`);
  }

  if (!parsed?.endpoint || !parsed.payload) return { status: 'skipped' };

  if (parsed.status === 'completed') {
    return {
      status: 'already_completed',
      orderId:
        typeof parsed.orderId === 'string' ? parsed.orderId : undefined,
      shortOrderId:
        typeof parsed.shortOrderId === 'string'
          ? parsed.shortOrderId
          : undefined,
      ticketNumber:
        typeof parsed.ticketNumber === 'number' ? parsed.ticketNumber : null,
    };
  }

  if (parsed.endpoint === '/api/customer/orders') {
    const orderData = parseCustomerOrderPayload({
      ...(typeof parsed.payload === 'object' && parsed.payload !== null
        ? parsed.payload
        : {}),
      paymentStatus: 'completed',
      paymentMethod: params.paymentMethod,
    });
    if (!orderData) {
      throw new Error(`Invalid order payload for ${params.intentKey}`);
    }
    const created = await createCustomerOrder({
      data: orderData,
      customerAccountId: parsed.customerAccountId ?? null,
      paidExternally: true,
    });
    if (!created.ok) {
      await db.platformSetting.update({
        where: { key: params.intentKey },
        data: {
          value: JSON.stringify({
            ...parsed,
            status: 'failed',
            providerTxnId: params.providerTxnId,
            lastError:
              typeof created.error === 'string'
                ? created.error.slice(0, 500)
                : 'Order creation failed',
            lastStatusCode: created.status,
            lastAttemptedAt: new Date().toISOString(),
          }),
        },
      });
      return { status: 'failed' };
    }

    await db.platformSetting.update({
      where: { key: params.intentKey },
      data: {
        value: JSON.stringify({
          ...parsed,
          status: 'completed',
          providerTxnId: params.providerTxnId,
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

  const res = await fetch(`${params.baseUrl}${parsed.endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(typeof parsed.payload === 'object' && parsed.payload !== null
        ? parsed.payload
        : {}),
      paymentStatus: 'completed',
      paymentMethod: params.paymentMethod,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    await db.platformSetting.update({
      where: { key: params.intentKey },
      data: {
        value: JSON.stringify({
          ...parsed,
          status: 'failed',
          providerTxnId: params.providerTxnId,
          lastError: body.slice(0, 500),
          lastStatusCode: res.status,
          lastAttemptedAt: new Date().toISOString(),
        }),
      },
    });
    return { status: 'failed' };
  }

  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      orderId?: string;
      shortOrderId?: string;
      ticketNumber?: number | null;
    };
  };
  const orderId =
    typeof body?.data?.orderId === 'string' ? body.data.orderId : undefined;
  const shortOrderId =
    typeof body?.data?.shortOrderId === 'string'
      ? body.data.shortOrderId
      : undefined;
  const ticketNumber =
    typeof body?.data?.ticketNumber === 'number'
      ? body.data.ticketNumber
      : null;

  await db.platformSetting.update({
    where: { key: params.intentKey },
    data: {
      value: JSON.stringify({
        ...parsed,
        status: 'completed',
        providerTxnId: params.providerTxnId,
        orderId,
        shortOrderId,
        ticketNumber,
        completedAt: new Date().toISOString(),
      }),
    },
  });

  return { status: 'completed', orderId, shortOrderId, ticketNumber };
}

export async function processJazzCashOrderIntent(params: {
  txnRefNo: string;
  baseUrl: string;
}): Promise<WalletOrderIntentResult> {
  return fulfillWalletOrderIntent({
    intentKey: `jazzcash_order_intent:${params.txnRefNo}`,
    paymentMethod: 'JazzCash',
    providerTxnId: params.txnRefNo,
    baseUrl: params.baseUrl,
  });
}

export async function processEasypaisaOrderIntent(params: {
  orderRefNum: string;
  baseUrl: string;
}): Promise<WalletOrderIntentResult> {
  return fulfillWalletOrderIntent({
    intentKey: `easypaisa_order_intent:${params.orderRefNum}`,
    paymentMethod: 'Easypaisa',
    providerTxnId: params.orderRefNum,
    baseUrl: params.baseUrl,
  });
}

export async function getWalletOrderIntentResult(
  intentKey: string
): Promise<WalletOrderIntentResult | null> {
  const row = await db.platformSetting.findUnique({
    where: { key: intentKey },
    select: { value: true },
  });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as OrderIntentPayload;
    if (parsed.status === 'completed') {
      return {
        status: 'already_completed',
        orderId: typeof parsed.orderId === 'string' ? parsed.orderId : undefined,
        shortOrderId:
          typeof parsed.shortOrderId === 'string'
            ? parsed.shortOrderId
            : undefined,
        ticketNumber:
          typeof parsed.ticketNumber === 'number' ? parsed.ticketNumber : null,
      };
    }
    if (parsed.status === 'failed') return { status: 'failed' };
    return { status: 'skipped' };
  } catch {
    return null;
  }
}
