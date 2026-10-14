'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useEntitlements } from '@/hooks/use-entitlements';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { entitlementModuleForNav } from '@/lib/entitlements';
import {
  navGroupsForPermissions,
  navItemsForPermissions,
  type DashboardNavGroup,
} from '@/lib/dashboard-nav';
import { dashboardModuleTitleKey } from '@/lib/dashboard-nav-i18n';
import type { NavItem } from '@/types/Navbar';

function translateNavItems(
  items: NavItem[],
  t: (key: string) => string
): NavItem[] {
  return items.map((item) =>
    item.moduleKey
      ? { ...item, title: t(dashboardModuleTitleKey(item.moduleKey)) }
      : item
  );
}

function withPremiumFlags(
  items: NavItem[],
  isPaid: (key: string) => boolean
): NavItem[] {
  return items.map((item) => {
    if (!item.moduleKey) return item;
    const entKey = entitlementModuleForNav(item.moduleKey);
    if (!entKey) return item;
    return { ...item, premium: isPaid(entKey) };
  });
}

/**
 * Nav stays visible for Paid modules and when order-channel toggles are off.
 * Paid modules get `premium: true` (crown in sidebar).
 */
export function useDashboardNavGroups(): DashboardNavGroup[] {
  const { t } = useTranslation();
  const { permissions, loading } = useStaffPermissions();
  const { isPaid, loading: entLoading } = useEntitlements();

  return useMemo(() => {
    if (loading || entLoading) return [];
    const groups = navGroupsForPermissions(permissions);
    return groups.map((group) => ({
      ...group,
      items: translateNavItems(withPremiumFlags(group.items, isPaid), t),
    }));
  }, [loading, entLoading, permissions, isPaid, t]);
}

export function useDashboardNavItems(): NavItem[] {
  const { t } = useTranslation();
  const { permissions, loading } = useStaffPermissions();
  const { isPaid, loading: entLoading } = useEntitlements();

  return useMemo(() => {
    if (loading || entLoading) return [];
    const items = navItemsForPermissions(permissions);
    return translateNavItems(withPremiumFlags(items, isPaid), t);
  }, [loading, entLoading, permissions, isPaid, t]);
}
