import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRequestOrigin } from '@/lib/request-origin';
import { getRestaurantEasypaisaRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';
import {
  isEasypaisaPaymentSuccessful,
  verifyEasypaisaReturnHash,
} from '@/lib/restaurant-easypaisa-client';
import { processEasypaisaOrderIntent } from '@/lib/wallet-order-intent-sync';

export const runtime = 'nodejs';

async function readFields(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get('content-type') ?? '';
  const fields: Record<string, string> = {};

  if (contentType.includes('application/json')) {
    const json = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    for (const [k, v] of Object.entries(json)) {
      if (v != null) fields[k] = String(v);
    }
    return fields;
  }

  const form = await req.formData().catch(() => null);
  if (form) {
    form.forEach((value, key) => {
      fields[key] = String(value);
    });
  }

  req.nextUrl.searchParams.forEach((value, key) => {
    if (!(key in fields)) fields[key] = value;
  });

  return fields;
}

function redirectFailure(
  origin: string,
  cancelPath: string,
  reason: string
): NextResponse {
  const url = new URL(cancelPath || '/', origin);
  url.searchParams.set('paymentError', reason.slice(0, 120));
  return NextResponse.redirect(url.toString(), 303);
}

export async function POST(req: NextRequest) {
  const origin = await getRequestOrigin();
  const fields = await readFields(req);
  const restaurantSlug =
    req.nextUrl.searchParams.get('restaurantSlug')?.trim() ||
    fields.restaurantSlug?.trim() ||
    '';

  const orderRefNum = (
    fields.orderRefNum ||
    fields.orderRefNumber ||
    ''
  ).trim();

  let cancelPath = '/';
  let successPathTemplate = '';

  if (orderRefNum) {
    const intent = await db.platformSetting.findUnique({
      where: { key: `easypaisa_order_intent:${orderRefNum}` },
      select: { value: true },
    });
    if (intent) {
      try {
        const parsed = JSON.parse(intent.value) as {
          metadata?: { cancelPath?: string; successPath?: string };
        };
        cancelPath = parsed.metadata?.cancelPath || cancelPath;
        successPathTemplate = parsed.metadata?.successPath || '';
      } catch {
        // ignore
      }
    }
  }

  if (!restaurantSlug || !orderRefNum) {
    return redirectFailure(origin, cancelPath, 'missing_params');
  }

  const row = await getRestaurantEasypaisaRuntimeConfigBySlug(restaurantSlug);
  if (!row) {
    return redirectFailure(origin, cancelPath, 'not_configured');
  }

  const hasReturnHash = Boolean(
    fields.merchantHashedReq ||
      fields.encryptedHashRequest ||
      fields.hashKey
  );
  if (
    hasReturnHash &&
    !verifyEasypaisaReturnHash(fields, row.config.hashKey)
  ) {
    return redirectFailure(origin, cancelPath, 'invalid_hash');
  }

  // If gateway omits hash, still require a success status marker.
  if (!isEasypaisaPaymentSuccessful(fields) && hasReturnHash) {
    return redirectFailure(origin, cancelPath, 'payment_failed');
  }
  if (!hasReturnHash && !isEasypaisaPaymentSuccessful(fields)) {
    // Some Easypaisa flows return only orderRefNum on success via GET.
    // Require an explicit success status when hash is absent.
    const status = String(
      fields.responseCode ?? fields.status ?? fields.transactionStatus ?? ''
    ).trim();
    if (!status) {
      // Soft success only when intent is pending and responseCode missing —
      // treat as failure to avoid false positives.
      return redirectFailure(origin, cancelPath, 'payment_unconfirmed');
    }
    return redirectFailure(origin, cancelPath, 'payment_failed');
  }

  try {
    const result = await processEasypaisaOrderIntent({
      orderRefNum,
      baseUrl: origin,
    });

    if (result.status === 'failed' || !result.orderId) {
      return redirectFailure(origin, cancelPath, 'order_create_failed');
    }

    const orderRef = result.shortOrderId || result.orderId;
    const successPath =
      successPathTemplate
        .replace('{orderId}', orderRef)
        .replace('{CHECKOUT_SESSION_ID}', orderRefNum) ||
      `/order/success?orderId=${encodeURIComponent(orderRef)}`;

    const successUrl = new URL(successPath, origin);
    if (!successUrl.searchParams.has('orderId')) {
      successUrl.searchParams.set('orderId', orderRef);
    }
    if (restaurantSlug && !successUrl.searchParams.has('restaurantSlug')) {
      successUrl.searchParams.set('restaurantSlug', restaurantSlug);
    }
    if (
      typeof result.ticketNumber === 'number' &&
      !successUrl.searchParams.has('ticket')
    ) {
      successUrl.searchParams.set('ticket', String(result.ticketNumber));
    }

    return NextResponse.redirect(successUrl.toString(), 303);
  } catch (e) {
    console.error('Easypaisa return handling failed:', e);
    return redirectFailure(origin, cancelPath, 'server_error');
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
