/** Dashboard sidebar modules used for RBAC (keys must stay stable). */
export const DASHBOARD_MODULES = [
  { moduleKey: 'dashboard', title: 'Dashboard', path: '/dashboard' },
  { moduleKey: 'sales', title: 'Sales', path: '/sales' },
  { moduleKey: 'pos', title: 'POS', path: '/pos' },
  { moduleKey: 'kds', title: 'KDS', path: '/kds' },
  {
    moduleKey: 'order-display',
    title: 'Order Display',
    path: '/order-display',
  },
  { moduleKey: 'branched', title: 'Branched', path: '/branched' },
  { moduleKey: 'tables', title: 'Tables', path: '/tables' },
  { moduleKey: 'categories', title: 'Categories', path: '/categories' },
  { moduleKey: 'variations', title: 'Variations', path: '/variations' },
  { moduleKey: 'product', title: 'Inventory', path: '/product' },
  { moduleKey: 'recommendations', title: 'Product Configurations', path: '/configurations' },
  { moduleKey: 'records', title: 'Records', path: '/records' },
  { moduleKey: 'settings', title: 'Settings', path: '/settings' },
] as const;

export type DashboardModuleKey = (typeof DASHBOARD_MODULES)[number]['moduleKey'];

export const DASHBOARD_MODULE_KEY_SET = new Set<string>(
  DASHBOARD_MODULES.map((m) => m.moduleKey)
);

export const PERMISSION_ACTIONS = ['access', 'edit', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
