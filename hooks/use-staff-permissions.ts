'use client';

import { useMemo } from 'react';

import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import {
  selectStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';

/** Shared staff access gate: session bootstrap must succeed before dashboard UI. */
export function useStaffAccessGate() {
  const { data, error, isLoading, isValidating } = useStaffBootstrapSWR();
  const bootstrap = selectStaffBootstrap(data);

  const ready = Boolean(bootstrap) && !isLoading;
  const failed = Boolean(error) && !bootstrap && !isLoading;

  return {
    ready,
    failed,
    loading: !ready && !failed,
    isValidating,
    error,
    bootstrap,
  };
}

export function useStaffPermissions() {
  const { data, error, isLoading } = useStaffBootstrapSWR();
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
    /** True until a successful bootstrap payload is available. */
    loading: (isLoading && !data) || Boolean(error && !bootstrap),
    permissions: bootstrap?.permissions ?? [],
    plan: bootstrap?.plan ?? null,
    allowedModuleKeys,
    allModuleKeys: new Set(DASHBOARD_MODULES.map((m) => m.moduleKey)),
    ready: Boolean(bootstrap),
    failed: Boolean(error) && !bootstrap,
  };
}

export function useStaffSubscription() {
  const { data, error, isLoading } = useStaffBootstrapSWR();
  const bootstrap = selectStaffBootstrap(data);

  return {
    loading: (isLoading && !data) || Boolean(error && !bootstrap),
    subscription: bootstrap?.subscription ?? {
      // Deny by default until bootstrap proves access — never open the shell early.
      allowed: false,
      warning: null,
      plan: null,
      status: null,
    },
    ready: Boolean(bootstrap),
    failed: Boolean(error) && !bootstrap,
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
