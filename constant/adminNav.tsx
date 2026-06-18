import type { ReactNode } from 'react';
import { Building2, CreditCard, LayoutDashboard, Settings, Inbox } from 'lucide-react';

export type AdminNavItem = {
  title: string;
  path: string;
  icon: ReactNode;
  description?: string;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        path: '/admin/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        description: 'Platform metrics',
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        title: 'Restaurants',
        path: '/admin/restaurants',
        icon: <Building2 className="h-4 w-4" />,
        description: 'Tenant directory',
      },
      {
        title: 'Subscriptions',
        path: '/admin/subscriptions',
        icon: <CreditCard className="h-4 w-4" />,
        description: 'Plans & billing',
      },
      {
        title: 'Requests',
        path: '/admin/requests',
        icon: <Inbox className="h-4 w-4" />,
        description: 'Demo leads',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Platform settings',
        path: '/admin/settings',
        icon: <Settings className="h-4 w-4" />,
        description: 'Global config',
      },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap(
  (g) => g.items
);

export function adminNavTitleForPath(pathname: string): string | null {
  const item = ADMIN_NAV_ITEMS.find(
    (i) => pathname === i.path || pathname.startsWith(`${i.path}/`)
  );
  return item?.title ?? null;
}
