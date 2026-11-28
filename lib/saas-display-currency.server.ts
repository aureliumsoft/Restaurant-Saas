import { getEurToPkrRate } from '@/lib/eur-pkr-rate';
import type { SaasDisplayCurrency } from '@/lib/saas-display-currency';
import { resolveVisitorCountryCode } from '@/lib/visitor-country';

/** Server-only: Cloudflare country + FX rate for SaaS price display. */
export async function getSaasDisplayCurrency(): Promise<SaasDisplayCurrency> {
  const country = await resolveVisitorCountryCode();
  if (country !== 'PK') {
    return { code: 'EUR', rate: null };
  }

  const rate = await getEurToPkrRate();
  if (rate == null) {
    return { code: 'EUR', rate: null };
  }

  return { code: 'PKR', rate };
}
