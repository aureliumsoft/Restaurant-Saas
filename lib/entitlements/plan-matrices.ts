import { SubscriptionPlan } from '@prisma/client';

import type {
  Entitlements,
  ModuleEntitlement,
  ModuleKey,
  PlanCaps,
} from '@/lib/entitlements/types';
import { MODULE_KEYS } from '@/lib/entitlements/types';

function m(
  access: ModuleEntitlement['access'],
  limits?: ModuleEntitlement['limits']
): ModuleEntitlement {
  return limits ? { access, limits } : { access };
}

function buildModules(
  partial: Partial<Record<ModuleKey, ModuleEntitlement>>
): Record<ModuleKey, ModuleEntitlement> {
  const out = {} as Record<ModuleKey, ModuleEntitlement>;
  for (const key of MODULE_KEYS) {
    out[key] = partial[key] ?? m('paid');
  }
  return out;
}

const FREE_CAPS: PlanCaps = {
  categories: 5,
  variations: 3,
  products: 15,
  branches: 1,
  users: 0,
  roles: 0,
  menuBanners: 0,
  mainBanner: false,
  onlinePaymentMethods: 0,
};

/** users/roles are per-branch seats (see pricing-plans.md). */
const BASIC_CAPS: PlanCaps = {
  categories: 15,
  variations: 5,
  products: 35,
  branches: 1,
  users: 1,
  roles: 1,
  menuBanners: 0,
  mainBanner: false,
  onlinePaymentMethods: 0,
};

const GROWTH_CAPS: PlanCaps = {
  categories: 30,
  variations: 7,
  products: 100,
  branches: 2,
  users: 3,
  roles: 3,
  menuBanners: 3,
  mainBanner: true,
  onlinePaymentMethods: 1,
};

const SCALE_CAPS: PlanCaps = {
  categories: 60,
  variations: 10,
  products: null,
  branches: 5,
  users: 5,
  roles: 5,
  menuBanners: null,
  mainBanner: true,
  onlinePaymentMethods: 1,
};

export const PRO_CAPS: PlanCaps = {
  categories: null,
  variations: null,
  products: null,
  branches: 10,
  users: 10,
  roles: 10,
  menuBanners: null,
  mainBanner: true,
  onlinePaymentMethods: null,
};

/** Free plan module matrix from product brief. */
export const FREE_MODULES = buildModules({
  dashboard: m('limited', {
    days7: true,
    days14: false,
    days30: false,
    websiteButton: false,
    kioskButton: false,
    topSelling: false,
    peakHours: false,
    floorNow: false,
    paymentMix: false,
  }),
  pos: m('limited', { kioskButton: false, kdsButton: false, delivery: false }),
  kds: m('paid'),
  orderDisplay: m('paid'),
  categories: m('limited'),
  variations: m('limited'),
  products: m('limited', { csvImport: false, csvExport: false }),
  inventory: m('paid'),
  menuLayout: m('paid'),
  configuration: m('paid'),
  transactions: m('limited', { ordersOnly: true }),
  expenses: m('paid'),
  reports: m('limited', {
    customDateRange: false,
    websiteFilter: false,
    posFilter: true,
    kioskFilter: false,
    inventoryTab: false,
    expensesTab: false,
    financialExpenses: false,
    financialInventory: false,
    financialCard: false,
    financialOther: false,
  }),
  basicSettings: m('limited', {
    websiteUrl: false,
    kioskUrl: false,
    orderChannelsLocked: true,
    dineInChannel: false,
    deliveryChannel: false,
    kdsChannel: false,
    websiteChannel: false,
    orderDisplayChannel: false,
    cardPaymentChannel: false,
    onscreenKeyboard: false,
    serviceCharges: false,
  }),
  branches: m('limited', { tableQr: false }),
  usersRoles: m('paid'),
  onlinePayments: m('paid'),
  terminalPayment: m('paid'),
  website: m('paid'),
  kiosk: m('paid'),
  mobileApp: m('paid'),
});

export const BASIC_MODULES = buildModules({
  dashboard: m('limited', {
    days7: true,
    days14: true,
    days30: true,
    websiteButton: false,
    kioskButton: false,
    topSelling: false,
    peakHours: false,
    floorNow: false,
    paymentMix: false,
  }),
  pos: m('limited', { kioskButton: true, kdsButton: true, delivery: false }),
  kds: m('full'),
  orderDisplay: m('paid'),
  categories: m('limited'),
  variations: m('limited'),
  products: m('limited', { csvImport: true, csvExport: true }),
  inventory: m('paid'),
  menuLayout: m('paid'),
  configuration: m('paid'),
  transactions: m('limited', { ordersOnly: true }),
  expenses: m('limited', { manualOnly: true }),
  reports: m('limited', {
    customDateRange: true,
    websiteFilter: false,
    posFilter: true,
    kioskFilter: false,
    inventoryTab: false,
    expensesTab: true,
    expensesManualOnly: true,
    financialExpenses: true,
    financialInventory: false,
    financialCard: false,
    financialOther: false,
  }),
  basicSettings: m('limited', {
    websiteUrl: false,
    kioskUrl: false,
    dineInChannel: true,
    deliveryChannel: false,
    kdsChannel: true,
    websiteChannel: false,
    orderDisplayChannel: false,
    cardPaymentChannel: false,
    onscreenKeyboard: true,
    serviceCharges: true,
  }),
  branches: m('limited', { tableQr: true }),
  usersRoles: m('limited'),
  onlinePayments: m('paid'),
  terminalPayment: m('paid'),
  website: m('paid'),
  kiosk: m('paid'),
  mobileApp: m('paid'),
});

export const GROWTH_MODULES = buildModules({
  dashboard: m('limited', {
    days7: true,
    days14: true,
    days30: true,
    websiteButton: true,
    kioskButton: false,
    topSelling: true,
    peakHours: true,
    floorNow: false,
    paymentMix: false,
  }),
  pos: m('limited', { kioskButton: false, kdsButton: true, delivery: true }),
  kds: m('full'),
  orderDisplay: m('paid'),
  categories: m('limited'),
  variations: m('limited'),
  products: m('limited', { csvImport: true, csvExport: true }),
  inventory: m('paid'),
  menuLayout: m('paid'),
  configuration: m('full'),
  transactions: m('limited', { ordersOnly: true }),
  expenses: m('limited', { manualOnly: true }),
  reports: m('limited', {
    customDateRange: true,
    websiteFilter: true,
    posFilter: true,
    kioskFilter: false,
    inventoryTab: false,
    expensesTab: true,
    expensesManualOnly: true,
    financialExpenses: true,
    financialInventory: false,
    financialCard: false,
    financialOther: false,
  }),
  basicSettings: m('limited', {
    websiteUrl: true,
    kioskUrl: false,
    dineInChannel: true,
    deliveryChannel: true,
    kdsChannel: true,
    websiteChannel: true,
    orderDisplayChannel: false,
    cardPaymentChannel: false,
    onscreenKeyboard: true,
  }),
  branches: m('limited', { tableQr: true }),
  usersRoles: m('limited'),
  onlinePayments: m('limited', { singleMethod: true }),
  terminalPayment: m('paid'),
  website: m('full'),
  kiosk: m('paid'),
  mobileApp: m('paid'),
});

export const SCALE_MODULES = buildModules({
  dashboard: m('full', {
    days7: true,
    days14: true,
    days30: true,
    websiteButton: true,
    kioskButton: true,
    topSelling: true,
    peakHours: true,
    floorNow: true,
    paymentMix: true,
  }),
  pos: m('full', { kioskButton: true, kdsButton: true, delivery: true }),
  kds: m('full'),
  orderDisplay: m('full'),
  categories: m('limited'),
  variations: m('limited'),
  products: m('full'),
  inventory: m('full'),
  menuLayout: m('full'),
  configuration: m('full'),
  transactions: m('full'),
  expenses: m('full'),
  reports: m('full'),
  basicSettings: m('full', {
    websiteUrl: true,
    kioskUrl: true,
    dineInChannel: true,
    deliveryChannel: true,
    kdsChannel: true,
    websiteChannel: true,
    orderDisplayChannel: true,
    cardPaymentChannel: false,
    onscreenKeyboard: true,
  }),
  branches: m('limited', { tableQr: true }),
  usersRoles: m('limited'),
  onlinePayments: m('limited', { singleMethod: true }),
  terminalPayment: m('paid'),
  website: m('full'),
  kiosk: m('full'),
  mobileApp: m('paid'),
});

export const PRO_MODULES = buildModules({
  dashboard: m('full'),
  pos: m('full'),
  kds: m('full'),
  orderDisplay: m('full'),
  categories: m('full'),
  variations: m('full'),
  products: m('full'),
  inventory: m('full'),
  menuLayout: m('full'),
  configuration: m('full'),
  transactions: m('full'),
  expenses: m('full'),
  reports: m('full'),
  basicSettings: m('full'),
  branches: m('limited', { tableQr: true }),
  usersRoles: m('limited'),
  onlinePayments: m('full'),
  terminalPayment: m('full'),
  website: m('full'),
  kiosk: m('full'),
  mobileApp: m('full'),
});

/** Custom base before checkbox merge (unchecked Selection = paid; Limited = Basic limits). */
export const CUSTOM_BASE_MODULES = buildModules({
  dashboard: m('full'),
  pos: m('full'),
  kds: m('paid'),
  orderDisplay: m('paid'),
  categories: m('full'),
  variations: m('full'),
  products: m('full'),
  inventory: m('paid'),
  menuLayout: m('paid'),
  configuration: m('paid'),
  transactions: m('limited', { ordersOnly: true }),
  expenses: m('paid'),
  reports: m('limited', {
    customDateRange: true,
    inventoryTab: false,
    expensesManualOnly: true,
  }),
  basicSettings: m('limited', {
    websiteUrl: false,
    kioskUrl: false,
  }),
  branches: m('limited', { tableQr: true }),
  usersRoles: m('paid'),
  onlinePayments: m('paid'),
  terminalPayment: m('paid'),
  website: m('paid'),
  kiosk: m('paid'),
  mobileApp: m('paid'),
});

/** Modules that are Selection on Custom (checkbox → full). */
export const CUSTOM_SELECTION_MODULES: ModuleKey[] = [
  'kds',
  'orderDisplay',
  'inventory',
  'menuLayout',
  'configuration',
  'expenses',
  'usersRoles',
  'onlinePayments',
  'terminalPayment',
  'website',
  'kiosk',
  'mobileApp',
];

/** Limited modules on Custom that unlock to full when checked. */
export const CUSTOM_UNLOCKABLE_LIMITED: ModuleKey[] = [
  'transactions',
  'reports',
  'basicSettings',
  'branches',
];

export function capsForPlan(plan: SubscriptionPlan): PlanCaps {
  switch (plan) {
    case SubscriptionPlan.BASIC:
      return { ...BASIC_CAPS };
    case SubscriptionPlan.GROWTH:
      return { ...GROWTH_CAPS };
    case SubscriptionPlan.SCALE:
      return { ...SCALE_CAPS };
    case SubscriptionPlan.PRO:
      return { ...PRO_CAPS };
    case SubscriptionPlan.CUSTOM:
      return { ...BASIC_CAPS };
    case SubscriptionPlan.FREE:
    default:
      return { ...FREE_CAPS };
  }
}

export function modulesForPlan(
  plan: SubscriptionPlan
): Record<ModuleKey, ModuleEntitlement> {
  switch (plan) {
    case SubscriptionPlan.BASIC:
      return { ...BASIC_MODULES };
    case SubscriptionPlan.GROWTH:
      return { ...GROWTH_MODULES };
    case SubscriptionPlan.SCALE:
      return { ...SCALE_MODULES };
    case SubscriptionPlan.PRO:
      return { ...PRO_MODULES };
    case SubscriptionPlan.CUSTOM:
      return { ...CUSTOM_BASE_MODULES };
    case SubscriptionPlan.FREE:
    default:
      return { ...FREE_MODULES };
  }
}

export function emptyEntitlements(
  plan: SubscriptionPlan = SubscriptionPlan.FREE
): Entitlements {
  return {
    plan,
    modules: modulesForPlan(plan),
    caps: capsForPlan(plan),
    customSelectedModules: [],
  };
}
