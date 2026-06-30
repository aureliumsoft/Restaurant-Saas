'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

import { formatCurrency } from '@/lib/format-money';
import eventBus from '@/lib/even';
import {
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import {
  revalidateStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';

type RestaurantRegionalContextValue = {
  regional: RestaurantRegionalSettings;
  loading: boolean;
  formatMoney: (amount: number) => string;
  refresh: () => void;
};

const RestaurantRegionalContext =
  createContext<RestaurantRegionalContextValue | null>(null);

/** Regional settings from shared staff bootstrap (deduped with branch provider). */
export function RestaurantRegionalProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useStaffBootstrapSWR();
  const regional = parseRestaurantRegionalSettings(data?.data?.regional);

  const refresh = useCallback(() => {
    void revalidateStaffBootstrap();
  }, []);

  useEffect(() => {
    const onRegional = () => refresh();
    eventBus.on('realtime:config.regional', onRegional);
    return () => {
      eventBus.removeListener('realtime:config.regional', onRegional);
    };
  }, [refresh]);

  const value = useMemo<RestaurantRegionalContextValue>(
    () => ({
      regional,
      loading: isLoading && !data,
      formatMoney: (amount: number) => formatCurrency(amount, regional),
      refresh,
    }),
    [data, isLoading, regional, refresh]
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
