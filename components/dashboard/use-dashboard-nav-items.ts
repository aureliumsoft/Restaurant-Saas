'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
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

function fulfillmentNavOptions(
  plan: { recommendations?: boolean } | null | undefined,
  fulfillmentSettings: {
    dineInEnabled: boolean;
    kdsEnabled: boolean;
    orderDisplayEnabled: boolean;
  }
) {
  return {
    hideRecommendations: plan?.recommendations === false,
    hideTables: !fulfillmentSettings.dineInEnabled,
    hideKds: !fulfillmentSettings.kdsEnabled,
    hideOrderDisplay: !fulfillmentSettings.orderDisplayEnabled,
  };
}

export function useDashboardNavGroups(): DashboardNavGroup[] {
  const { t } = useTranslation();
  const { permissions, plan, loading } = useStaffPermissions();
  const { settings: fulfillmentSettings } = useRestaurantFulfillmentSettings();

  return useMemo(() => {
    if (loading) return [];
    const groups = navGroupsForPermissions(
      permissions,
      fulfillmentNavOptions(plan, fulfillmentSettings)
    );
    return groups.map((group) => ({
      ...group,
      items: translateNavItems(group.items, t),
    }));
  }, [
    loading,
    permissions,
    plan?.recommendations,
    fulfillmentSettings.dineInEnabled,
    fulfillmentSettings.kdsEnabled,
    fulfillmentSettings.orderDisplayEnabled,
    t,
  ]);
}

export function useDashboardNavItems(): NavItem[] {
  const { t } = useTranslation();
  const { permissions, plan, loading } = useStaffPermissions();
  const { settings: fulfillmentSettings } = useRestaurantFulfillmentSettings();

  return useMemo(() => {
    if (loading) return [];
    let items = navItemsForPermissions(permissions);
    const opts = fulfillmentNavOptions(plan, fulfillmentSettings);
    if (opts.hideRecommendations) {
      items = items.filter((i) => i.moduleKey !== 'recommendations');
    }
    if (opts.hideTables) {
      items = items.filter((i) => i.moduleKey !== 'tables');
    }
    if (opts.hideKds) {
      items = items.filter((i) => i.moduleKey !== 'kds');
    }
    if (opts.hideOrderDisplay) {
      items = items.filter((i) => i.moduleKey !== 'order-display');
    }
    return translateNavItems(items, t);
  }, [
    loading,
    permissions,
    plan?.recommendations,
    fulfillmentSettings.dineInEnabled,
    fulfillmentSettings.kdsEnabled,
    fulfillmentSettings.orderDisplayEnabled,
    t,
  ]);
}
