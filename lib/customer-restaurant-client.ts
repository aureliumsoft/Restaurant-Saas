export type CustomerRestaurantData = {
  name?: string | null;
  slug?: string | null;
  logoUrl?: string | null;
  themePrimaryColor?: string | null;
  menuBannerUrls?: string[] | null;
  mainBannerUrl?: string | null;
  serviceCharges?: unknown;
  regional?: unknown;
  fulfillmentSettings?: {
    deliveryEnabled?: boolean;
    websiteEnabled?: boolean;
    dineInEnabled?: boolean;
    cardPaymentsEnabled?: boolean;
  } | null;
};

const MEMORY_MS = 60_000;
const memory = new Map<
  string,
  { at: number; data: CustomerRestaurantData | null }
>();
const inflight = new Map<string, Promise<CustomerRestaurantData | null>>();

function cacheKey(query: { slug?: string | null; subdomain?: string | null }) {
  const slug = query.slug?.trim();
  if (slug) return `slug:${slug}`;
  const subdomain = query.subdomain?.trim();
  if (subdomain) return `sub:${subdomain}`;
  return '';
}

/**
 * One in-flight request per restaurant. Theme, fees, and regional settings
 * all read this payload, so they share it instead of calling the API three times.
 */
export function fetchCustomerRestaurant(query: {
  slug?: string | null;
  subdomain?: string | null;
}): Promise<CustomerRestaurantData | null> {
  const key = cacheKey(query);
  if (!key) return Promise.resolve(null);

  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < MEMORY_MS) {
    return Promise.resolve(hit.data);
  }
  const pending = inflight.get(key);
  if (pending) return pending;

  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  const url = slug
    ? `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`
    : `/api/customer/restaurant?subdomain=${encodeURIComponent(subdomain || '')}`;

  const request = fetch(url, { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json().catch(() => ({}))) as {
        data?: CustomerRestaurantData | null;
      };
      const data = body.data ?? null;
      memory.set(key, { at: Date.now(), data });
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}
