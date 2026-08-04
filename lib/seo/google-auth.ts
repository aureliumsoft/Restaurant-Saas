import { createSign } from 'crypto';

import { getPlatformSetting } from '@/lib/platform-settings';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Scopes for Search Console + GA4 reporting (read-only). */
export const GOOGLE_REPORTING_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ');

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

type ReportingAuthSources = {
  serviceAccountRaw: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Prefer Admin → SEO platform settings; fall back to env for servers that still
 * inject secrets that way.
 */
export async function loadGoogleReportingAuthSources(): Promise<ReportingAuthSources> {
  const [saDb, clientIdDb, clientSecretDb, refreshDb] = await Promise.all([
    getPlatformSetting('seo_google_reporting_service_account_json'),
    getPlatformSetting('seo_google_client_id'),
    getPlatformSetting('seo_google_client_secret'),
    getPlatformSetting('seo_google_reporting_refresh_token'),
  ]);

  return {
    serviceAccountRaw:
      saDb.trim() ||
      process.env.GOOGLE_REPORTING_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_GSC_SERVICE_ACCOUNT_JSON?.trim() ||
      '',
    clientId:
      clientIdDb.trim() ||
      process.env.GOOGLE_GSC_CLIENT_ID?.trim() ||
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      '',
    clientSecret:
      clientSecretDb.trim() ||
      process.env.GOOGLE_GSC_CLIENT_SECRET?.trim() ||
      process.env.GOOGLE_CLIENT_SECRET?.trim() ||
      '',
    refreshToken:
      refreshDb.trim() ||
      process.env.GOOGLE_REPORTING_REFRESH_TOKEN?.trim() ||
      process.env.GOOGLE_GSC_REFRESH_TOKEN?.trim() ||
      '',
  };
}

function parseServiceAccount(raw: string): ServiceAccountJson | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch {
    return null;
  }
}

export async function isGoogleReportingAuthConfigured(): Promise<boolean> {
  const src = await loadGoogleReportingAuthSources();
  if (parseServiceAccount(src.serviceAccountRaw)) return true;
  return Boolean(src.refreshToken && src.clientId && src.clientSecret);
}

async function accessTokenFromServiceAccount(
  sa: ServiceAccountJson
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: GOOGLE_REPORTING_SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64urlJson(header)}.${base64urlJson(claim)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token (SA) failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Google access_token missing (SA)');
  return json.access_token;
}

async function accessTokenFromRefreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token (refresh) failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Google access_token missing (refresh)');
  return json.access_token;
}

let cachedToken: { token: string; expiresAt: number; fingerprint: string } | null =
  null;

function authFingerprint(src: ReportingAuthSources): string {
  return [
    src.serviceAccountRaw.slice(0, 64),
    src.clientId,
    src.clientSecret.slice(0, 8),
    src.refreshToken.slice(0, 12),
  ].join('|');
}

/** Clear cached access token (e.g. after settings save). */
export function clearGoogleReportingTokenCache(): void {
  cachedToken = null;
}

/** Cached access token (memory) for GA4 + GSC reporting. */
export async function getGoogleReportingAccessToken(): Promise<string> {
  const src = await loadGoogleReportingAuthSources();
  const fingerprint = authFingerprint(src);

  if (
    cachedToken &&
    cachedToken.fingerprint === fingerprint &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.token;
  }

  const sa = parseServiceAccount(src.serviceAccountRaw);
  let token: string;
  if (sa) {
    token = await accessTokenFromServiceAccount(sa);
  } else if (src.refreshToken && src.clientId && src.clientSecret) {
    token = await accessTokenFromRefreshToken(
      src.clientId,
      src.clientSecret,
      src.refreshToken
    );
  } else {
    throw new Error(
      'Google reporting auth not configured (service account JSON or OAuth client + refresh token).'
    );
  }

  cachedToken = {
    token,
    fingerprint,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return token;
}
