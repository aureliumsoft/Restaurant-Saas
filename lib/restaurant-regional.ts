/** Supported restaurant currency / country options (owner settings). */

export const SUPPORTED_RESTAURANT_CURRENCIES = ['EUR', 'PKR'] as const;
export type RestaurantCurrencyCode = (typeof SUPPORTED_RESTAURANT_CURRENCIES)[number];

export const SUPPORTED_RESTAURANT_COUNTRIES = ['ES', 'PK'] as const;
export type RestaurantCountryCode = (typeof SUPPORTED_RESTAURANT_COUNTRIES)[number];

export type RestaurantRegionalSettings = {
  currencyCode: RestaurantCurrencyCode;
  countryCode: RestaurantCountryCode;
};

export const RESTAURANT_CURRENCY_OPTIONS: {
  code: RestaurantCurrencyCode;
  label: string;
  symbol: string;
}[] = [
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'PKR', label: 'Pakistani Rupee (Rs)', symbol: 'Rs' },
];

export const RESTAURANT_COUNTRY_OPTIONS: {
  code: RestaurantCountryCode;
  label: string;
  defaultCurrency: RestaurantCurrencyCode;
}[] = [
  { code: 'ES', label: 'Spain', defaultCurrency: 'EUR' },
  { code: 'PK', label: 'Pakistan', defaultCurrency: 'PKR' },
];

export const DEFAULT_RESTAURANT_REGIONAL: RestaurantRegionalSettings = {
  currencyCode: 'EUR',
  countryCode: 'ES',
};

export function isRestaurantCurrencyCode(
  value: string | null | undefined
): value is RestaurantCurrencyCode {
  return SUPPORTED_RESTAURANT_CURRENCIES.includes(
    value?.trim().toUpperCase() as RestaurantCurrencyCode
  );
}

export function isRestaurantCountryCode(
  value: string | null | undefined
): value is RestaurantCountryCode {
  return SUPPORTED_RESTAURANT_COUNTRIES.includes(
    value?.trim().toUpperCase() as RestaurantCountryCode
  );
}

export function normalizeRestaurantCurrencyCode(
  raw: string | null | undefined
): RestaurantCurrencyCode {
  const code = raw?.trim().toUpperCase();
  if (isRestaurantCurrencyCode(code)) return code;
  return DEFAULT_RESTAURANT_REGIONAL.currencyCode;
}

export function normalizeRestaurantCountryCode(
  raw: string | null | undefined
): RestaurantCountryCode {
  const code = raw?.trim().toUpperCase();
  if (isRestaurantCountryCode(code)) return code;
  return DEFAULT_RESTAURANT_REGIONAL.countryCode;
}

export function defaultCountryForCurrency(
  currency: string
): RestaurantCountryCode {
  switch (normalizeRestaurantCurrencyCode(currency)) {
    case 'PKR':
      return 'PK';
    case 'EUR':
    default:
      return 'ES';
  }
}

export function defaultCurrencyForCountry(
  country: string
): RestaurantCurrencyCode {
  const match = RESTAURANT_COUNTRY_OPTIONS.find(
    (c) => c.code === normalizeRestaurantCountryCode(country)
  );
  return match?.defaultCurrency ?? DEFAULT_RESTAURANT_REGIONAL.currencyCode;
}

export function localeForRegionalSettings(
  settings: Pick<RestaurantRegionalSettings, 'countryCode'>
): string {
  switch (normalizeRestaurantCountryCode(settings.countryCode)) {
    case 'PK':
      return 'en-PK';
    case 'ES':
    default:
      return 'es-ES';
  }
}

export function parseRestaurantRegionalSettings(
  row: Partial<RestaurantRegionalSettings> | null | undefined
): RestaurantRegionalSettings {
  const currencyCode = normalizeRestaurantCurrencyCode(row?.currencyCode);
  const countryCode = normalizeRestaurantCountryCode(
    row?.countryCode ?? defaultCountryForCurrency(currencyCode)
  );
  return { currencyCode, countryCode };
}

export function getRestaurantCurrencySymbol(
  currencyCode: RestaurantCurrencyCode
): string {
  return (
    RESTAURANT_CURRENCY_OPTIONS.find((c) => c.code === currencyCode)?.symbol ??
    currencyCode
  );
}

export function priceFieldLabel(currencyCode: RestaurantCurrencyCode): string {
  return `Price (${getRestaurantCurrencySymbol(currencyCode)})`;
}

export function salePriceFieldLabel(
  currencyCode: RestaurantCurrencyCode
): string {
  return `Sale price (${getRestaurantCurrencySymbol(currencyCode)}, optional)`;
}

export const RESTAURANT_REGIONAL_DB_SELECT = {
  currencyCode: true,
  countryCode: true,
} as const;
