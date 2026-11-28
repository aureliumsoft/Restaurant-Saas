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
  row('dashboard', 'Live Business Overview', ['limited', 'limited', 'limited', 'full', 'full', 'full'], 'scale_dashboard'),
  row('pos', 'Checkout & Orders', ['limited', 'limited', 'limited', 'full', 'full', 'full']),
  row('kds', 'Kitchen Display Screen', ['paid', 'full', 'full', 'full', 'full', 'selection']),
  row('order_display', 'Customer Order Screen', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('categories', 'Menu Categories', ['limited', 'limited', 'limited', 'limited', 'full', 'full']),
  row('variations', 'Item Options - Sizes & Add-ons', ['limited', 'limited', 'limited', 'limited', 'full', 'full']),
  row('products', 'Menu Items', ['limited', 'limited', 'limited', 'full', 'full', 'full']),
  row('inventory', 'Stock & Inventory', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('menu_layout', 'Menu Design & Layout', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('configuration', 'Setup & Configuration', ['paid', 'paid', 'full', 'full', 'full', 'selection']),
  row('transactions', 'Sales History', ['limited', 'limited', 'limited', 'full', 'full', 'limited'], 'custom_basic_limits'),
  row('expenses', 'Expense Tracking', ['paid', 'limited', 'limited', 'full', 'full', 'selection']),
  row('reports', 'Sales Reports', ['limited', 'limited', 'limited', 'full', 'full', 'limited'], 'custom_basic_limits'),
  row('basic_settings', 'Restaurant Settings', ['limited', 'limited', 'limited', 'full', 'full', 'limited'], 'custom_basic_limits'),
  row('branches', 'Multiple Locations', ['limited', 'limited', 'limited', 'limited', 'limited', 'limited'], 'custom_basic_limits'),
  row('users_roles', 'Team & Permissions', ['paid', 'limited', 'limited', 'limited', 'limited', 'selection']),
  row('online_payments', 'Accept Online Payments', ['paid', 'paid', 'limited_single', 'limited_single', 'full', 'selection']),
  row('terminal_payment', 'Card Terminal Payments', ['paid', 'paid', 'paid', 'paid', 'full', 'selection']),
  row('website', 'Your Restaurant Website', ['paid', 'paid', 'full', 'full', 'full', 'selection']),
  row('kiosk_platform', 'Self-Order Kiosk', ['paid', 'paid', 'paid', 'full', 'full', 'selection']),
  row('mobile_app', 'Customer Mobile App', ['paid', 'paid', 'paid', 'paid', 'full', 'selection']),
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
