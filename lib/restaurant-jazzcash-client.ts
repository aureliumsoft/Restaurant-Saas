import { createHmac, timingSafeEqual } from 'crypto';

export type RestaurantJazzCashRuntimeConfig = {
  merchantId: string;
  password: string;
  integritySalt: string;
  mode: 'sandbox' | 'live';
};

export function normalizeJazzCashMode(
  mode: string | null | undefined
): 'sandbox' | 'live' {
  return mode === 'live' ? 'live' : 'sandbox';
}

export function toRestaurantJazzCashRuntimeConfig(input: {
  merchantId: string;
  password: string;
  integritySalt: string;
  mode?: string | null;
}): RestaurantJazzCashRuntimeConfig {
  return {
    merchantId: input.merchantId.trim(),
    password: input.password,
    integritySalt: input.integritySalt,
    mode: normalizeJazzCashMode(input.mode),
  };
}

export function getJazzCashHostedCheckoutUrl(
  mode: 'sandbox' | 'live'
): string {
  return mode === 'live'
    ? 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/'
    : 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';
}

const JAZZCASH_RETURN_PATH = '/api/jazzcash/return';

/** Normalize domain or URL into a JazzCash-compatible HTTPS callback URL. */
export function normalizeJazzCashReturnUrl(input: string): string {
  let raw = input.trim();
  if (!raw) {
    throw new Error('JazzCash return URL is required.');
  }
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  const parsed = new URL(raw);
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = JAZZCASH_RETURN_PATH;
  }
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
    );
  } catch {
    return true;
  }
}

/**
 * JazzCash rejects localhost/private callback URLs.
 * Use JAZZCASH_RETURN_URL when developing locally.
 */
export function resolveJazzCashReturnUrl(requestOrigin: string): string {
  const fromEnv =
    process.env.JAZZCASH_RETURN_URL?.trim() ||
    process.env.NEXT_PUBLIC_JAZZCASH_RETURN_URL?.trim();
  if (fromEnv) {
    return normalizeJazzCashReturnUrl(fromEnv);
  }

  const origin = requestOrigin.replace(/\/$/, '');
  if (isLocalOrigin(origin)) {
    throw new Error(
      'JazzCash cannot use a localhost return URL. Set JAZZCASH_RETURN_URL to your public callback URL (for example https://foodluk.com/api/jazzcash/return) and register the same URL in the JazzCash merchant portal.'
    );
  }

  return normalizeJazzCashReturnUrl(`${origin}${JAZZCASH_RETURN_PATH}`);
}

/** JazzCash amounts are in paisa (PKR major units × 100). */
export function toJazzCashAmountPaisa(amountMajor: number): string {
  const paisa = Math.round(Number(amountMajor) * 100);
  if (!Number.isFinite(paisa) || paisa <= 0) {
    throw new Error('Invalid JazzCash amount.');
  }
  return String(paisa);
}

function formatJazzCashDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function sanitizeJazzCashDescription(input: string): string {
  // Keep a conservative ASCII subset to avoid gateway-side "invalid value" errors.
  const cleaned = input
    .replace(/[^A-Za-z0-9 .,_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Order payment').slice(0, 100);
}

/**
 * HMAC-SHA256 over integrity salt + sorted non-empty PP fields,
 * matching JazzCash Merchant hosted checkout docs.
 * Only keys beginning with "pp" are hashed (case-insensitive).
 */
export function computeJazzCashSecureHash(
  fields: Record<string, string>,
  integritySalt: string
): string {
  const sortedKeys = Object.keys(fields)
    .filter((key) => {
      if (!key.toLowerCase().startsWith('pp')) return false;
      if (key.toLowerCase() === 'pp_securehash') return false;
      const value = fields[key];
      return value !== undefined && value !== null && String(value).length > 0;
    })
    // JazzCash requires ascending ASCII order of field names.
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let hashString = integritySalt;
  for (const key of sortedKeys) {
    hashString += `&${fields[key]}`;
  }

  return createHmac('sha256', integritySalt)
    .update(hashString, 'utf8')
    .digest('hex')
    .toUpperCase();
}

export function verifyJazzCashSecureHash(
  fields: Record<string, string>,
  integritySalt: string
): boolean {
  const received = (fields.pp_SecureHash ?? '').trim().toUpperCase();
  if (!received) return false;
  const expected = computeJazzCashSecureHash(fields, integritySalt);
  try {
    const a = Buffer.from(received, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isJazzCashPaymentSuccessful(
  responseCode: string | undefined | null
): boolean {
  return String(responseCode ?? '').trim() === '000';
}

export type JazzCashHostedCheckoutInput = {
  amountMajor: number;
  billReference: string;
  description: string;
  returnUrl: string;
  txnRefNo: string;
  language?: string;
};

export type JazzCashHostedCheckoutResult = {
  gatewayUrl: string;
  fields: Record<string, string>;
};

export function buildJazzCashHostedCheckout(
  config: RestaurantJazzCashRuntimeConfig,
  input: JazzCashHostedCheckoutInput
): JazzCashHostedCheckoutResult {
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 60 * 1000);

  const fields: Record<string, string> = {
    pp_Version: '1.1',
    pp_TxnType: 'MPAY',
    pp_Language: input.language ?? 'EN',
    pp_MerchantID: config.merchantId,
    pp_SubMerchantID: '',
    pp_Password: config.password,
    pp_TxnRefNo: input.txnRefNo,
    pp_Amount: toJazzCashAmountPaisa(input.amountMajor),
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: formatJazzCashDateTime(now),
    pp_BillReference: input.billReference.slice(0, 50),
    pp_Description: sanitizeJazzCashDescription(input.description),
    pp_TxnExpiryDateTime: formatJazzCashDateTime(expiry),
    pp_ReturnURL: input.returnUrl,
    ppmpf_1: '',
    ppmpf_2: '',
    ppmpf_3: '',
    ppmpf_4: '',
    ppmpf_5: '',
  };

  fields.pp_SecureHash = computeJazzCashSecureHash(
    fields,
    config.integritySalt
  );

  return {
    gatewayUrl: getJazzCashHostedCheckoutUrl(config.mode),
    fields,
  };
}

/** Local validation: credentials present and hash round-trips. */
export function testRestaurantJazzCashCredentials(
  config: RestaurantJazzCashRuntimeConfig
): void {
  if (!config.merchantId.trim()) {
    throw new Error('Merchant ID is required.');
  }
  if (!config.password.trim()) {
    throw new Error('Password is required.');
  }
  if (!config.integritySalt.trim()) {
    throw new Error('Integrity salt is required.');
  }
  const sample = buildJazzCashHostedCheckout(config, {
    amountMajor: 1,
    billReference: 'TEST',
    description: 'Credential test',
    returnUrl: 'https://example.com/return',
    txnRefNo: `T${formatJazzCashDateTime(new Date())}`,
  });
  if (!verifyJazzCashSecureHash(sample.fields, config.integritySalt)) {
    throw new Error('JazzCash secure hash self-check failed.');
  }
}
