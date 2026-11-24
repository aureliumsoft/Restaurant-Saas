'use client';

import { useEffect, useState } from 'react';

import { fetchCustomerRestaurant } from '@/lib/customer-restaurant-client';
import {
  computeCheckoutTotal,
  parseRestaurantServiceCharges,
  resolveServiceChargeAmount,
  type RestaurantServiceCharges,
  type ServiceChargeChannel,
} from '@/lib/restaurant-service-charge';

const EMPTY_CHARGES = parseRestaurantServiceCharges(undefined);

export function useRestaurantServiceCharges(
  restaurantSlug: string | undefined,
  channel: ServiceChargeChannel
) {
  const [charges, setCharges] = useState<RestaurantServiceCharges>(EMPTY_CHARGES);
  const [loading, setLoading] = useState(Boolean(restaurantSlug?.trim()));
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const slug = restaurantSlug?.trim();
    if (!slug) {
      setCharges(EMPTY_CHARGES);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const data = await fetchCustomerRestaurant({ slug });
        if (cancelled) return;
        if (!data) {
          setError(true);
          return;
        }
        setCharges(
          (data.serviceCharges as RestaurantServiceCharges | undefined) ??
            EMPTY_CHARGES
        );
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, reloadKey]);

  const serviceChargeAmount = resolveServiceChargeAmount(charges, channel);

  return {
    charges,
    serviceChargeAmount,
    loading,
    error,
    reload: () => setReloadKey((value) => value + 1),
    computeTotal: (subtotal: number) =>
      computeCheckoutTotal(subtotal, charges, channel),
  };
}
