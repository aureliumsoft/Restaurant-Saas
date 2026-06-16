import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getRestaurantPayPalRuntimeConfigByRestaurantId } from '@/lib/restaurant-payment-credentials';

export const runtime = 'nodejs';

type PayPalWebhookEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
  };
};

async function verifyRestaurantPayPalWebhook(
  req: NextRequest,
  body: string,
  webhookId: string,
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  const transmissionId = req.headers.get('paypal-transmission-id');
  const transmissionTime = req.headers.get('paypal-transmission-time');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');
  const transmissionSig = req.headers.get('paypal-transmission-sig');

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString(
    'base64'
  );
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!tokenRes.ok) return false;
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return false;

  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
    cache: 'no-store',
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { verification_status?: string };
  return json.verification_status === 'SUCCESS';
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await ctx.params;
  const body = await req.text();

  const creds = await getRestaurantPayPalRuntimeConfigByRestaurantId(restaurantId);
  if (!creds) {
    return NextResponse.json({ error: 'PayPal not configured.' }, { status: 404 });
  }

  const row = await import('@/lib/db').then((m) =>
    m.db.restaurantPayPalCredentials.findUnique({
      where: { restaurantId },
      select: { webhookId: true },
    })
  );
  const webhookId = row?.webhookId?.trim();
  if (webhookId) {
    const ok = await verifyRestaurantPayPalWebhook(
      req,
      body,
      webhookId,
      creds.baseUrl,
      creds.clientId,
      creds.clientSecret
    );
    if (!ok) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
    }
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(body) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // Acknowledge supported events; order sync is handled on capture in checkout flow.
  if (
    event.event_type === 'CHECKOUT.ORDER.APPROVED' ||
    event.event_type === 'PAYMENT.CAPTURE.COMPLETED'
  ) {
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
