const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Free open exchange rates (includes PKR; Frankfurter/ECB does not). */
const RATE_URL = 'https://open.er-api.com/v6/latest/EUR';

type RateCache = {
  rate: number;
  fetchedAt: number;
};

let cache: RateCache | null = null;
let inFlight: Promise<number | null> | null = null;

/**
 * EUR → PKR mid-market rate. Process-local cache ~6h.
 */
export async function getEurToPkrRate(): Promise<number | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rate;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(RATE_URL, {
        next: { revalidate: Math.floor(CACHE_TTL_MS / 1000) },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return cache?.rate ?? null;
      const data = (await res.json()) as {
        result?: string;
        rates?: { PKR?: number };
      };
      const rate = data.rates?.PKR;
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        return cache?.rate ?? null;
      }
      cache = { rate, fetchedAt: Date.now() };
      return rate;
    } catch {
      return cache?.rate ?? null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
