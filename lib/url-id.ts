import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  scryptSync,
} from 'crypto';

import { URL_ID_PREFIX, isEncodedUrlId } from '@/lib/url-id-shared';

export { URL_ID_PREFIX, isEncodedUrlId } from '@/lib/url-id-shared';

const ALGO = 'aes-256-gcm';

/** Query params that may carry encrypted database ids. */
export const URL_ID_QUERY_PARAM_KEYS = [
  'orderId',
  'tableID',
  'tableId',
  'table_id',
  'branchId',
  'itemId',
  'categoryId',
  'variationId',
  'ingredientId',
  'ticketId',
  'employeeId',
  'inviteId',
  'roleId',
  'offerId',
  'groupId',
  'subscriberId',
  'requestId',
] as const;

function getEncryptionKey(): Buffer {
  const raw = process.env.URL_ID_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    return scryptSync(raw, 'foodluk-url-id', 32);
  }
  const fallback = process.env.NEXTAUTH_SECRET?.trim();
  if (!fallback) {
    if (process.env.NODE_ENV !== 'production') {
      return scryptSync('dev-url-id-secret', 'foodluk-url-id', 32);
    }
    throw new Error(
      'URL_ID_ENCRYPTION_KEY or NEXTAUTH_SECRET is required for URL id encryption.'
    );
  }
  return scryptSync(fallback, 'foodluk-url-id', 32);
}

/** Stable IV so the same id always produces the same URL token. */
function deriveIv(plaintext: string, key: Buffer): Buffer {
  return createHmac('sha256', key).update(plaintext).digest().subarray(0, 12);
}

/** Encrypt a database id for use in URLs. Idempotent when already encoded. */
export function encodeUrlId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  if (isEncodedUrlId(trimmed)) return trimmed;

  const key = getEncryptionKey();
  const iv = deriveIv(trimmed, key);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]);
  return `${URL_ID_PREFIX}${payload.toString('base64url')}`;
}

/** Decrypt an encoded URL id. Plain UUIDs/cuids are returned unchanged. */
export function decodeUrlId(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return trimmed;
  if (!isEncodedUrlId(trimmed)) return trimmed;

  const payload = Buffer.from(trimmed.slice(URL_ID_PREFIX.length), 'base64url');
  if (payload.length < 12 + 16 + 1) {
    throw new Error('Invalid encoded id.');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/** Alias for decodeUrlId — accepts legacy plain ids. */
export function resolveUrlId(token: string): string {
  return decodeUrlId(token);
}

export function encodeUrlIds(ids: string[]): string[] {
  return ids.map((id) => encodeUrlId(id));
}
