'use client';

import { useEffect, useState } from 'react';

import { useOptionalRestaurantRegionalContext } from '@/components/layout/restaurant-regional-provider';
import {
  DEFAULT_RESTAURANT_REGIONAL,
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import { formatCurrency } from '@/lib/format-money';

export function useRestaurantRegional(restaurantSlug: string | undefined) {
  const [regional, setRegional] = useState<RestaurantRegionalSettings>(
    DEFAULT_RESTAURANT_REGIONAL
  );
  const [loading, setLoading] = useState(Boolean(restaurantSlug?.trim()));

  useEffect(() => {
    const slug = restaurantSlug?.trim();
    if (!slug) {
      setRegional(DEFAULT_RESTAURANT_REGIONAL);
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
          data?: { regional?: RestaurantRegionalSettings } | null;
        };
        if (cancelled) return;
        setRegional(parseRestaurantRegionalSettings(body.data?.regional));
      } catch {
        if (!cancelled) setRegional(DEFAULT_RESTAURANT_REGIONAL);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  const formatMoney = (amount: number) => formatCurrency(amount, regional);

  return { regional, loading, formatMoney };
}

/** Staff dashboard / POS — uses layout provider when available. */
export function useOwnerRestaurantRegional() {
  const context = useOptionalRestaurantRegionalContext();
  const [regional, setRegional] = useState<RestaurantRegionalSettings>(
    DEFAULT_RESTAURANT_REGIONAL
  );
  const [loading, setLoading] = useState(!context);

  useEffect(() => {
    if (context) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/restaurant/regional', {
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => ({}))) as {
          data?: RestaurantRegionalSettings | null;
        };
        if (cancelled) return;
        setRegional(parseRestaurantRegionalSettings(body.data));
      } catch {
        if (!cancelled) setRegional(DEFAULT_RESTAURANT_REGIONAL);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context]);

  if (context) {
    return context;
  }

  const formatMoney = (amount: number) => formatCurrency(amount, regional);

  return { regional, loading, formatMoney, refresh: () => {} };
}
