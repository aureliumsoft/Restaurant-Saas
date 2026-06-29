/** ISO 3166-1 alpha-2 codes supported for PayPal `buyer-country` SDK param. */
export const PAYPAL_BUYER_COUNTRIES = [
  { code: 'AU', label: 'Australia' },
  { code: 'AT', label: 'Austria' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CA', label: 'Canada' },
  { code: 'CN', label: 'China' },
  { code: 'CY', label: 'Cyprus' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DK', label: 'Denmark' },
  { code: 'EE', label: 'Estonia' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'GR', label: 'Greece' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'HU', label: 'Hungary' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IT', label: 'Italy' },
  { code: 'JP', label: 'Japan' },
  { code: 'LV', label: 'Latvia' },
  { code: 'LT', label: 'Lithuania' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'MT', label: 'Malta' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'NO', label: 'Norway' },
  { code: 'PK', label: 'Pakistan' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'RO', label: 'Romania' },
  { code: 'SG', label: 'Singapore' },
  { code: 'SK', label: 'Slovakia' },
  { code: 'SI', label: 'Slovenia' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
] as const;

export function normalizePayPalCountryCode(
  raw: string | null | undefined,
  fallback = 'DE'
): string {
  const code = raw?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) {
    return code;
  }
  return fallback;
}

/** Fallback when no country is configured (currency-based guess). */
export function defaultPayPalCountryForCurrency(currency: string): string {
  switch (currency.trim().toUpperCase()) {
    case 'EUR':
      return 'ES';
    case 'PKR':
      return 'PK';
    case 'GBP':
      return 'GB';
    case 'USD':
      return 'US';
    case 'AUD':
      return 'AU';
    case 'CAD':
      return 'CA';
    default:
      return 'ES';
  }
}

export function resolvePayPalBuyerCountry(
  countryCode: string | null | undefined,
  currency: string
): string {
  const normalized = countryCode?.trim().toUpperCase();
  if (normalized && /^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }
  return defaultPayPalCountryForCurrency(currency);
}
