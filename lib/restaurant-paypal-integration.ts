import { db } from '@/lib/db';
import {
  getMerchantIntegrationByTrackingId,
  getMerchantIntegrationStatus,
  type MerchantIntegrationStatus,
} from '@/lib/paypal-partner';

export type RestaurantPayPalDto = {
  restaurantId: string;
  trackingId: string;
  paypalMerchantId: string | null;
  permissionsGranted: boolean;
  accountStatus: string | null;
  paymentsReceivable: boolean;
  primaryEmail: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  onboardedAt: string | null;
  paymentsReady: boolean;
};

export function isRestaurantPayPalReady(integration: {
  paypalMerchantId: string | null;
  permissionsGranted: boolean;
  paymentsReceivable: boolean;
} | null): boolean {
  if (!integration?.paypalMerchantId) return false;
  return integration.permissionsGranted && integration.paymentsReceivable;
}

function toDto(
  row: NonNullable<
    Awaited<ReturnType<typeof db.restaurantPayPalIntegration.findUnique>>
  >
): RestaurantPayPalDto {
  return {
    restaurantId: row.restaurantId,
    trackingId: row.trackingId,
    paypalMerchantId: row.paypalMerchantId,
    permissionsGranted: row.permissionsGranted,
    accountStatus: row.accountStatus,
    paymentsReceivable: row.paymentsReceivable,
    primaryEmail: row.primaryEmail,
    countryCode: row.countryCode,
    currencyCode: row.currencyCode,
    onboardedAt: row.onboardedAt?.toISOString() ?? null,
    paymentsReady: isRestaurantPayPalReady(row),
  };
}

export async function getPayPalIntegrationByRestaurantId(restaurantId: string) {
  const row = await db.restaurantPayPalIntegration.findUnique({
    where: { restaurantId },
  });
  return row ? toDto(row) : null;
}

export async function getPayPalIntegrationBySlug(slug: string) {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      paypalIntegration: true,
    },
  });
  if (!restaurant) return null;
  return {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    integration: restaurant.paypalIntegration
      ? toDto(restaurant.paypalIntegration)
      : null,
  };
}

export async function ensurePayPalIntegrationRow(restaurantId: string) {
  return db.restaurantPayPalIntegration.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      trackingId: restaurantId,
    },
    update: {},
  });
}

export async function syncPayPalIntegrationFromPayPal(
  restaurantId: string,
  sellerMerchantId: string
): Promise<RestaurantPayPalDto> {
  const live = await getMerchantIntegrationStatus(sellerMerchantId);
  return applyMerchantStatus(restaurantId, live);
}

export async function syncPayPalIntegrationByTrackingId(
  restaurantId: string,
  trackingId: string
): Promise<RestaurantPayPalDto | null> {
  const live = await getMerchantIntegrationByTrackingId(trackingId);
  if (!live) return null;
  return applyMerchantStatus(restaurantId, live);
}

async function applyMerchantStatus(
  restaurantId: string,
  live: MerchantIntegrationStatus
): Promise<RestaurantPayPalDto> {
  const now = new Date();
  const row = await db.restaurantPayPalIntegration.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      trackingId: restaurantId,
      paypalMerchantId: live.merchantId,
      permissionsGranted: live.permissionsGranted,
      paymentsReceivable: live.paymentsReceivable,
      accountStatus: live.accountStatus,
      primaryEmail: live.primaryEmail,
      countryCode: live.countryCode,
      currencyCode: live.currencyCode,
      onboardedAt:
        live.permissionsGranted && live.paymentsReceivable ? now : null,
      lastStatusCheckAt: now,
    },
    update: {
      paypalMerchantId: live.merchantId,
      permissionsGranted: live.permissionsGranted,
      paymentsReceivable: live.paymentsReceivable,
      accountStatus: live.accountStatus,
      primaryEmail: live.primaryEmail,
      countryCode: live.countryCode,
      currencyCode: live.currencyCode,
      onboardedAt:
        live.permissionsGranted && live.paymentsReceivable ? now : undefined,
      lastStatusCheckAt: now,
    },
  });
  return toDto(row);
}

export async function completePayPalOnboardingFromReturn(params: {
  restaurantId: string;
  merchantIdInPayPal?: string | null;
  permissionsGranted?: boolean | null;
  accountStatus?: string | null;
}): Promise<RestaurantPayPalDto> {
  await ensurePayPalIntegrationRow(params.restaurantId);

  if (params.merchantIdInPayPal?.trim()) {
    return syncPayPalIntegrationFromPayPal(
      params.restaurantId,
      params.merchantIdInPayPal.trim()
    );
  }

  const synced = await syncPayPalIntegrationByTrackingId(
    params.restaurantId,
    params.restaurantId
  );
  if (synced) return synced;

  const row = await db.restaurantPayPalIntegration.update({
    where: { restaurantId: params.restaurantId },
    data: {
      permissionsGranted: params.permissionsGranted === true,
      accountStatus: params.accountStatus ?? undefined,
      lastStatusCheckAt: new Date(),
    },
  });
  return toDto(row);
}
