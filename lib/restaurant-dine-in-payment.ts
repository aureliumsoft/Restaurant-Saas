export const DINE_IN_PAYMENT_TIMING_VALUES = [
  'ON_LEAVE',
  'BEFORE_KITCHEN',
] as const;

export type DineInPaymentTiming = (typeof DINE_IN_PAYMENT_TIMING_VALUES)[number];

export const DEFAULT_DINE_IN_PAYMENT_TIMING: DineInPaymentTiming = 'ON_LEAVE';

export const RESTAURANT_DINE_IN_PAYMENT_DB_SELECT = {
  dineInPaymentTiming: true,
} as const;

export type RestaurantDineInPaymentRow = {
  dineInPaymentTiming: string | null | undefined;
};

export function parseDineInPaymentTiming(
  value: unknown
): DineInPaymentTiming {
  if (value === 'BEFORE_KITCHEN' || value === 'ON_LEAVE') return value;
  return DEFAULT_DINE_IN_PAYMENT_TIMING;
}

export function parseRestaurantDineInPayment(
  row: RestaurantDineInPaymentRow | null | undefined
): { dineInPaymentTiming: DineInPaymentTiming } {
  return {
    dineInPaymentTiming: parseDineInPaymentTiming(row?.dineInPaymentTiming),
  };
}

export function isDineInPayBeforeKitchen(
  timing: DineInPaymentTiming | string | null | undefined
): boolean {
  return parseDineInPaymentTiming(timing) === 'BEFORE_KITCHEN';
}
