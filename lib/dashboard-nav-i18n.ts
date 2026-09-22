export type DashboardNavGroupKey =
  | 'overview'
  | 'operations'
  | 'locations'
  | 'catalog'
  | 'finance'
  | 'settingsGroup';

/** Stable module keys map to i18n leaf under dashboard.nav.modules.* */
export function dashboardModuleTitleKey(moduleKey: string): string {
  const leaf =
    moduleKey === 'order-display'
      ? 'orderDisplay'
      : moduleKey === 'final-view'
        ? 'finalView'
        : moduleKey;
  return `dashboard.nav.modules.${leaf}`;
}

export function dashboardNavGroupLabelKey(
  groupKey: DashboardNavGroupKey
): string {
  return `dashboard.nav.${groupKey}`;
}

/** URL segments → module i18n key suffix (includes analytics routes not in sidebar RBAC). */
const PATH_SEGMENT_MODULE: Record<string, string> = {
  dashboard: 'dashboard',
  sales: 'sales',
  pos: 'pos',
  kds: 'kds',
  'order-display': 'order-display',
  branched: 'branched',
  tables: 'tables',
  categories: 'categories',
  'final-view': 'final-view',
  variations: 'variations',
  product: 'product',
  inventory: 'inventory',
  configurations: 'recommendations',
  recommendations: 'recommendations',
  records: 'records',
  expenses: 'expenses',
  reports: 'reports',
  settings: 'settings',
  analytics: 'analytics',
};

/** Breadcrumb / mobile title for a URL path segment (e.g. "expenses"). */
export function dashboardPathSegmentTitleKey(segment: string): string | null {
  const moduleKey = PATH_SEGMENT_MODULE[segment.toLowerCase()];
  if (!moduleKey) return null;
  return dashboardModuleTitleKey(moduleKey);
}
