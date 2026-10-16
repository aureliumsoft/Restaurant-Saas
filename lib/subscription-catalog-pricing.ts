export type BillingInterval = 'monthly' | 'yearly';

export function clampDiscountPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.floor(percent)));
}

/** Final major-unit price after optional % discount. */
export function finalPrice(
  list: number,
  discountEnabled: boolean,
  discountPercent: number
): number {
  const base = Math.max(0, Math.floor(Number(list) || 0));
  if (!discountEnabled) return base;
  const pct = clampDiscountPercent(discountPercent);
  if (pct <= 0) return base;
  return Math.max(0, Math.round((base * (100 - pct)) / 100));
}

export function parseBillingInterval(
  raw: string | null | undefined
): BillingInterval {
  return raw === 'yearly' ? 'yearly' : 'monthly';
}

export function resolveCatalogFinalAmount(input: {
  interval: BillingInterval;
  price: number;
  yearlyPrice: number;
  monthlyDiscountEnabled?: boolean;
  monthlyDiscountPercent?: number;
  yearlyDiscountEnabled?: boolean;
  yearlyDiscountPercent?: number;
}): number {
  if (input.interval === 'yearly') {
    return finalPrice(
      input.yearlyPrice,
      Boolean(input.yearlyDiscountEnabled),
      input.yearlyDiscountPercent ?? 0
    );
  }
  return finalPrice(
    input.price,
    Boolean(input.monthlyDiscountEnabled),
    input.monthlyDiscountPercent ?? 0
  );
}

export function resolveCatalogListAmount(input: {
  interval: BillingInterval;
  price: number;
  yearlyPrice: number;
}): number {
  return input.interval === 'yearly'
    ? Math.max(0, Math.floor(Number(input.yearlyPrice) || 0))
    : Math.max(0, Math.floor(Number(input.price) || 0));
}

export function resolveCatalogDiscountPercent(input: {
  interval: BillingInterval;
  monthlyDiscountEnabled?: boolean;
  monthlyDiscountPercent?: number;
  yearlyDiscountEnabled?: boolean;
  yearlyDiscountPercent?: number;
}): number | null {
  if (input.interval === 'yearly') {
    if (!input.yearlyDiscountEnabled) return null;
    const pct = clampDiscountPercent(input.yearlyDiscountPercent ?? 0);
    return pct > 0 ? pct : null;
  }
  if (!input.monthlyDiscountEnabled) return null;
  const pct = clampDiscountPercent(input.monthlyDiscountPercent ?? 0);
  return pct > 0 ? pct : null;
}

/** Display suffix: /mo or /yr */
export function formatPlanPriceLabel(
  amount: number,
  interval: BillingInterval,
  lang: 'en' | 'es' = 'en'
): string {
  const n = Math.max(0, Math.floor(amount));
  if (lang === 'es') {
    return interval === 'yearly' ? `${n} €/año` : `${n} €/mes`;
  }
  return interval === 'yearly' ? `€${n}/yr` : `€${n}/mo`;
}

const SEP = '&&&&';

export function bilingualPlanPriceLabel(
  amount: number,
  interval: BillingInterval
): string {
  return `${formatPlanPriceLabel(amount, interval, 'en')} ${SEP} ${formatPlanPriceLabel(amount, interval, 'es')}`;
}
