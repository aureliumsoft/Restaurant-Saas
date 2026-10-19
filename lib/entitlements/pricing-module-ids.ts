import type { ModuleKey } from '@/lib/entitlements/types';
import { MODULE_KEYS } from '@/lib/entitlements/types';
import {
  isCustomSelectableModule,
  PRICING_MODULE_ROWS,
  type PricingModuleRow,
} from '@/lib/pricing-comparison';

/** Pricing comparison row id → entitlement ModuleKey. */
export const PRICING_ID_TO_MODULE_KEY: Record<string, ModuleKey> = {
  dashboard: 'dashboard',
  pos: 'pos',
  kds: 'kds',
  order_display: 'orderDisplay',
  categories: 'categories',
  variations: 'variations',
  products: 'products',
  inventory: 'inventory',
  menu_layout: 'menuLayout',
  configuration: 'configuration',
  transactions: 'transactions',
  expenses: 'expenses',
  reports: 'reports',
  basic_settings: 'basicSettings',
  branches: 'branches',
  users_roles: 'usersRoles',
  online_payments: 'onlinePayments',
  terminal_payment: 'terminalPayment',
  website: 'website',
  kiosk_platform: 'kiosk',
  mobile_app: 'mobileApp',
};

export const MODULE_KEY_TO_PRICING_ID: Record<ModuleKey, string> = {
  dashboard: 'dashboard',
  pos: 'pos',
  kds: 'kds',
  orderDisplay: 'order_display',
  categories: 'categories',
  variations: 'variations',
  products: 'products',
  inventory: 'inventory',
  menuLayout: 'menu_layout',
  configuration: 'configuration',
  transactions: 'transactions',
  expenses: 'expenses',
  reports: 'reports',
  basicSettings: 'basic_settings',
  branches: 'branches',
  usersRoles: 'users_roles',
  onlinePayments: 'online_payments',
  terminalPayment: 'terminal_payment',
  website: 'website',
  kiosk: 'kiosk_platform',
  mobileApp: 'mobile_app',
};

const MODULE_KEY_SET = new Set<string>(MODULE_KEYS);

/** Accept pricing snake_case ids or camelCase ModuleKeys. */
export function normalizeCustomSelectedToModuleKeys(
  selected: string[]
): Set<ModuleKey> {
  const out = new Set<ModuleKey>();
  for (const raw of selected) {
    const s = raw.trim();
    if (!s) continue;
    if (MODULE_KEY_SET.has(s)) {
      out.add(s as ModuleKey);
      continue;
    }
    const mapped = PRICING_ID_TO_MODULE_KEY[s];
    if (mapped) out.add(mapped);
  }
  return out;
}

/** Canonical storage form: pricing comparison ids. */
export function toPricingModuleIds(selected: string[]): string[] {
  const ids = new Set<string>();
  for (const raw of selected) {
    const s = raw.trim();
    if (!s) continue;
    if (PRICING_ID_TO_MODULE_KEY[s]) {
      ids.add(s);
      continue;
    }
    if (MODULE_KEY_SET.has(s)) {
      ids.add(MODULE_KEY_TO_PRICING_ID[s as ModuleKey]);
    }
  }
  return [...ids];
}

export function getCustomSelectablePricingRows(): PricingModuleRow[] {
  return PRICING_MODULE_ROWS.filter(isCustomSelectableModule);
}

export const CUSTOM_SELECTABLE_MODULE_IDS = getCustomSelectablePricingRows().map(
  (r) => r.id
);
