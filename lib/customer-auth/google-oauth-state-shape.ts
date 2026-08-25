/**
 * Edge-safe structural check for customer Google OAuth `state`.
 * Does not verify HMAC — the Node callback still does that.
 */
export function looksLikeCustomerGoogleOAuthState(
  raw: string | null | undefined
): boolean {
  if (!raw?.trim()) return false;
  try {
    const b64 = raw.trim().replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const envelope = JSON.parse(json) as { json?: string; sig?: string };
    if (!envelope.json || !envelope.sig) return false;
    const data = JSON.parse(envelope.json) as {
      restaurantSlug?: string;
      returnTo?: string;
    };
    return Boolean(
      data.restaurantSlug?.trim() &&
        data.returnTo?.startsWith('/') &&
        !data.returnTo.startsWith('//')
    );
  } catch {
    return false;
  }
}
