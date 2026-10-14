import type { SubscriptionPlan } from '@prisma/client';

/** Runtime module keys (docs/pricing-plans.md §12). */
export type ModuleKey =
  | 'dashboard'
  | 'pos'
  | 'kds'
  | 'orderDisplay'
  | 'categories'
  | 'variations'
  | 'products'
  | 'inventory'
  | 'menuLayout'
  | 'configuration'
  | 'transactions'
  | 'expenses'
  | 'reports'
  | 'basicSettings'
  | 'branches'
  | 'usersRoles'
  | 'onlinePayments'
  | 'terminalPayment'
  | 'website'
  | 'kiosk'
  | 'mobileApp';

export const MODULE_KEYS: ModuleKey[] = [
  'dashboard',
  'pos',
  'kds',
  'orderDisplay',
  'categories',
  'variations',
  'products',
  'inventory',
  'menuLayout',
  'configuration',
  'transactions',
  'expenses',
  'reports',
  'basicSettings',
  'branches',
  'usersRoles',
  'onlinePayments',
  'terminalPayment',
  'website',
  'kiosk',
  'mobileApp',
];

export type ModuleAccess = 'full' | 'limited' | 'paid';

export type ModuleEntitlement = {
  access: ModuleAccess;
  /** Optional fine-grained flags (e.g. dashboardDays, ordersOnly). */
  limits?: Record<string, number | boolean | string>;
};

/** null = unlimited */
export type PlanCaps = {
  categories: number | null;
  variations: number | null;
  products: number | null;
  branches: number | null;
  users: number | null;
  roles: number | null;
  /** 0 = logo only; positive = max menu banners; null = unlimited */
  menuBanners: number | null;
  /** Allow main banner upload */
  mainBanner: boolean;
  onlinePaymentMethods: number | null;
};

export type Entitlements = {
  plan: SubscriptionPlan;
  modules: Record<ModuleKey, ModuleEntitlement>;
  caps: PlanCaps;
  customSelectedModules: string[];
};

/** Dashboard sidebar moduleKey → entitlement ModuleKey */
export const DASHBOARD_TO_MODULE: Record<string, ModuleKey> = {
  dashboard: 'dashboard',
  pos: 'pos',
  kds: 'kds',
  'order-display': 'orderDisplay',
  categories: 'categories',
  variations: 'variations',
  product: 'products',
  inventory: 'inventory',
  'final-view': 'menuLayout',
  recommendations: 'configuration',
  records: 'transactions',
  expenses: 'expenses',
  reports: 'reports',
  settings: 'basicSettings',
  branched: 'branches',
  tables: 'branches',
};

export type CapKey = keyof PlanCaps;
