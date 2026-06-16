import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

function getEncryptionKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    return scryptSync(raw, 'restaurant-payment-credentials', 32);
  }
  const fallback = process.env.NEXTAUTH_SECRET?.trim();
  if (!fallback) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY or NEXTAUTH_SECRET is required to store payment credentials.'
    );
  }
  return scryptSync(fallback, 'restaurant-payment-credentials', 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential payload.');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskSecret(value: string, start = 4, end = 4): string {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= start + end) return '••••';
  return `${trimmed.slice(0, start)}…${trimmed.slice(-end)}`;
}
