'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    const slug = restaurantSlug?.trim();
    if (!slug) {
      setCharges(EMPTY_CHARGES);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`,
          { cache: 'no-store' }
        );
        const body = (await res.json().catch(() => ({}))) as {
          data?: { serviceCharges?: RestaurantServiceCharges } | null;
        };
        if (cancelled) return;
        setCharges(body.data?.serviceCharges ?? EMPTY_CHARGES);
      } catch {
        if (!cancelled) setCharges(EMPTY_CHARGES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  const serviceChargeAmount = resolveServiceChargeAmount(charges, channel);

  return {
    charges,
    serviceChargeAmount,
    loading,
    computeTotal: (subtotal: number) =>
      computeCheckoutTotal(subtotal, charges, channel),
  };
}
