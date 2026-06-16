import {
  defaultPayPalCountryForCurrency,
  normalizePayPalCountryCode,
} from '@/lib/paypal-buyer-countries';

export type RestaurantPayPalRuntimeConfig = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  mode: 'sandbox' | 'live';
  currency: string;
  countryCode: string;
};

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function paypalBaseUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function normalizePayPalMode(raw: string | null | undefined): 'sandbox' | 'live' {
  return raw?.trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
}

export function toRestaurantPayPalRuntimeConfig(params: {
  clientId: string;
  clientSecret: string;
  mode: string;
  currency?: string | null;
  countryCode?: string | null;
}): RestaurantPayPalRuntimeConfig {
  const mode = normalizePayPalMode(params.mode);
  const currency = (params.currency ?? 'EUR').toUpperCase();
  return {
    clientId: params.clientId.trim(),
    clientSecret: params.clientSecret.trim(),
    baseUrl: paypalBaseUrl(mode),
    mode,
    currency,
    countryCode: normalizePayPalCountryCode(
      params.countryCode,
      defaultPayPalCountryForCurrency(currency)
    ),
  };
}

export async function testRestaurantPayPalCredentials(
  config: RestaurantPayPalRuntimeConfig
): Promise<void> {
  await getRestaurantPayPalAccessToken(config);
}

export async function getRestaurantPayPalAccessToken(
  config: RestaurantPayPalRuntimeConfig
): Promise<string> {
  const cacheKey = config.clientId;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const auth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    'utf8'
  ).toString('base64');
  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal authentication failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error('PayPal did not return an access token.');
  }
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 300) * 1000,
  });
  return json.access_token;
}

function metadataToCustomId(metadata: PayPalOrderMetadata): string {
  return JSON.stringify(metadata).slice(0, 120);
}

async function authorizeHeaders(config: RestaurantPayPalRuntimeConfig) {
  const token = await getRestaurantPayPalAccessToken(config);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

export async function createRestaurantPayPalOrder(
  config: RestaurantPayPalRuntimeConfig,
  params: {
    amount: number;
    currency: string;
    title: string;
    returnUrl: string;
    cancelUrl: string;
    metadata?: PayPalOrderMetadata;
  }
) {
  const headers = await authorizeHeaders(config);
  const res = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'default',
          description: params.title.slice(0, 127),
          custom_id: metadataToCustomId(params.metadata ?? {}),
          amount: {
            currency_code: params.currency.toUpperCase(),
            value: params.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        landing_page: 'NO_PREFERENCE',
      },
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal order create failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    id: string;
    links?: Array<{ rel?: string; href?: string }>;
  };
  const approveUrl =
    json.links?.find((l) => l.rel === 'approve')?.href ??
    json.links?.find((l) => l.rel === 'payer-action')?.href;
  if (!json.id || !approveUrl) {
    throw new Error('PayPal approval link missing.');
  }
  return { id: json.id, url: approveUrl };
}

export async function captureRestaurantPayPalOrder(
  config: RestaurantPayPalRuntimeConfig,
  orderId: string
) {
  const headers = await authorizeHeaders(config);
  const res = await fetch(
    `${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers,
      body: '{}',
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal capture failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return (await res.json()) as {
    id: string;
    status?: string;
    purchase_units?: Array<{
      custom_id?: string;
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: { value?: string; currency_code?: string };
        }>;
      };
    }>;
  };
}

export async function getRestaurantPayPalOrder(
  config: RestaurantPayPalRuntimeConfig,
  orderId: string
) {
  const token = await getRestaurantPayPalAccessToken(config);
  const res = await fetch(
    `${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal order fetch failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return (await res.json()) as {
    id: string;
    status?: string;
    purchase_units?: Array<{ custom_id?: string }>;
  };
}
