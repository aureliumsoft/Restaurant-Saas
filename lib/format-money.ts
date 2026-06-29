import {
  DEFAULT_RESTAURANT_REGIONAL,
  getRestaurantCurrencySymbol,
  localeForRegionalSettings,
  normalizeRestaurantCountryCode,
  normalizeRestaurantCurrencyCode,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';

export type FormatMoneyOptions = Partial<RestaurantRegionalSettings> & {
  /** When true, returns only the numeric part (no currency symbol). */
  amountOnly?: boolean;
  locale?: string;
};

function resolveRegional(opts?: FormatMoneyOptions): RestaurantRegionalSettings {
  return {
    currencyCode: normalizeRestaurantCurrencyCode(
      opts?.currencyCode ?? DEFAULT_RESTAURANT_REGIONAL.currencyCode
    ),
    countryCode: normalizeRestaurantCountryCode(
      opts?.countryCode ?? DEFAULT_RESTAURANT_REGIONAL.countryCode
    ),
  };
}

/** Numeric amount with 2 decimal places (no symbol). */
export function formatMoneyAmount(
  amount: number,
  opts?: Pick<FormatMoneyOptions, 'locale'> & {
    countryCode?: string;
  }
): string {
  const countryCode = normalizeRestaurantCountryCode(opts?.countryCode);
  const locale = opts?.locale ?? localeForRegionalSettings({ countryCode });
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Full localized currency string (e.g. €12,34 or Rs1,234.00). */
export function formatCurrency(
  amount: number,
  opts?: FormatMoneyOptions
): string {
  const regional = resolveRegional(opts);
  const locale = opts?.locale ?? localeForRegionalSettings(regional);
  const safe = Number.isFinite(amount) ? amount : 0;

  if (opts?.amountOnly) {
    return formatMoneyAmount(safe, { locale, countryCode: regional.countryCode });
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: regional.currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/** Compact currency for KPI cards (e.g. €12.5k, Rs1.2M). */
export function formatCompactCurrency(
  amount: number,
  opts?: FormatMoneyOptions
): string {
  const regional = resolveRegional(opts);
  const symbol = getRestaurantCurrencySymbol(regional.currencyCode);
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);

  let compact: string;
  if (abs >= 1_000_000) {
    compact = `${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    compact = `${(abs / 1_000).toFixed(1)}k`;
  } else if (abs >= 100) {
    compact = abs.toFixed(0);
  } else {
    compact = abs.toFixed(2);
  }

  if (regional.currencyCode === 'PKR') {
    return `${symbol} ${compact}`;
  }
  return `${symbol} ${compact}`;
}

export function toStripeCurrencyCode(currencyCode: string): string {
  return normalizeRestaurantCurrencyCode(currencyCode).toLowerCase();
}

/** Currency code for PayPal (uppercase). */
export function toPayPalCurrencyCode(currencyCode: string): string {
  return normalizeRestaurantCurrencyCode(currencyCode);
}
