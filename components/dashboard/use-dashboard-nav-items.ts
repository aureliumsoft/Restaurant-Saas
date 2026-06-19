'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

import { NAVBAR_ITEMS } from '@/constant/navbarMenu';
import {
  navGroupsForPermissions,
  navItemsForPermissions,
  type DashboardNavGroup,
} from '@/lib/dashboard-nav';
import type { NavItem } from '@/types/Navbar';

export function useDashboardNavGroups(): DashboardNavGroup[] {
  const [groups, setGroups] = useState<DashboardNavGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get<{
        permissions?: string[];
        plan?: { recommendations?: boolean };
      }>('/api/me/dashboard-permissions')
      .then((res) => {
        if (cancelled) return;
        const perms = res.data.permissions ?? [];
        setGroups(
          navGroupsForPermissions(perms, {
            hideRecommendations: res.data.plan?.recommendations === false,
          })
        );
      })
      .catch(() => {
        if (cancelled) return;
        setGroups(
          navGroupsForPermissions(
            NAVBAR_ITEMS.map((item) => `${item.moduleKey}:access`)
          )
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return groups;
}

export function useDashboardNavItems(): NavItem[] {
  // Render nothing until permissions are loaded to avoid a visible "all modules"
  // flicker on initial dashboard load.
  const [items, setItems] = useState<NavItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get<{
        permissions?: string[];
        plan?: { recommendations?: boolean };
      }>('/api/me/dashboard-permissions')
      .then((res) => {
        if (cancelled) return;
        const perms = res.data.permissions ?? [];
        let items = navItemsForPermissions(perms);
        if (res.data.plan?.recommendations === false) {
          items = items.filter((i) => i.moduleKey !== 'recommendations');
        }
        setItems(items);
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback: show all modules if permissions endpoint fails.
        setItems(NAVBAR_ITEMS);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return items;
}
