import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import {
  getPayPalAccessToken,
  getPayPalPlatformConfig,
  isPayPalConfigured,
} from '@/lib/paypal-server';
import {
  handleSubscriptionLifecycleEvent,
  handleSubscriptionPaymentSale,
} from '@/lib/paypal-subscriptions';
import { syncPayPalIntegrationFromPayPal } from '@/lib/restaurant-paypal-integration';

export const runtime = 'nodejs';

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    merchant_id?: string;
    tracking_id?: string;
    status?: string;
    billing_agreement_id?: string;
    amount?: { total?: string; currency?: string };
  };
};

async function verifyWebhookSignature(
  req: NextRequest,
  body: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) return false;

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

  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${config.baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
    }
  );

  if (!res.ok) return false;
  const json = (await res.json()) as { verification_status?: string };
  return json.verification_status === 'SUCCESS';
}

async function handleMerchantOnboarding(resource: PayPalWebhookEvent['resource']) {
  const trackingId = resource?.tracking_id?.trim();
  const merchantId = resource?.merchant_id?.trim();
  if (!trackingId || !merchantId) return;

  const integration = await db.restaurantPayPalIntegration.findUnique({
    where: { trackingId },
    select: { restaurantId: true },
  });
  if (!integration) return;

  await syncPayPalIntegrationFromPayPal(integration.restaurantId, merchantId);
}

function subscriptionIdFromResource(
  resource: PayPalWebhookEvent['resource']
): string | null {
  const id = resource?.billing_agreement_id ?? resource?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export async function POST(req: NextRequest) {
  if (!isPayPalConfigured()) {
    return NextResponse.json({ error: 'PayPal not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (webhookId) {
    const valid = await verifyWebhookSignature(req, rawBody);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const eventType = event.event_type ?? '';

  try {
    switch (eventType) {
      case 'MERCHANT.ONBOARDING.COMPLETED':
      case 'CUSTOMER.MERCHANT-INTEGRATION.COMPLETED':
        await handleMerchantOnboarding(event.resource);
        break;
      case 'PAYMENT.CAPTURE.COMPLETED':
        break;
      case 'PAYMENT.SALE.COMPLETED': {
        const subId = subscriptionIdFromResource(event.resource);
        if (subId && event.resource?.id) {
          await handleSubscriptionPaymentSale({
            subscriptionId: subId,
            saleId: event.resource.id,
            amount: Number(event.resource.amount?.total ?? 0) || 0,
            currency: String(event.resource.amount?.currency ?? 'EUR').toUpperCase(),
          });
        }
        break;
      }
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED':
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const subId = subscriptionIdFromResource(event.resource);
        if (subId) {
          await handleSubscriptionLifecycleEvent(subId, eventType);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('PayPal webhook handler error:', eventType, e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
