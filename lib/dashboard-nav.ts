import { NAVBAR_ITEMS } from '@/constant/navbarMenu';
import { DASHBOARD_NAV_GROUPS } from '@/constant/dashboardNav';
import type { NavItem } from '@/types/Navbar';
import { canAccessDashboardModule } from '@/lib/restaurant-roles';

export type DashboardNavGroup = {
  label: string;
  items: NavItem[];
};

export function isDashboardNavItemActive(
  pathname: string,
  itemPath: string
): boolean {
  if (pathname === itemPath) return true;
  if (itemPath === '/') return false;
  return pathname.startsWith(`${itemPath}/`);
}

export function navItemsForPermissions(permissionNames: string[]): NavItem[] {
  return NAVBAR_ITEMS.filter((item) => {
    if (!item.moduleKey) return true;
    return canAccessDashboardModule(permissionNames, item.moduleKey);
  });
}

export function navGroupsForPermissions(
  permissionNames: string[],
  options?: { hideRecommendations?: boolean; hideTables?: boolean }
): DashboardNavGroup[] {
  const allowed = new Set(
    navItemsForPermissions(permissionNames).map((item) => item.moduleKey)
  );

  if (options?.hideRecommendations) {
    allowed.delete('recommendations');
  }
  if (options?.hideTables) {
    allowed.delete('tables');
  }

  const itemsByKey = new Map(
    NAVBAR_ITEMS.filter((item) => item.moduleKey).map((item) => [
      item.moduleKey!,
      item,
    ])
  );

  return DASHBOARD_NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.moduleKeys
      .filter((key) => allowed.has(key))
      .map((key) => itemsByKey.get(key))
      .filter((item): item is NavItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);
}
