import { createHmac, timingSafeEqual } from 'crypto';

export type RestaurantEasypaisaRuntimeConfig = {
  storeId: string;
  hashKey: string;
  username: string | null;
  password: string | null;
  mode: 'sandbox' | 'live';
};

export function normalizeEasypaisaMode(
  mode: string | null | undefined
): 'sandbox' | 'live' {
  return mode === 'live' ? 'live' : 'sandbox';
}

export function toRestaurantEasypaisaRuntimeConfig(input: {
  storeId: string;
  hashKey: string;
  username?: string | null;
  password?: string | null;
  mode?: string | null;
}): RestaurantEasypaisaRuntimeConfig {
  return {
    storeId: String(input.storeId).trim(),
    hashKey: input.hashKey,
    username: input.username?.trim() || null,
    password: input.password || null,
    mode: normalizeEasypaisaMode(input.mode),
  };
}

export function getEasypaisaHostedCheckoutUrl(
  mode: 'sandbox' | 'live'
): string {
  return mode === 'live'
    ? 'https://easypay.easypaisa.com.pk/easypay/Index.jsf'
    : 'https://easypaystg.easypaisa.com.pk/easypay/Index.jsf';
}

function formatEasypaisaTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())} ` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Hosted checkout hash: HMAC-SHA256 over canonical key=value map, Base64.
 * Field order matches common Easypaisa merchant hosted integration kits.
 */
export function computeEasypaisaMerchantHash(
  params: {
    amount: string;
    orderRefNum: string;
    paymentMethod: string;
    postBackURL: string;
    storeId: string;
    timeStamp: string;
  },
  hashKey: string
): string {
  const mapString =
    `amount=${params.amount}&` +
    `orderRefNum=${params.orderRefNum}&` +
    `paymentMethod=${params.paymentMethod}&` +
    `postBackURL=${params.postBackURL}&` +
    `storeId=${params.storeId}&` +
    `timeStamp=${params.timeStamp}`;

  return createHmac('sha256', hashKey)
    .update(mapString, 'utf8')
    .digest('base64');
}

export function verifyEasypaisaReturnHash(
  fields: Record<string, string>,
  hashKey: string
): boolean {
  const received = (
    fields.merchantHashedReq ||
    fields.encryptedHashRequest ||
    fields.hashKey ||
    ''
  ).trim();
  if (!received) {
    // Some Easypaisa postbacks omit hash; treat as unverified.
    return false;
  }

  const amount = fields.amount ?? fields.Amount ?? '';
  const orderRefNum = fields.orderRefNum ?? fields.orderRefNumber ?? '';
  const paymentMethod =
    fields.paymentMethod ?? fields.PaymentMethod ?? 'InitialRequest';
  const postBackURL = fields.postBackURL ?? fields.postBackUrl ?? '';
  const storeId = fields.storeId ?? fields.StoreId ?? '';
  const timeStamp = fields.timeStamp ?? fields.transactionDateTime ?? '';

  if (!amount || !orderRefNum || !storeId) return false;

  const expected = computeEasypaisaMerchantHash(
    {
      amount,
      orderRefNum,
      paymentMethod,
      postBackURL,
      storeId,
      timeStamp,
    },
    hashKey
  );

  try {
    const a = Buffer.from(received, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) {
      // Fallback: compare case-insensitive hex if lengths differ.
      return received.toLowerCase() === expected.toLowerCase();
    }
    return timingSafeEqual(a, b);
  } catch {
    return received === expected;
  }
}

export function isEasypaisaPaymentSuccessful(
  fields: Record<string, string>
): boolean {
  const status = String(
    fields.responseCode ??
      fields.ResponseCode ??
      fields.status ??
      fields.transactionStatus ??
      ''
  )
    .trim()
    .toUpperCase();
  // Common success markers across Easypaisa hosted variants.
  return (
    status === '0000' ||
    status === '000' ||
    status === 'SUCCESS' ||
    status === 'PAID' ||
    status === 'COMPLETED'
  );
}

export type EasypaisaHostedCheckoutInput = {
  amountMajor: number;
  orderRefNum: string;
  postBackURL: string;
  paymentMethod?: string;
};

export type EasypaisaHostedCheckoutResult = {
  gatewayUrl: string;
  fields: Record<string, string>;
};

export function buildEasypaisaHostedCheckout(
  config: RestaurantEasypaisaRuntimeConfig,
  input: EasypaisaHostedCheckoutInput
): EasypaisaHostedCheckoutResult {
  const amount = Number(input.amountMajor);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid Easypaisa amount.');
  }
  // Easypaisa typically expects one decimal (e.g. 10.0).
  const amountStr = amount.toFixed(1);
  const paymentMethod = input.paymentMethod ?? 'InitialRequest';
  const timeStamp = formatEasypaisaTimestamp(new Date());
  const orderRefNum = input.orderRefNum.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  if (!orderRefNum) {
    throw new Error('Invalid Easypaisa order reference.');
  }

  const encryptedHashRequest = computeEasypaisaMerchantHash(
    {
      amount: amountStr,
      orderRefNum,
      paymentMethod,
      postBackURL: input.postBackURL,
      storeId: config.storeId,
      timeStamp,
    },
    config.hashKey
  );

  const fields: Record<string, string> = {
    amount: amountStr,
    storeId: config.storeId,
    postBackURL: input.postBackURL,
    orderRefNum,
    expiryDate: '',
    autoRedirect: '1',
    merchantHashedReq: encryptedHashRequest,
    encryptedHashRequest,
    paymentMethod,
    timeStamp,
  };

  return {
    gatewayUrl: getEasypaisaHostedCheckoutUrl(config.mode),
    fields,
  };
}

export function testRestaurantEasypaisaCredentials(
  config: RestaurantEasypaisaRuntimeConfig
): void {
  if (!config.storeId.trim()) {
    throw new Error('Store ID is required.');
  }
  if (!config.hashKey.trim()) {
    throw new Error('Hash key is required.');
  }
  const sample = buildEasypaisaHostedCheckout(config, {
    amountMajor: 1,
    orderRefNum: `T${Date.now()}`.slice(0, 20),
    postBackURL: 'https://example.com/return',
  });
  if (!sample.fields.merchantHashedReq) {
    throw new Error('Easypaisa hash self-check failed.');
  }
}
