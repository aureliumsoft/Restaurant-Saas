'use client';

import { useMemo } from 'react';

import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import {
  selectStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';

export function useStaffPermissions() {
  const { data, isLoading } = useStaffBootstrapSWR();
  const bootstrap = selectStaffBootstrap(data);

  const allowedModuleKeys = useMemo(() => {
    const list = bootstrap?.permissions ?? [];
    const allowed = new Set<string>();
    for (const token of list) {
      const [moduleKey, action] = token.split(':');
      if (action === 'access' && moduleKey) {
        allowed.add(moduleKey);
      }
    }
    if (bootstrap?.plan?.recommendations === false) {
      allowed.delete('recommendations');
    }
    return allowed;
  }, [bootstrap?.permissions, bootstrap?.plan?.recommendations]);

  return {
    loading: isLoading && !data,
    permissions: bootstrap?.permissions ?? [],
    plan: bootstrap?.plan ?? null,
    allowedModuleKeys,
    allModuleKeys: new Set(DASHBOARD_MODULES.map((m) => m.moduleKey)),
  };
}

export function useStaffSubscription() {
  const { data, isLoading } = useStaffBootstrapSWR();
  const bootstrap = selectStaffBootstrap(data);
  return {
    loading: isLoading && !data,
    subscription: bootstrap?.subscription ?? {
      allowed: true,
      warning: null,
      plan: null,
      status: null,
    },
  };
}

export function useStaffRestaurantBranding() {
  const { data, isLoading } = useStaffBootstrapSWR();
  const restaurant = selectStaffBootstrap(data)?.restaurant;
  return {
    loading: isLoading && !data,
    restaurantName: restaurant?.name?.trim() || 'Restaurant',
    restaurantSlug:
      restaurant?.slug?.trim() && restaurant.slug.length > 0
        ? restaurant.slug.trim()
        : null,
    logoUrl:
      restaurant?.logoUrl?.trim() && restaurant.logoUrl.length > 0
        ? restaurant.logoUrl.trim()
        : null,
    themePrimaryColor: restaurant?.themePrimaryColor?.trim() || null,
  };
}
