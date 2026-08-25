import type { DashboardModuleKey } from '@/constant/dashboardModules';

export type DashboardNavGroupDef = {
  label: string;
  moduleKeys: DashboardModuleKey[];
};

/** Sidebar sections for the restaurant dashboard (order preserved). */
export const DASHBOARD_NAV_GROUPS: DashboardNavGroupDef[] = [
  {
    label: 'Overview',
    moduleKeys: ['dashboard'],
  },
  {
    label: 'Operations',
    moduleKeys: ['sales', 'pos', 'kds', 'order-display'],
  },
  {
    label: 'Locations',
    moduleKeys: ['branched', 'tables'],
  },
  {
    label: 'Catalog',
    moduleKeys: ['categories', 'variations', 'product', 'inventory', 'recommendations'],
  },
  {
    label: 'Finance',
    moduleKeys: ['records'],
  },
  {
    label: 'Settings',
    moduleKeys: ['settings'],
  },
];
