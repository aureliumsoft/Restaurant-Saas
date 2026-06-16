import { buildPayPalAuthAssertion } from '@/lib/paypal-auth-assertion';
import {
  getPayPalAccessToken,
  getPayPalPlatformConfig,
  isPayPalPartnerConfigured,
} from '@/lib/paypal-server';

export type MerchantIntegrationStatus = {
  merchantId: string;
  permissionsGranted: boolean;
  paymentsReceivable: boolean;
  primaryEmail: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  accountStatus: string | null;
};

function partnerHeaders(token: string, sellerMerchantId?: string) {
  const config = getPayPalPlatformConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (config.bnCode) {
    headers['PayPal-Partner-Attribution-Id'] = config.bnCode;
  }
  if (sellerMerchantId) {
    headers['PayPal-Auth-Assertion'] = buildPayPalAuthAssertion(
      config.clientId,
      sellerMerchantId
    );
  }
  return headers;
}

export function getPayPalPartnerConfigError(): string | null {
  if (!isPayPalPartnerConfigured()) {
    return 'PayPal partner is not configured. Set PAYPAL_PARTNER_MERCHANT_ID.';
  }
  return null;
}

/** Creates a Partner Referrals link for restaurant owner onboarding. */
export async function createPartnerReferral(params: {
  trackingId: string;
  returnUrl: string;
  restaurantName?: string;
}): Promise<{ actionUrl: string; partnerReferralId: string | null }> {
  const config = getPayPalPlatformConfig();
  if (!config.partnerMerchantId) {
    throw new Error('PAYPAL_PARTNER_MERCHANT_ID is not set');
  }
  const token = await getPayPalAccessToken();

  const res = await fetch(`${config.baseUrl}/v2/customer/partner-referrals`, {
    method: 'POST',
    headers: partnerHeaders(token),
    body: JSON.stringify({
      tracking_id: params.trackingId,
      operations: [
        {
          operation: 'API_INTEGRATION',
          api_integration_preference: {
            rest_api_integration: {
              integration_method: 'PAYPAL',
              integration_type: 'THIRD_PARTY',
              third_party_details: {
                features: ['PAYMENT', 'REFUND'],
              },
            },
          },
        },
      ],
      products: ['EXPRESS_CHECKOUT'],
      legal_consents: [
        {
          type: 'SHARE_DATA_CONSENT',
          granted: true,
        },
      ],
      partner_config_override: {
        return_url: params.returnUrl,
        return_url_description: 'Return to your restaurant dashboard',
        partner_logo_url:
          process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined,
      },
      business_entity: params.restaurantName
        ? { names: [{ type: 'LEGAL', name: params.restaurantName.slice(0, 300) }] }
        : undefined,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Partner referral failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json()) as {
    links?: Array<{ rel?: string; href?: string }>;
  };
  const actionUrl =
    json.links?.find((l) => l.rel === 'action_url')?.href ?? null;
  const selfHref = json.links?.find((l) => l.rel === 'self')?.href ?? '';
  const partnerReferralId = selfHref
    ? selfHref.split('/').pop() ?? null
    : null;

  if (!actionUrl) {
    throw new Error('PayPal did not return an onboarding action_url');
  }

  return { actionUrl, partnerReferralId };
}

/** Fetches live merchant integration status from PayPal. */
export async function getMerchantIntegrationStatus(
  sellerMerchantId: string
): Promise<MerchantIntegrationStatus> {
  const config = getPayPalPlatformConfig();
  if (!config.partnerMerchantId) {
    throw new Error('PAYPAL_PARTNER_MERCHANT_ID is not set');
  }
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${config.baseUrl}/v1/customer/partners/${encodeURIComponent(config.partnerMerchantId)}/merchant-integrations/${encodeURIComponent(sellerMerchantId)}`,
    {
      headers: partnerHeaders(token, sellerMerchantId),
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Merchant status failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json()) as {
    merchant_id?: string;
    permissions_granted?: boolean;
    payments_receivable?: boolean;
    primary_email?: string;
    country?: string;
    primary_currency?: string;
    products?: Array<{ name?: string; status?: string }>;
  };

  const productStatus =
    json.products?.find((p) => p.name === 'EXPRESS_CHECKOUT')?.status ??
    json.products?.[0]?.status ??
    null;

  return {
    merchantId: json.merchant_id ?? sellerMerchantId,
    permissionsGranted: json.permissions_granted === true,
    paymentsReceivable: json.payments_receivable === true,
    primaryEmail: json.primary_email ?? null,
    countryCode: json.country ?? null,
    currencyCode: json.primary_currency ?? null,
    accountStatus: productStatus,
  };
}

/** Lookup merchant by tracking_id (restaurantId) after onboarding redirect. */
export async function getMerchantIntegrationByTrackingId(
  trackingId: string
): Promise<MerchantIntegrationStatus | null> {
  const config = getPayPalPlatformConfig();
  if (!config.partnerMerchantId) {
    throw new Error('PAYPAL_PARTNER_MERCHANT_ID is not set');
  }
  const token = await getPayPalAccessToken();

  const url = new URL(
    `${config.baseUrl}/v1/customer/partners/${encodeURIComponent(config.partnerMerchantId)}/merchant-integrations`
  );
  url.searchParams.set('tracking_id', trackingId);

  const res = await fetch(url.toString(), {
    headers: partnerHeaders(token),
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Merchant lookup failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json()) as {
    merchant_id?: string;
    permissions_granted?: boolean;
    payments_receivable?: boolean;
    primary_email?: string;
    country?: string;
    primary_currency?: string;
    products?: Array<{ name?: string; status?: string }>;
  };

  if (!json.merchant_id) return null;

  const productStatus =
    json.products?.find((p) => p.name === 'EXPRESS_CHECKOUT')?.status ??
    json.products?.[0]?.status ??
    null;

  return {
    merchantId: json.merchant_id,
    permissionsGranted: json.permissions_granted === true,
    paymentsReceivable: json.payments_receivable === true,
    primaryEmail: json.primary_email ?? null,
    countryCode: json.country ?? null,
    currencyCode: json.primary_currency ?? null,
    accountStatus: productStatus,
  };
}
