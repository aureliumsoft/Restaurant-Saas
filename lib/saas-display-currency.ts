export type SaasDisplayCurrencyCode = 'EUR' | 'PKR';

export type SaasDisplayCurrency = {
  code: SaasDisplayCurrencyCode;
  rate: number | null;
};

function formatIntegerAmount(n: number, lang: 'en' | 'es'): string {
  return n.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
    maximumFractionDigits: 0,
  });
}

/**
 * Format a catalog EUR major amount for SaaS marketing/checkout display.
 * Floors to whole units (same as previous formatEuro).
 * Client-safe — no next/headers.
 */
export function formatSaasDisplayPrice(
  eurAmount: number,
  opts: {
    code: SaasDisplayCurrencyCode;
    rate?: number | null;
    lang: 'en' | 'es';
  }
): string {
  const safe = Number.isFinite(eurAmount) ? Math.max(0, eurAmount) : 0;

  if (opts.code === 'PKR' && opts.rate != null && opts.rate > 0) {
    const pkr = Math.floor(safe * opts.rate);
    return `Rs${formatIntegerAmount(pkr, opts.lang)}`;
  }

  const n = Math.floor(safe);
  return opts.lang === 'es'
    ? `${formatIntegerAmount(n, 'es')} €`
    : `€${formatIntegerAmount(n, 'en')}`;
}
