import { NAVBAR_ITEMS } from '@/constant/navbarMenu';
import type { NavItem } from '@/types/Navbar';
import { canAccessDashboardModule } from '@/lib/restaurant-roles';

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
