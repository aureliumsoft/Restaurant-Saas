import type { NextRequest } from 'next/server';

/** Normalize env URL or origin string to `https://host` (no trailing slash). */
export function normalizeAppOrigin(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

/** Origins allowed for post-OAuth redirects (env + local dev). */
export function configuredAppOrigins(): string[] {
  const origins = new Set<string>();
  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL,
  ]) {
    const normalized = normalizeAppOrigin(raw);
    if (normalized) origins.add(normalized);
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return [...origins];
}

export function isAllowedAppOrigin(origin?: string | null): boolean {
  const normalized = normalizeAppOrigin(origin);
  if (!normalized) return false;
  return configuredAppOrigins().includes(normalized);
}

/** Best-effort origin from proxy headers or the incoming request URL. */
export function requestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = req.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  if (forwardedHost) {
    const proto = forwardedProto || 'https';
    return `${proto}://${forwardedHost}`;
  }
  return req.nextUrl.origin;
}

/**
 * Canonical public origin for OAuth redirect_uri registration.
 * Prefer NEXT_PUBLIC_APP_URL over NEXTAUTH_URL so customer login matches the live domain.
 */
export function getConfiguredAppOrigin(): string {
  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL,
  ]) {
    const normalized = normalizeAppOrigin(raw);
    if (normalized) return normalized;
  }
  return 'http://localhost:3000';
}

/**
 * Where to send the user after customer Google OAuth.
 * Uses the origin stored at sign-in start, else configured public URL — not localhost
 * when NEXT_PUBLIC_APP_URL points at production.
 */
export function resolveCustomerOAuthAppOrigin(options?: {
  req?: NextRequest;
  stateOrigin?: string | null;
}): string {
  const configured = getConfiguredAppOrigin();
  const configuredIsLocal =
    configured.startsWith('http://localhost') ||
    configured.startsWith('http://127.0.0.1');

  if (options?.stateOrigin) {
    const fromState = normalizeAppOrigin(options.stateOrigin);
    if (fromState && isAllowedAppOrigin(fromState)) {
      const stateIsLocal =
        fromState.startsWith('http://localhost') ||
        fromState.startsWith('http://127.0.0.1');
      if (!stateIsLocal || configuredIsLocal) {
        return fromState;
      }
    }
  }

  if (!configuredIsLocal) {
    return configured;
  }

  if (options?.req) {
    const fromReq = normalizeAppOrigin(requestOrigin(options.req));
    if (fromReq && isAllowedAppOrigin(fromReq)) {
      return fromReq;
    }
  }

  return configured;
}

/** Server-only public origin for metadata / sitemap. */
export function getBaseUrl(): string {
  return getConfiguredAppOrigin();
}

/** Build an absolute URL for a same-app path using the resolved public origin. */
export function absoluteAppUrl(
  path: string,
  options?: { req?: NextRequest; stateOrigin?: string | null }
): string {
  const origin = resolveCustomerOAuthAppOrigin(options);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin.replace(/\/$/, '')}${normalizedPath}`;
}
