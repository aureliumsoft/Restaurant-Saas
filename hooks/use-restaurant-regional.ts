'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

import { useOptionalRestaurantRegionalContext } from '@/components/layout/restaurant-regional-provider';
import { useOptionalCustomerRegional } from '@/components/layout/customer-regional-provider';
import {
  revalidateStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';
import {
  DEFAULT_RESTAURANT_REGIONAL,
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import { formatCurrency } from '@/lib/format-money';

async function fetchCustomerRegionalBySlug(
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

/** Online web-app / customer flows — prefers shared CustomerRegionalProvider. */
export function useRestaurantRegional(restaurantSlug: string | undefined) {
  const customerCtx = useOptionalCustomerRegional();
  const explicitSlug = restaurantSlug?.trim() || '';
  const contextSlug = customerCtx?.restaurantSlug?.trim() || '';
  const useContext =
    Boolean(customerCtx) &&
    (!explicitSlug || explicitSlug === contextSlug);
  const fetchSlug = useContext ? '' : explicitSlug || contextSlug;

  const { data, isLoading } = useSWR(
    fetchSlug ? ['customer-regional', fetchSlug] : null,
    () => fetchCustomerRegionalBySlug(fetchSlug),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const regional = useContext
    ? (customerCtx?.regional ?? DEFAULT_RESTAURANT_REGIONAL)
    : (data ?? DEFAULT_RESTAURANT_REGIONAL);

  const formatMoney = useCallback(
    (amount: number) => formatCurrency(amount, regional),
    [regional]
  );

  const loading = useContext
    ? Boolean(customerCtx?.loading)
    : Boolean(fetchSlug) && isLoading && !data;

  return { regional, loading, formatMoney };
}

/** Staff dashboard / POS — uses layout provider when available. */
export function useOwnerRestaurantRegional() {
  const context = useOptionalRestaurantRegionalContext();
  const { data, isLoading } = useStaffBootstrapSWR();

  if (context) {
    return context;
  }

  const regional = parseRestaurantRegionalSettings(data?.data?.regional);
  const formatMoney = (amount: number) => formatCurrency(amount, regional);

  return {
    regional,
    loading: isLoading && !data,
    formatMoney,
    refresh: () => void revalidateStaffBootstrap(),
  };
}
