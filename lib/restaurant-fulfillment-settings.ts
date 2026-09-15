import { db } from '@/lib/db';

export type RestaurantFulfillmentSettings = {
  deliveryEnabled: boolean;
  dineInEnabled: boolean;
  cardPaymentsEnabled: boolean;
  websiteEnabled: boolean;
  kioskEnabled: boolean;
  kdsEnabled: boolean;
  orderDisplayEnabled: boolean;
};

export const RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT = {
  deliveryEnabled: true,
  dineInEnabled: true,
  cardPaymentsEnabled: true,
  websiteEnabled: true,
  kioskEnabled: true,
  kdsEnabled: true,
  orderDisplayEnabled: true,
} as const;

export type RestaurantFulfillmentSettingsRow = {
  deliveryEnabled: boolean;
  dineInEnabled: boolean;
  cardPaymentsEnabled: boolean;
  websiteEnabled: boolean;
  kioskEnabled: boolean;
  kdsEnabled: boolean;
  orderDisplayEnabled: boolean;
};

export const DEFAULT_RESTAURANT_FULFILLMENT_SETTINGS: RestaurantFulfillmentSettings =
  {
    deliveryEnabled: true,
    dineInEnabled: true,
    cardPaymentsEnabled: true,
    websiteEnabled: true,
    kioskEnabled: true,
    kdsEnabled: true,
    orderDisplayEnabled: true,
  };

export function parseRestaurantFulfillmentSettings(
  row: Partial<RestaurantFulfillmentSettingsRow> | null | undefined
): RestaurantFulfillmentSettings {
  return {
    deliveryEnabled: row?.deliveryEnabled !== false,
    dineInEnabled: row?.dineInEnabled !== false,
    cardPaymentsEnabled: row?.cardPaymentsEnabled !== false,
    websiteEnabled: row?.websiteEnabled !== false,
    kioskEnabled: row?.kioskEnabled !== false,
    kdsEnabled: row?.kdsEnabled !== false,
    orderDisplayEnabled: row?.orderDisplayEnabled !== false,
  };
}

export function withFulfillmentSettingsPayload<
  T extends Record<string, unknown>,
>(row: T): T & { fulfillmentSettings: RestaurantFulfillmentSettings } {
  return {
    ...row,
    fulfillmentSettings: parseRestaurantFulfillmentSettings(
      row as Partial<RestaurantFulfillmentSettingsRow>
    ),
  };
}

export function isPrismaFulfillmentSettingsFieldError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('deliveryEnabled') ||
    error.message.includes('dineInEnabled') ||
    error.message.includes('cardPaymentsEnabled') ||
    error.message.includes('websiteEnabled') ||
    error.message.includes('kioskEnabled') ||
    error.message.includes('kdsEnabled') ||
    error.message.includes('orderDisplayEnabled') ||
    error.message.includes('Unknown field') ||
    error.message.includes('Unknown arg')
  );
}

export async function loadRestaurantFulfillmentSettings(restaurantId: string) {
  const row = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
  });
  return parseRestaurantFulfillmentSettings(row ?? undefined);
}

