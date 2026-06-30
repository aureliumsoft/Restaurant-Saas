'use client';

import { useMemo } from 'react';

import { NAVBAR_ITEMS } from '@/constant/navbarMenu';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import {
  navGroupsForPermissions,
  navItemsForPermissions,
  type DashboardNavGroup,
} from '@/lib/dashboard-nav';
import type { NavItem } from '@/types/Navbar';

export function useDashboardNavGroups(): DashboardNavGroup[] {
  const { permissions, plan, loading } = useStaffPermissions();

  return useMemo(() => {
    if (loading) return [];
    return navGroupsForPermissions(permissions, {
      hideRecommendations: plan?.recommendations === false,
    });
  }, [loading, permissions, plan?.recommendations]);
}

export function useDashboardNavItems(): NavItem[] {
  const { permissions, plan, loading } = useStaffPermissions();

  return useMemo(() => {
    if (loading) return [];
    let items = navItemsForPermissions(permissions);
    if (plan?.recommendations === false) {
      items = items.filter((i) => i.moduleKey !== 'recommendations');
    }
    return items;
  }, [loading, permissions, plan?.recommendations]);
}
