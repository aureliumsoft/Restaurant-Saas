'use client';

import { useMemo } from 'react';

import {
  DEFAULT_RESTAURANT_FULFILLMENT_SETTINGS,
  type RestaurantFulfillmentSettings,
} from '@/lib/restaurant-fulfillment-settings';
import {
  selectStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';

export function useRestaurantFulfillmentSettings(): {
  settings: RestaurantFulfillmentSettings;
  loading: boolean;
} {
  const { data, isLoading } = useStaffBootstrapSWR();
  const bootstrap = selectStaffBootstrap(data);

  const settings = useMemo(
    () =>
      bootstrap?.restaurant?.fulfillmentSettings ??
      DEFAULT_RESTAURANT_FULFILLMENT_SETTINGS,
    [bootstrap?.restaurant?.fulfillmentSettings]
  );

  return { settings, loading: isLoading };
}
