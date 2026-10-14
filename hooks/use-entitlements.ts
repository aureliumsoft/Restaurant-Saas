'use client';

import { useMemo } from 'react';

import {
  selectStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';
import type { ModuleKey, PlanCaps } from '@/lib/entitlements';
import { canCreate } from '@/lib/entitlements';

export type ClientModuleEntitlement = {
  access: 'full' | 'limited' | 'paid';
  limits?: Record<string, number | boolean | string>;
};

export type ClientEntitlementsPlan = {
  maxBranches: number | null;
  recommendations: boolean;
  roleBasedSettings: boolean;
  branding: boolean;
  advancedAnalytics: boolean;
  mobileApp: boolean;
  planId?: string;
  modules?: Record<string, ClientModuleEntitlement>;
  caps?: PlanCaps;
  customSelectedModules?: string[];
};

export function useEntitlements() {
  const { data, isLoading, error } = useStaffBootstrapSWR();
  const bootstrap = selectStaffBootstrap(data);
  const plan = (bootstrap?.plan ?? null) as ClientEntitlementsPlan | null;

  const modules = plan?.modules ?? {};
  const caps = plan?.caps;

  return useMemo(() => {
    function moduleAccess(key: ModuleKey | string): ClientModuleEntitlement {
      const m = modules[key];
      if (m) return m;
      return { access: 'paid' };
    }

    function isPaid(key: ModuleKey | string): boolean {
      return moduleAccess(key).access === 'paid';
    }

    function isLimited(key: ModuleKey | string): boolean {
      return moduleAccess(key).access === 'limited';
    }

    function isFull(key: ModuleKey | string): boolean {
      return moduleAccess(key).access === 'full';
    }

    function canUse(key: ModuleKey | string): boolean {
      const a = moduleAccess(key).access;
      return a === 'full' || a === 'limited';
    }

    function limitFlag(
      key: ModuleKey | string,
      flag: string,
      fallback = false
    ): boolean {
      const v = moduleAccess(key).limits?.[flag];
      return typeof v === 'boolean' ? v : fallback;
    }

    function canCreateMore(
      capKey: keyof PlanCaps,
      currentCount: number
    ): boolean {
      if (!caps) return true;
      const cap = caps[capKey];
      if (typeof cap === 'boolean') return cap;
      return canCreate(cap as number | null, currentCount);
    }

    return {
      loading: isLoading && !bootstrap,
      error,
      plan,
      modules,
      caps,
      isPaid,
      isLimited,
      isFull,
      canUse,
      limitFlag,
      canCreateMore,
      moduleAccess,
    };
  }, [bootstrap, caps, error, isLoading, modules, plan]);
}
