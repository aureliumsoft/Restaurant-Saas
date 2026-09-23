import type { DashboardModuleKey } from '@/constant/dashboardModules';
import type { DashboardNavGroupKey } from '@/lib/dashboard-nav-i18n';

export type DashboardNavGroupDef = {
  groupKey: DashboardNavGroupKey;
  moduleKeys: DashboardModuleKey[];
};

/** Sidebar sections for the restaurant dashboard (order preserved). */
export const DASHBOARD_NAV_GROUPS: DashboardNavGroupDef[] = [
  {
    groupKey: 'overview',
    moduleKeys: ['dashboard'],
  },
  {
    groupKey: 'operations',
    moduleKeys: ['sales', 'pos', 'kds', 'order-display'],
  },
  {
    groupKey: 'locations',
    moduleKeys: ['branched', 'tables'],
  },
  {
    groupKey: 'catalog',
    moduleKeys: [
      'categories',
      'variations',
      'product',
      'inventory',
      'final-view',
      'recommendations',
    ],
  },
  {
    groupKey: 'finance',
    moduleKeys: ['records', 'expenses', 'reports'],
  },
  {
    groupKey: 'settingsGroup',
    moduleKeys: ['settings'],
  },
];
