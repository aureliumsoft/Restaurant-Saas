import { createSign } from 'crypto';

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

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function parseServiceAccount(): ServiceAccountJson | null {
  const raw = (
    process.env.GOOGLE_REPORTING_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GOOGLE_GSC_SERVICE_ACCOUNT_JSON?.trim() ||
    ''
  );
  if (!raw) return null;
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

export function isGoogleReportingAuthConfigured(): boolean {
  if (parseServiceAccount()) return true;
  const refresh =
    process.env.GOOGLE_REPORTING_REFRESH_TOKEN?.trim() ||
    process.env.GOOGLE_GSC_REFRESH_TOKEN?.trim();
  const clientId =
    process.env.GOOGLE_GSC_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret =
    process.env.GOOGLE_GSC_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(refresh && clientId && clientSecret);
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

async function accessTokenFromRefreshToken(): Promise<string> {
  const refresh = (
    process.env.GOOGLE_REPORTING_REFRESH_TOKEN?.trim() ||
    process.env.GOOGLE_GSC_REFRESH_TOKEN?.trim()
  )!;
  const clientId = (
    process.env.GOOGLE_GSC_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim()
  )!;
  const clientSecret = (
    process.env.GOOGLE_GSC_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  )!;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
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

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Cached access token (memory) for GA4 + GSC reporting. */
export async function getGoogleReportingAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const sa = parseServiceAccount();
  const token = sa
    ? await accessTokenFromServiceAccount(sa)
    : await accessTokenFromRefreshToken();
  cachedToken = {
    token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return token;
}
