'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';

import { formatCurrency } from '@/lib/format-money';
import {
  DEFAULT_RESTAURANT_REGIONAL,
  getRestaurantCurrencySymbol,
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';

type CustomerRegionalContextValue = {
  restaurantSlug: string | null;
  regional: RestaurantRegionalSettings;
  currencySymbol: string;
  loading: boolean;
  formatMoney: (amount: number) => string;
};

const CustomerRegionalContext =
  createContext<CustomerRegionalContextValue | null>(null);

async function fetchCustomerRegional(
  slug: string
): Promise<RestaurantRegionalSettings> {
  const res = await fetch(
    `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  );
  const body = (await res.json().catch(() => ({}))) as {
    data?: { regional?: RestaurantRegionalSettings } | null;
  };
  return parseRestaurantRegionalSettings(body.data?.regional);
}

function resolveSlugFromLocation(
  pathname: string | null,
  searchParams: URLSearchParams | null
): string | null {
  const fromQuery =
    searchParams?.get('restaurantSlug')?.trim() ||
    searchParams?.get('slug')?.trim();
  if (fromQuery) return fromQuery;

  const match = pathname?.match(/^\/web-app\/([^/]+)/);
  const segment = match?.[1];
  if (
    segment &&
    segment !== 'order' &&
    segment !== 'track-order'
  ) {
    return decodeURIComponent(segment);
  }
  return null;
}

export function CustomerRegionalProvider({
  restaurantSlug,
  children,
}: {
  restaurantSlug?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug =
    restaurantSlug?.trim() ||
    resolveSlugFromLocation(pathname, searchParams) ||
    null;

  const { data, isLoading } = useSWR(
    slug ? ['customer-regional', slug] : null,
    () => fetchCustomerRegional(slug!),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const regional = data ?? DEFAULT_RESTAURANT_REGIONAL;
  const value = useMemo<CustomerRegionalContextValue>(
    () => ({
      restaurantSlug: slug,
      regional,
      currencySymbol: getRestaurantCurrencySymbol(regional.currencyCode),
      loading: Boolean(slug) && isLoading && !data,
      formatMoney: (amount: number) => formatCurrency(amount, regional),
    }),
    [slug, regional, isLoading, data]
  );

  return (
    <CustomerRegionalContext.Provider value={value}>
      {children}
    </CustomerRegionalContext.Provider>
  );
}

export function useOptionalCustomerRegional() {
  return useContext(CustomerRegionalContext);
}
