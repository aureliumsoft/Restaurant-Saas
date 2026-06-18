export type ServiceChargeChannel = 'pos' | 'kiosk' | 'online';

export type ServiceChargeChannelConfig = {
  enabled: boolean;
  amount: number;
};

export type RestaurantServiceCharges = {
  pos: ServiceChargeChannelConfig;
  kiosk: ServiceChargeChannelConfig;
  online: ServiceChargeChannelConfig;
};

export const RESTAURANT_SERVICE_CHARGE_DB_SELECT = {
  posServiceChargeEnabled: true,
  posServiceChargeAmount: true,
  kioskServiceChargeEnabled: true,
  kioskServiceChargeAmount: true,
  onlineServiceChargeEnabled: true,
  onlineServiceChargeAmount: true,
} as const;

export type RestaurantServiceChargeRow = {
  posServiceChargeEnabled: boolean;
  posServiceChargeAmount: number;
  kioskServiceChargeEnabled: boolean;
  kioskServiceChargeAmount: number;
  onlineServiceChargeEnabled: boolean;
  onlineServiceChargeAmount: number;
};

const MAX_SERVICE_CHARGE_AMOUNT = 999.99;

export function normalizeServiceChargeAmount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, MAX_SERVICE_CHARGE_AMOUNT) * 100) / 100;
}

export function parseRestaurantServiceCharges(
  row: RestaurantServiceChargeRow | null | undefined
): RestaurantServiceCharges {
  return {
    pos: {
      enabled: row?.posServiceChargeEnabled === true,
      amount: normalizeServiceChargeAmount(row?.posServiceChargeAmount),
    },
    kiosk: {
      enabled: row?.kioskServiceChargeEnabled === true,
      amount: normalizeServiceChargeAmount(row?.kioskServiceChargeAmount),
    },
    online: {
      enabled: row?.onlineServiceChargeEnabled === true,
      amount: normalizeServiceChargeAmount(row?.onlineServiceChargeAmount),
    },
  };
}

export function resolveServiceChargeAmount(
  charges: RestaurantServiceCharges,
  channel: ServiceChargeChannel
): number {
  const config = charges[channel];
  if (!config.enabled) return 0;
  return config.amount;
}

export function computeCheckoutTotal(
  subtotal: number,
  charges: RestaurantServiceCharges,
  channel: ServiceChargeChannel
): { serviceChargeAmount: number; total: number } {
  const safeSubtotal = Math.max(0, subtotal);
  const serviceChargeAmount = resolveServiceChargeAmount(charges, channel);
  return {
    serviceChargeAmount,
    total: safeSubtotal + serviceChargeAmount,
  };
}

export function totalsMatch(
  expected: number,
  actual: number,
  tolerance = 0.02
): boolean {
  return Math.abs(expected - actual) <= tolerance;
}

export function withServiceChargesPayload<T extends RestaurantServiceChargeRow>(
  row: T
): T & { serviceCharges: RestaurantServiceCharges } {
  return {
    ...row,
    serviceCharges: parseRestaurantServiceCharges(row),
  };
}

export const RESTAURANT_BRANDING_DB_SELECT = {
  id: true,
  name: true,
  logoUrl: true,
  mainBannerUrl: true,
  menuBannerUrls: true,
  themePrimaryColor: true,
  subdomain: true,
  slug: true,
} as const;

export function withDefaultServiceChargesPayload<
  T extends Record<string, unknown>,
>(row: T): T & { serviceCharges: RestaurantServiceCharges } {
  return {
    ...row,
    serviceCharges: parseRestaurantServiceCharges(null),
  };
}

export function isPrismaUnknownFieldError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Unknown field') ||
    error.message.includes('Unknown arg')
  );
}
