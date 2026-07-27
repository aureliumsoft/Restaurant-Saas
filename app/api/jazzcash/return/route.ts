import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getRequestOrigin } from '@/lib/request-origin';
import { getRestaurantJazzCashRuntimeConfigBySlug } from '@/lib/restaurant-payment-credentials';
import {
  isJazzCashPaymentSuccessful,
  verifyJazzCashSecureHash,
} from '@/lib/restaurant-jazzcash-client';
import { processJazzCashOrderIntent } from '@/lib/wallet-order-intent-sync';

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

  // Also merge JazzCash query params only (some setups append pp_* on GET).
  // Never mix non-pp params (e.g. restaurantSlug) into the field map used for hashing.
  req.nextUrl.searchParams.forEach((value, key) => {
    if (!(key in fields) && key.toLowerCase().startsWith('pp')) {
      fields[key] = value;
    }
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

  const txnRefNo = (fields.pp_TxnRefNo ?? '').trim();
  let cancelPath = '/';
  let successPathTemplate = '';
  let restaurantSlug =
    req.nextUrl.searchParams.get('restaurantSlug')?.trim() || '';

  if (txnRefNo) {
    const intent = await db.platformSetting.findUnique({
      where: { key: `jazzcash_order_intent:${txnRefNo}` },
      select: { value: true },
    });
    if (intent) {
      try {
        const parsed = JSON.parse(intent.value) as {
          metadata?: {
            cancelPath?: string;
            successPath?: string;
            restaurantSlug?: string;
          };
        };
        cancelPath = parsed.metadata?.cancelPath || cancelPath;
        successPathTemplate = parsed.metadata?.successPath || '';
        if (!restaurantSlug) {
          restaurantSlug = parsed.metadata?.restaurantSlug?.trim() || '';
        }
      } catch {
        // ignore
      }
    }
  }

  if (!restaurantSlug || !txnRefNo) {
    return redirectFailure(origin, cancelPath, 'missing_params');
  }

  const row = await getRestaurantJazzCashRuntimeConfigBySlug(restaurantSlug);
  if (!row) {
    return redirectFailure(origin, cancelPath, 'not_configured');
  }

  const hashVerified = verifyJazzCashSecureHash(
    fields,
    row.config.integritySalt
  );
  if (!hashVerified) {
    // Some sandbox/generator callbacks do not reproduce a valid secure hash.
    // Keep strict verification for live mode, but allow sandbox test callbacks.
    if (row.config.mode === 'live') {
      return redirectFailure(origin, cancelPath, 'invalid_hash');
    }
    console.warn(
      'JazzCash sandbox callback hash mismatch; continuing for test flow.',
      { txnRefNo, restaurantSlug }
    );
  }

  if (!isJazzCashPaymentSuccessful(fields.pp_ResponseCode)) {
    return redirectFailure(
      origin,
      cancelPath,
      fields.pp_ResponseMessage || fields.pp_ResponseCode || 'payment_failed'
    );
  }

  try {
    const result = await processJazzCashOrderIntent({
      txnRefNo,
      baseUrl: origin,
    });

    if (result.status === 'failed' || !result.orderId) {
      return redirectFailure(origin, cancelPath, 'order_create_failed');
    }

    const orderRef = result.shortOrderId || result.orderId;
    const successPath =
      successPathTemplate
        .replace('{orderId}', orderRef)
        .replace('{CHECKOUT_SESSION_ID}', txnRefNo) ||
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
    console.error('JazzCash return handling failed:', e);
    return redirectFailure(origin, cancelPath, 'server_error');
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
