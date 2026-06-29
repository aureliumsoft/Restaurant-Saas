'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { formatCurrency } from '@/lib/format-money';
import {
  DEFAULT_RESTAURANT_REGIONAL,
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';

type RestaurantRegionalContextValue = {
  regional: RestaurantRegionalSettings;
  loading: boolean;
  formatMoney: (amount: number) => string;
  refresh: () => void;
};

const RestaurantRegionalContext =
  createContext<RestaurantRegionalContextValue | null>(null);

export function RestaurantRegionalProvider({ children }: { children: ReactNode }) {
  const [regional, setRegional] = useState<RestaurantRegionalSettings>(
    DEFAULT_RESTAURANT_REGIONAL
  );
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  }, [refreshToken]);

  const value = useMemo<RestaurantRegionalContextValue>(
    () => ({
      regional,
      loading,
      formatMoney: (amount: number) => formatCurrency(amount, regional),
      refresh,
    }),
    [loading, regional, refresh]
  );

  return (
    <RestaurantRegionalContext.Provider value={value}>
      {children}
    </RestaurantRegionalContext.Provider>
  );
}

export function useRestaurantRegionalContext(): RestaurantRegionalContextValue {
  const ctx = useContext(RestaurantRegionalContext);
  if (!ctx) {
    throw new Error(
      'useRestaurantRegionalContext must be used within RestaurantRegionalProvider'
    );
  }
  return ctx;
}

export function useOptionalRestaurantRegionalContext():
  | RestaurantRegionalContextValue
  | null {
  return useContext(RestaurantRegionalContext);
}
