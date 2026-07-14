type CacheEntry<T> = {
  at: number;
  value: T;
};

const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Deduplicate + short-TTL cache for recommendation pools.
 * Parallel progressive category requests share one DB load per restaurant.
 */
export async function withRecommendationPoolCache<T>(
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.value;
  }

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const pending = loader()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, pending);
  return pending;
}
