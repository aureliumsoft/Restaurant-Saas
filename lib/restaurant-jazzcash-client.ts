import { createHmac, timingSafeEqual } from 'crypto';

export type RestaurantJazzCashRuntimeConfig = {
  merchantId: string;
  password: string;
  integritySalt: string;
  mode: 'sandbox' | 'live';
  /** Exact Return URL registered in JazzCash Credential Generator. */
  returnUrl?: string | null;
};

export function normalizeJazzCashMode(
  mode: string | null | undefined
): 'sandbox' | 'live' {
  return mode === 'live' ? 'live' : 'sandbox';
}

/**
 * Strip copy/paste junk (ZWSP, NBSP, BOM) that breaks JazzCash auth while
 * looking identical to the portal values.
 */
export function sanitizeJazzCashCredential(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/\r\n?/g, '')
    .trim();
}

export function toRestaurantJazzCashRuntimeConfig(input: {
  merchantId: string;
  password: string;
  integritySalt: string;
  mode?: string | null;
  returnUrl?: string | null;
}): RestaurantJazzCashRuntimeConfig {
  const returnUrlRaw = input.returnUrl?.trim();
  return {
    merchantId: sanitizeJazzCashCredential(input.merchantId),
    // Portal pastes often include trailing whitespace/newlines that break
    // JazzCash authentication with "insufficient merchant information".
    password: sanitizeJazzCashCredential(input.password),
    integritySalt: sanitizeJazzCashCredential(input.integritySalt),
    mode: normalizeJazzCashMode(input.mode),
    returnUrl: returnUrlRaw
      ? normalizeJazzCashReturnUrlExact(returnUrlRaw)
      : null,
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

/**
 * Keep the Return URL exactly as registered in JazzCash Credential Generator.
 * Do not rewrite the path — a mismatch causes
 * "insufficient merchant information".
 */
export function normalizeJazzCashReturnUrlExact(input: string): string {
  let raw = sanitizeJazzCashCredential(input);
  if (!raw) {
    throw new Error('JazzCash return URL is required.');
  }
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:') {
    throw new Error(
      'JazzCash return URL must use HTTPS (as registered in the merchant portal).'
    );
  }
  parsed.search = '';
  parsed.hash = '';
  // Preserve pathname exactly (including trailing slash if present).
  const path =
    parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
  return `${parsed.origin}${path === '/' ? '' : path}`;
}

/**
 * Normalize a platform default domain/URL into the Foodluk callback path
 * when only an origin was provided.
 */
export function normalizeJazzCashReturnUrl(input: string): string {
  let raw = sanitizeJazzCashCredential(input);
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
  return normalizeJazzCashReturnUrlExact(parsed.toString());
}

/** Public default callback merchants should register in JazzCash portal. */
export function getDefaultJazzCashReturnUrl(): string {
  const fromEnv =
    process.env.JAZZCASH_RETURN_URL?.trim() ||
    process.env.NEXT_PUBLIC_JAZZCASH_RETURN_URL?.trim();
  if (fromEnv) {
    try {
      return normalizeJazzCashReturnUrl(fromEnv);
    } catch {
      /* fall through */
    }
  }
  return `https://foodluk.com${JAZZCASH_RETURN_PATH}`;
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
 * Prefer the restaurant's saved Return URL (must match Credential Generator),
 * then JAZZCASH_RETURN_URL, then the public request origin.
 *
 * CRITICAL: pp_ReturnURL must match the Return URL used when credentials
 * were generated, or JazzCash returns "insufficient merchant information".
 */
export function resolveJazzCashReturnUrl(
  requestOrigin: string,
  restaurantReturnUrl?: string | null
): string {
  const fromRestaurant = restaurantReturnUrl?.trim();
  if (fromRestaurant) {
    return normalizeJazzCashReturnUrlExact(fromRestaurant);
  }

  const fromEnv =
    process.env.JAZZCASH_RETURN_URL?.trim() ||
    process.env.NEXT_PUBLIC_JAZZCASH_RETURN_URL?.trim();
  if (fromEnv) {
    return normalizeJazzCashReturnUrl(fromEnv);
  }

  const origin = requestOrigin.replace(/\/$/, '');
  if (isLocalOrigin(origin)) {
    throw new Error(
      'JazzCash cannot use a localhost return URL. In JazzCash settings, set Return URL to your public callback (for example https://foodluk.com/api/jazzcash/return) — the same URL registered in the JazzCash Credential Generator.'
    );
  }

  return normalizeJazzCashReturnUrl(`${origin}${JAZZCASH_RETURN_PATH}`);
}

/**
 * JazzCash amounts are in paisa (PKR × 100), left-padded to 12 digits.
 * Example: PKR 100.00 → "000000010000"
 */
export function toJazzCashAmountPaisa(amountMajor: number): string {
  const paisa = Math.round(Number(amountMajor) * 100);
  if (!Number.isFinite(paisa) || paisa <= 0) {
    throw new Error('Invalid JazzCash amount.');
  }
  return String(paisa).padStart(12, '0');
}

/** JazzCash validates timestamps in Pakistan Standard Time. */
function formatJazzCashDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
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
 * Drop empty optional fields before hashing / posting.
 * JazzCash docs: empty values are excluded from the secure hash.
 * Posting empty merchant/sub-merchant fields can trigger
 * "insufficient merchant information".
 */
export function omitEmptyJazzCashFields(
  fields: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      out[key] = String(value);
    }
  }
  return out;
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
  const salt = integritySalt.trim();
  const sortedKeys = Object.keys(fields)
    .filter((key) => {
      if (!key.toLowerCase().startsWith('pp')) return false;
      if (key.toLowerCase() === 'pp_securehash') return false;
      const value = fields[key];
      return value !== undefined && value !== null && String(value).length > 0;
    })
    // JazzCash requires ascending ASCII order of field names.
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let hashString = salt;
  for (const key of sortedKeys) {
    hashString += `&${fields[key]}`;
  }

  return createHmac('sha256', salt)
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

/**
 * Build fields for JazzCash HTTP POST (Page Redirection) to merchantform.
 *
 * Important: do NOT use pp_TxnType=MPAY here — that is for the Card Purchase API.
 * For CustomerPortal/merchantform, leave TxnType empty so JazzCash shows
 * wallet / card / OTC options for the merchant.
 */
export function buildJazzCashHostedCheckout(
  config: RestaurantJazzCashRuntimeConfig,
  input: JazzCashHostedCheckoutInput
): JazzCashHostedCheckoutResult {
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 60 * 1000);
  const merchantId = config.merchantId.trim();
  const password = config.password.trim();
  const integritySalt = config.integritySalt.trim();

  if (!merchantId || !password || !integritySalt) {
    throw new Error(
      'JazzCash merchant ID, password, and integrity salt are required.'
    );
  }

  const fields: Record<string, string> = {
    pp_Version: '1.1',
    // Empty = page redirection (all instruments). Not "MPAY" (card API only).
    pp_TxnType: '',
    pp_Language: input.language ?? 'EN',
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_TxnRefNo: input.txnRefNo,
    pp_Amount: toJazzCashAmountPaisa(input.amountMajor),
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: formatJazzCashDateTime(now),
    pp_BillReference: input.billReference.slice(0, 25),
    pp_Description: sanitizeJazzCashDescription(input.description),
    pp_TxnExpiryDateTime: formatJazzCashDateTime(expiry),
    pp_ReturnURL: input.returnUrl.trim(),
  };

  fields.pp_SecureHash = computeJazzCashSecureHash(fields, integritySalt);

  return {
    gatewayUrl: getJazzCashHostedCheckoutUrl(config.mode),
    // Never POST empty optional fields — JazzCash may treat them as invalid
    // merchant/sub-merchant data.
    fields: omitEmptyJazzCashFields(fields),
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
    returnUrl:
      config.returnUrl?.trim() ||
      'https://foodluk.com/api/jazzcash/return',
    txnRefNo: `T${formatJazzCashDateTime(new Date())}`,
  });
  if (!verifyJazzCashSecureHash(sample.fields, config.integritySalt)) {
    throw new Error('JazzCash secure hash self-check failed.');
  }
  if (!sample.fields.pp_MerchantID || !sample.fields.pp_Password) {
    throw new Error('JazzCash merchant credentials missing from checkout payload.');
  }
  if (sample.fields.pp_Amount.length !== 12) {
    throw new Error('JazzCash amount must be 12-digit paisa string.');
  }
}
