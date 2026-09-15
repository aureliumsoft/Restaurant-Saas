'use client';

import { useMemo } from 'react';

import { NAVBAR_ITEMS } from '@/constant/navbarMenu';
import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import {
  navGroupsForPermissions,
  navItemsForPermissions,
  type DashboardNavGroup,
} from '@/lib/dashboard-nav';
import type { NavItem } from '@/types/Navbar';

export function useDashboardNavGroups(): DashboardNavGroup[] {
  const { permissions, plan, loading } = useStaffPermissions();
  const { settings: fulfillmentSettings } = useRestaurantFulfillmentSettings();

  return useMemo(() => {
    if (loading) return [];
    return navGroupsForPermissions(permissions, {
      hideRecommendations: plan?.recommendations === false,
      hideTables: !fulfillmentSettings.dineInEnabled,
      hideKds: !fulfillmentSettings.kdsEnabled,
      hideOrderDisplay: !fulfillmentSettings.orderDisplayEnabled,
    });
  }, [
    loading,
    permissions,
    plan?.recommendations,
    fulfillmentSettings.dineInEnabled,
    fulfillmentSettings.kdsEnabled,
    fulfillmentSettings.orderDisplayEnabled,
  ]);
}

export function useDashboardNavItems(): NavItem[] {
  const { permissions, plan, loading } = useStaffPermissions();
  const { settings: fulfillmentSettings } = useRestaurantFulfillmentSettings();

  return useMemo(() => {
    if (loading) return [];
    let items = navItemsForPermissions(permissions);
    if (plan?.recommendations === false) {
      items = items.filter((i) => i.moduleKey !== 'recommendations');
    }
    if (!fulfillmentSettings.dineInEnabled) {
      items = items.filter((i) => i.moduleKey !== 'tables');
    }
    if (!fulfillmentSettings.kdsEnabled) {
      items = items.filter((i) => i.moduleKey !== 'kds');
    }
    if (!fulfillmentSettings.orderDisplayEnabled) {
      items = items.filter((i) => i.moduleKey !== 'order-display');
    }
    return items;
  }, [
    loading,
    permissions,
    plan?.recommendations,
    fulfillmentSettings.dineInEnabled,
    fulfillmentSettings.kdsEnabled,
    fulfillmentSettings.orderDisplayEnabled,
  ]);
}
