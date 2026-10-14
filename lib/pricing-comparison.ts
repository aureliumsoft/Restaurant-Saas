/** Access labels from docs/pricing-plans.md §3 module matrix. */
export type ModuleAccess =
  | 'full'
  | 'limited'
  | 'paid'
  | 'selection'
  | 'limited_single';

export type PlanSlug =
  | 'FREE'
  | 'BASIC'
  | 'GROWTH'
  | 'SCALE'
  | 'PRO'
  | 'CUSTOM';

export type PricingModuleRow = {
  id: string;
  label: string;
  byPlan: Record<PlanSlug, ModuleAccess>;
  /** Footnote marker shown next to certain cells. */
  note?: 'scale_dashboard' | 'custom_basic_limits';
};

const PLAN_ORDER: PlanSlug[] = [
  'FREE',
  'BASIC',
  'GROWTH',
  'SCALE',
  'PRO',
  'CUSTOM',
];

function row(
  id: string,
  label: string,
  cells: [
    ModuleAccess,
    ModuleAccess,
    ModuleAccess,
    ModuleAccess,
    ModuleAccess,
    ModuleAccess,
  ],
  note?: PricingModuleRow['note']
): PricingModuleRow {
  const [FREE, BASIC, GROWTH, SCALE, PRO, CUSTOM] = cells;
  return {
    id,
    label,
    byPlan: { FREE, BASIC, GROWTH, SCALE, PRO, CUSTOM },
    note,
  };
}

/**
 * Module matrix matching docs/pricing-plans.md §3.
 * Order: Free · Basic · Growth · Scale · Pro · Custom
 */
export const PRICING_MODULE_ROWS: PricingModuleRow[] = [
  row('dashboard', 'Dashboard', ['limited', 'limited', 'limited', 'full', 'full', 'full'], 'scale_dashboard'),
  row('pos', 'POS', ['limited', 'limited', 'limited', 'full', 'full', 'full']),
  row('kds', 'KDS', ['paid', 'full', 'full', 'full', 'full', 'selection']),
  row('order_display', 'Order Display', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('categories', 'Categories', ['limited', 'limited', 'limited', 'limited', 'full', 'full']),
  row('variations', 'Variations', ['limited', 'limited', 'limited', 'limited', 'full', 'full']),
  row('products', 'Products', ['limited', 'limited', 'limited', 'full', 'full', 'full']),
  row('inventory', 'Inventory', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('menu_layout', 'Menu Layout', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('configuration', 'Configuration', ['paid', 'paid', 'full', 'full', 'full', 'selection']),
  row('transactions', 'Transactions', ['limited', 'limited', 'limited', 'full', 'full', 'limited'], 'custom_basic_limits'),
  row('expenses', 'Expenses', ['paid', 'limited', 'limited', 'full', 'full', 'selection']),
  row('reports', 'Reports', ['limited', 'limited', 'limited', 'full', 'full', 'limited'], 'custom_basic_limits'),
  row('basic_settings', 'Basic Settings', ['limited', 'limited', 'limited', 'full', 'full', 'limited'], 'custom_basic_limits'),
  row('branches', 'Branches', ['limited', 'limited', 'limited', 'limited', 'limited', 'limited'], 'custom_basic_limits'),
  row('users_roles', 'Users & Roles', ['paid', 'limited', 'limited', 'limited', 'limited', 'selection']),
  row('online_payments', 'Online Payments', ['paid', 'paid', 'limited_single', 'limited_single', 'full', 'selection']),
  row('terminal_payment', 'Terminal Payment', ['paid', 'paid', 'paid', 'paid', 'full', 'selection']),
  row('website', 'Website', ['paid', 'paid', 'full', 'full', 'full', 'selection']),
  row('kiosk_platform', 'Kiosk Platform', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('mobile_app', 'Mobile App', ['paid', 'paid', 'paid', 'paid', 'full', 'selection']),
];

/** @deprecated Use PRICING_MODULE_ROWS */
export const PRICING_COMPARISON_ROWS = PRICING_MODULE_ROWS;

export function normalizePlanSlug(plan: string): PlanSlug | null {
  const key = plan.toUpperCase() as PlanSlug;
  return PLAN_ORDER.includes(key) ? key : null;
}

export function getModuleAccess(
  plan: string,
  moduleRow: PricingModuleRow
): ModuleAccess | null {
  const slug = normalizePlanSlug(plan);
  if (!slug) return null;
  return moduleRow.byPlan[slug];
}

/** Modules the Custom configurator can toggle (Selection + unlockable Limited). */
export function isCustomSelectableModule(moduleRow: PricingModuleRow): boolean {
  const access = moduleRow.byPlan.CUSTOM;
  return access === 'selection' || access === 'limited';
}

export function getCustomBaseModuleIds(): string[] {
  return PRICING_MODULE_ROWS.filter((r) => r.byPlan.CUSTOM === 'full').map(
    (r) => r.id
  );
}

/** True when the module is usable without an upgrade gate (full or limited). */
export function planIncludesComparisonFeature(
  plan: string,
  moduleRow: PricingModuleRow
): boolean {
  const access = getModuleAccess(plan, moduleRow);
  return access === 'full' || access === 'limited' || access === 'limited_single';
}
