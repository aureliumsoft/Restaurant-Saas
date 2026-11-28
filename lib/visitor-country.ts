import { headers } from 'next/headers';

const IGNORED_COUNTRY_CODES = new Set(['XX', 'T1']);

/**
 * Visitor country from Cloudflare `CF-IPCountry` (Option B).
 * Dev override: `SAAS_FORCE_DISPLAY_COUNTRY=PK` (or any ISO code).
 */
export async function resolveVisitorCountryCode(): Promise<string | null> {
  const forced = process.env.SAAS_FORCE_DISPLAY_COUNTRY?.trim().toUpperCase();
  if (forced && /^[A-Z]{2}$/.test(forced) && !IGNORED_COUNTRY_CODES.has(forced)) {
    return forced;
  }

  const h = await headers();
  const raw =
    h.get('cf-ipcountry') ??
    h.get('CF-IPCountry') ??
    h.get('CF-IPCOUNTRY');
  const code = raw?.trim().toUpperCase() ?? null;
  if (!code || !/^[A-Z]{2}$/.test(code) || IGNORED_COUNTRY_CODES.has(code)) {
    return null;
  }
  return code;
}
