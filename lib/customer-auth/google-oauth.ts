import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type CustomerGoogleOAuthState = {
  restaurantSlug: string;
  returnTo: string;
  nonce: string;
  exp: number;
};

function oauthStateSecret(): string {
  return (
    process.env.CUSTOMER_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    'dev-customer-oauth-state'
  );
}

function signPayload(json: string): string {
  return createHmac('sha256', oauthStateSecret()).update(json).digest('base64url');
}

export function encodeCustomerGoogleOAuthState(payload: {
  restaurantSlug: string;
  returnTo: string;
}): string {
  const data: CustomerGoogleOAuthState = {
    restaurantSlug: payload.restaurantSlug.trim(),
    returnTo: payload.returnTo.trim(),
    nonce: randomBytes(16).toString('base64url'),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const json = JSON.stringify(data);
  const sig = signPayload(json);
  return Buffer.from(JSON.stringify({ json, sig })).toString('base64url');
}

export function decodeCustomerGoogleOAuthState(
  raw: string | null | undefined
): CustomerGoogleOAuthState | null {
  if (!raw?.trim()) return null;
  try {
    const envelope = JSON.parse(
      Buffer.from(raw.trim(), 'base64url').toString('utf8')
    ) as { json?: string; sig?: string };
    if (!envelope.json || !envelope.sig) return null;
    const expected = signPayload(envelope.json);
    const a = Buffer.from(expected);
    const b = Buffer.from(envelope.sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(envelope.json) as CustomerGoogleOAuthState;
    if (
      !data.restaurantSlug?.trim() ||
      !data.returnTo?.trim() ||
      typeof data.exp !== 'number' ||
      data.exp < Date.now()
    ) {
      return null;
    }
    if (!data.returnTo.startsWith('/') || data.returnTo.startsWith('//')) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function customerGoogleOAuthRedirectUri(origin: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/api/customer-auth/google/callback`;
}

export function buildCustomerGoogleAuthUrl(options: {
  origin: string;
  restaurantSlug: string;
  returnTo: string;
}): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return null;

  const redirectUri = customerGoogleOAuthRedirectUri(options.origin);
  const state = encodeCustomerGoogleOAuthState({
    restaurantSlug: options.restaurantSlug,
    returnTo: options.returnTo,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
};

export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string
): Promise<GoogleUserInfo | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error('customer google token exchange failed', tokenJson.error);
    return null;
  }

  const profileRes = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    }
  );
  const profile = (await profileRes.json().catch(() => ({}))) as GoogleUserInfo;
  if (!profileRes.ok || !profile.email?.trim()) {
    console.error('customer google userinfo failed');
    return null;
  }
  return profile;
}
