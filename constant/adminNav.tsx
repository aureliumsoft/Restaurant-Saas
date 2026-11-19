import type { ReactNode } from 'react';
import {
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Mail,
  Receipt,
  Search,
  Settings,
  Tags,
} from 'lucide-react';

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
    label: 'admin.nav.groupOverview',
    items: [
      {
        title: 'admin.nav.dashboard',
        path: '/admin/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        description: 'Platform metrics',
      },
    ],
  },
  {
    label: 'admin.nav.groupRestaurants',
    items: [
      {
        title: 'admin.nav.restaurants',
        path: '/admin/restaurants',
        icon: <Building2 className="h-4 w-4" />,
        description: 'Tenant directory',
      },
      {
        title: 'admin.nav.requests',
        path: '/admin/requests',
        icon: <Inbox className="h-4 w-4" />,
        description: 'Demo leads and custom-plan asks',
      },
    ],
  },
  {
    label: 'admin.nav.groupBilling',
    items: [
      {
        title: 'admin.nav.subscriptions',
        path: '/admin/subscriptions',
        icon: <CreditCard className="h-4 w-4" />,
        description: 'Plan, price, and paid-until for each restaurant',
      },
      {
        title: 'admin.nav.planPrices',
        path: '/admin/plan-prices',
        icon: <Tags className="h-4 w-4" />,
        description: 'Standard website prices',
      },
      {
        title: 'admin.nav.transactions',
        path: '/admin/transactions',
        icon: <Receipt className="h-4 w-4" />,
        description: 'Subscription payments',
      },
    ],
  },
  {
    label: 'admin.nav.groupWebsite',
    items: [
      {
        title: 'admin.nav.newsletter',
        path: '/admin/newsletter',
        icon: <Mail className="h-4 w-4" />,
        description: 'Subscribers & broadcasts',
      },
      {
        title: 'admin.nav.blog',
        path: '/admin/blog',
        icon: <FileText className="h-4 w-4" />,
        description: 'Marketing blog content',
      },
      {
        title: 'admin.nav.faqs',
        path: '/admin/faqs',
        icon: <HelpCircle className="h-4 w-4" />,
        description: 'Landing page questions',
      },
      {
        title: 'admin.nav.docs',
        path: '/admin/documentation',
        icon: <BookOpen className="h-4 w-4" />,
        description: 'Public docs modules',
      },
    ],
  },
  {
    label: 'admin.nav.groupSystem',
    items: [
      {
        title: 'admin.nav.seo',
        path: '/admin/seo',
        icon: <Search className="h-4 w-4" />,
        description: 'GSC, GA4 & verification',
      },
      {
        title: 'admin.nav.settings',
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
