import { CustomerPaymentProvider } from '@prisma/client';

import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from '@/lib/credentials-encryption';
import { db } from '@/lib/db';
import {
  normalizePayPalCountryCode,
  resolvePayPalBuyerCountry,
} from '@/lib/paypal-buyer-countries';
import {
  parseRestaurantRegionalSettings,
  RESTAURANT_REGIONAL_DB_SELECT,
} from '@/lib/restaurant-regional';
import { toPayPalCurrencyCode } from '@/lib/format-money';
import {
  normalizeEasypaisaMode,
  toRestaurantEasypaisaRuntimeConfig,
  type RestaurantEasypaisaRuntimeConfig,
} from '@/lib/restaurant-easypaisa-client';
import {
  normalizeJazzCashMode,
  toRestaurantJazzCashRuntimeConfig,
  type RestaurantJazzCashRuntimeConfig,
} from '@/lib/restaurant-jazzcash-client';
import {
  normalizePayPalMode,
  toRestaurantPayPalRuntimeConfig,
  type RestaurantPayPalRuntimeConfig,
} from '@/lib/restaurant-paypal-client';
import {
  normalizeStripeMode,
  toRestaurantStripeRuntimeConfig,
  type RestaurantStripeRuntimeConfig,
} from '@/lib/restaurant-stripe-client';

export type RestaurantPaymentProviderDto = {
  restaurantId: string;
  provider: CustomerPaymentProvider;
  paymentTerminalIp: string | null;
  paypal: {
    configured: boolean;
    verified: boolean;
    clientId: string | null;
    clientIdMasked: string | null;
    hasClientSecret: boolean;
    webhookId: string | null;
    mode: string | null;
    currency: string | null;
    countryCode: string | null;
    lastVerifiedAt: string | null;
  };
  stripe: {
    configured: boolean;
    verified: boolean;
    publishableKey: string | null;
    publishableKeyMasked: string | null;
    hasSecretKey: boolean;
    hasWebhookSecret: boolean;
    mode: string | null;
    lastVerifiedAt: string | null;
  };
  jazzcash: {
    configured: boolean;
    verified: boolean;
    merchantId: string | null;
    merchantIdMasked: string | null;
    hasPassword: boolean;
    hasIntegritySalt: boolean;
    mode: string | null;
    lastVerifiedAt: string | null;
  };
  easypaisa: {
    configured: boolean;
    verified: boolean;
    storeId: string | null;
    storeIdMasked: string | null;
    hasHashKey: boolean;
    username: string | null;
    hasPassword: boolean;
    mode: string | null;
    lastVerifiedAt: string | null;
  };
};

export type PublicRestaurantPaymentConfig = {
  provider: CustomerPaymentProvider;
  ready: boolean;
  currencyCode: string;
  countryCode: string;
  paypal?: {
    clientId: string;
    currency: string;
    mode: 'sandbox' | 'live';
    buyerCountry: string;
  };
  stripe?: {
    publishableKey: string;
    mode: 'test' | 'live';
    currency: string;
  };
  wallets?: {
    jazzcash?: { ready: true };
    easypaisa?: { ready: true };
  };
};

function paypalDto(
  row: Awaited<
    ReturnType<typeof db.restaurantPayPalCredentials.findUnique>
  > | null
) {
  if (!row) {
    return {
      configured: false,
      verified: false,
      clientId: null,
      clientIdMasked: null,
      hasClientSecret: false,
      webhookId: null,
      mode: null,
      currency: null,
      countryCode: null,
      lastVerifiedAt: null,
    };
  }
  return {
    configured: true,
    verified: row.isVerified,
    clientId: row.clientId,
    clientIdMasked: maskSecret(row.clientId),
    hasClientSecret: Boolean(row.clientSecretEnc),
    webhookId: row.webhookId,
    mode: row.mode,
    currency: row.currency,
    countryCode: row.countryCode,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

function stripeDto(
  row: Awaited<
    ReturnType<typeof db.restaurantStripeCredentials.findUnique>
  > | null
) {
  if (!row) {
    return {
      configured: false,
      verified: false,
      publishableKey: null,
      publishableKeyMasked: null,
      hasSecretKey: false,
      hasWebhookSecret: false,
      mode: null,
      lastVerifiedAt: null,
    };
  }
  return {
    configured: true,
    verified: row.isVerified,
    publishableKey: row.publishableKey,
    publishableKeyMasked: maskSecret(row.publishableKey),
    hasSecretKey: Boolean(row.secretKeyEnc),
    hasWebhookSecret: Boolean(row.webhookSecretEnc),
    mode: row.mode,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

function jazzCashDto(
  row: Awaited<
    ReturnType<typeof db.restaurantJazzCashCredentials.findUnique>
  > | null
) {
  if (!row) {
    return {
      configured: false,
      verified: false,
      merchantId: null,
      merchantIdMasked: null,
      hasPassword: false,
      hasIntegritySalt: false,
      mode: null,
      lastVerifiedAt: null,
    };
  }
  return {
    configured: true,
    verified: row.isVerified,
    merchantId: row.merchantId,
    merchantIdMasked: maskSecret(row.merchantId),
    hasPassword: Boolean(row.passwordEnc),
    hasIntegritySalt: Boolean(row.integritySaltEnc),
    mode: row.mode,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

function easypaisaDto(
  row: Awaited<
    ReturnType<typeof db.restaurantEasypaisaCredentials.findUnique>
  > | null
) {
  if (!row) {
    return {
      configured: false,
      verified: false,
      storeId: null,
      storeIdMasked: null,
      hasHashKey: false,
      username: null,
      hasPassword: false,
      mode: null,
      lastVerifiedAt: null,
    };
  }
  return {
    configured: true,
    verified: row.isVerified,
    storeId: row.storeId,
    storeIdMasked: maskSecret(row.storeId),
    hasHashKey: Boolean(row.hashKeyEnc),
    username: row.username,
    hasPassword: Boolean(row.passwordEnc),
    mode: row.mode,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

export function isRestaurantPayPalCredentialsReady(
  row: { clientId: string; clientSecretEnc: string; isVerified: boolean } | null
): boolean {
  return Boolean(row?.clientId && row.clientSecretEnc && row.isVerified);
}

export function isRestaurantStripeCredentialsReady(
  row: {
    publishableKey: string;
    secretKeyEnc: string;
    isVerified: boolean;
  } | null
): boolean {
  return Boolean(row?.publishableKey && row.secretKeyEnc && row.isVerified);
}

export function isRestaurantJazzCashCredentialsReady(
  row: {
    merchantId: string;
    passwordEnc: string;
    integritySaltEnc: string;
    isVerified: boolean;
  } | null
): boolean {
  return Boolean(
    row?.merchantId &&
      row.passwordEnc &&
      row.integritySaltEnc &&
      row.isVerified
  );
}

export function isRestaurantEasypaisaCredentialsReady(
  row: {
    storeId: string;
    hashKeyEnc: string;
    isVerified: boolean;
  } | null
): boolean {
  return Boolean(row?.storeId && row.hashKeyEnc && row.isVerified);
}

export async function getRestaurantPaymentProviderDto(
  restaurantId: string
): Promise<RestaurantPaymentProviderDto> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      customerPaymentProvider: true,
      paymentTerminalIp: true,
      paypalCredentials: true,
      stripeCredentials: true,
      jazzCashCredentials: true,
      easypaisaCredentials: true,
    },
  });
  if (!restaurant) {
    throw new Error('Restaurant not found.');
  }
  return {
    restaurantId,
    provider: restaurant.customerPaymentProvider,
    paymentTerminalIp: restaurant.paymentTerminalIp ?? null,
    paypal: paypalDto(restaurant.paypalCredentials),
    stripe: stripeDto(restaurant.stripeCredentials),
    jazzcash: jazzCashDto(restaurant.jazzCashCredentials),
    easypaisa: easypaisaDto(restaurant.easypaisaCredentials),
  };
}

export async function setRestaurantPaymentProvider(
  restaurantId: string,
  provider: CustomerPaymentProvider,
  paymentTerminalIp?: string | null
) {
  if (provider === CustomerPaymentProvider.PAYPAL) {
    const creds = await db.restaurantPayPalCredentials.findUnique({
      where: { restaurantId },
    });
    if (!isRestaurantPayPalCredentialsReady(creds)) {
      throw new Error(
        'Save and verify PayPal credentials before activating PayPal.'
      );
    }
  }
  if (provider === CustomerPaymentProvider.STRIPE) {
    const creds = await db.restaurantStripeCredentials.findUnique({
      where: { restaurantId },
    });
    if (!isRestaurantStripeCredentialsReady(creds)) {
      throw new Error(
        'Save and verify Stripe credentials before activating Stripe.'
      );
    }
  }
  if (provider === CustomerPaymentProvider.WALLETS) {
    const [jazz, easy] = await Promise.all([
      db.restaurantJazzCashCredentials.findUnique({ where: { restaurantId } }),
      db.restaurantEasypaisaCredentials.findUnique({ where: { restaurantId } }),
    ]);
    if (
      !isRestaurantJazzCashCredentialsReady(jazz) &&
      !isRestaurantEasypaisaCredentialsReady(easy)
    ) {
      throw new Error(
        'Save and verify JazzCash and/or Easypaisa credentials before activating wallets.'
      );
    }
  }

  await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      customerPaymentProvider: provider,
      ...(paymentTerminalIp !== undefined
        ? { paymentTerminalIp: paymentTerminalIp?.trim() || null }
        : {}),
    },
  });
}

export async function getRestaurantPayPalRuntimeConfigBySlug(
  slug: string
): Promise<{
  restaurantId: string;
  slug: string;
  provider: CustomerPaymentProvider;
  config: RestaurantPayPalRuntimeConfig;
} | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      customerPaymentProvider: true,
      paypalCredentials: true,
      ...RESTAURANT_REGIONAL_DB_SELECT,
    },
  });
  if (
    !restaurant ||
    restaurant.customerPaymentProvider !== CustomerPaymentProvider.PAYPAL ||
    !isRestaurantPayPalCredentialsReady(restaurant.paypalCredentials)
  ) {
    return null;
  }
  const creds = restaurant.paypalCredentials!;
  const regional = parseRestaurantRegionalSettings(restaurant);
  return {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    provider: restaurant.customerPaymentProvider,
    config: toRestaurantPayPalRuntimeConfig({
      clientId: creds.clientId,
      clientSecret: decryptSecret(creds.clientSecretEnc),
      mode: creds.mode,
      currency: creds.currency || regional.currencyCode,
      countryCode: creds.countryCode || regional.countryCode,
    }),
  };
}

export async function getRestaurantPayPalRuntimeConfigByRestaurantId(
  restaurantId: string
): Promise<RestaurantPayPalRuntimeConfig | null> {
  const row = await db.restaurantPayPalCredentials.findUnique({
    where: { restaurantId },
  });
  if (!isRestaurantPayPalCredentialsReady(row)) return null;
  return toRestaurantPayPalRuntimeConfig({
    clientId: row!.clientId,
    clientSecret: decryptSecret(row!.clientSecretEnc),
    mode: row!.mode,
    currency: row!.currency,
    countryCode: row!.countryCode,
  });
}

export async function getRestaurantStripeRuntimeConfigBySlug(
  slug: string
): Promise<{
  restaurantId: string;
  slug: string;
  provider: CustomerPaymentProvider;
  config: RestaurantStripeRuntimeConfig;
} | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      customerPaymentProvider: true,
      stripeCredentials: true,
    },
  });
  if (
    !restaurant ||
    restaurant.customerPaymentProvider !== CustomerPaymentProvider.STRIPE ||
    !isRestaurantStripeCredentialsReady(restaurant.stripeCredentials)
  ) {
    return null;
  }
  const creds = restaurant.stripeCredentials!;
  return {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    provider: restaurant.customerPaymentProvider,
    config: toRestaurantStripeRuntimeConfig({
      publishableKey: creds.publishableKey,
      secretKey: decryptSecret(creds.secretKeyEnc),
      webhookSecret: creds.webhookSecretEnc
        ? decryptSecret(creds.webhookSecretEnc)
        : null,
      mode: creds.mode,
    }),
  };
}

export async function getRestaurantStripeRuntimeConfigByRestaurantId(
  restaurantId: string
): Promise<RestaurantStripeRuntimeConfig | null> {
  const row = await db.restaurantStripeCredentials.findUnique({
    where: { restaurantId },
  });
  if (!isRestaurantStripeCredentialsReady(row)) return null;
  return toRestaurantStripeRuntimeConfig({
    publishableKey: row!.publishableKey,
    secretKey: decryptSecret(row!.secretKeyEnc),
    webhookSecret: row!.webhookSecretEnc
      ? decryptSecret(row!.webhookSecretEnc)
      : null,
    mode: row!.mode,
  });
}

export async function getRestaurantJazzCashRuntimeConfigBySlug(
  slug: string
): Promise<{
  restaurantId: string;
  slug: string;
  provider: CustomerPaymentProvider;
  config: RestaurantJazzCashRuntimeConfig;
} | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      customerPaymentProvider: true,
      jazzCashCredentials: true,
    },
  });
  if (
    !restaurant ||
    restaurant.customerPaymentProvider !== CustomerPaymentProvider.WALLETS ||
    !isRestaurantJazzCashCredentialsReady(restaurant.jazzCashCredentials)
  ) {
    return null;
  }
  const creds = restaurant.jazzCashCredentials!;
  return {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    provider: restaurant.customerPaymentProvider,
    config: toRestaurantJazzCashRuntimeConfig({
      merchantId: creds.merchantId,
      password: decryptSecret(creds.passwordEnc),
      integritySalt: decryptSecret(creds.integritySaltEnc),
      mode: creds.mode,
    }),
  };
}

export async function getRestaurantJazzCashRuntimeConfigByRestaurantId(
  restaurantId: string
): Promise<RestaurantJazzCashRuntimeConfig | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      customerPaymentProvider: true,
      jazzCashCredentials: true,
    },
  });
  if (
    !restaurant ||
    restaurant.customerPaymentProvider !== CustomerPaymentProvider.WALLETS ||
    !isRestaurantJazzCashCredentialsReady(restaurant.jazzCashCredentials)
  ) {
    return null;
  }
  const creds = restaurant.jazzCashCredentials!;
  return toRestaurantJazzCashRuntimeConfig({
    merchantId: creds.merchantId,
    password: decryptSecret(creds.passwordEnc),
    integritySalt: decryptSecret(creds.integritySaltEnc),
    mode: creds.mode,
  });
}

export async function getRestaurantEasypaisaRuntimeConfigBySlug(
  slug: string
): Promise<{
  restaurantId: string;
  slug: string;
  provider: CustomerPaymentProvider;
  config: RestaurantEasypaisaRuntimeConfig;
} | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      customerPaymentProvider: true,
      easypaisaCredentials: true,
    },
  });
  if (
    !restaurant ||
    restaurant.customerPaymentProvider !== CustomerPaymentProvider.WALLETS ||
    !isRestaurantEasypaisaCredentialsReady(restaurant.easypaisaCredentials)
  ) {
    return null;
  }
  const creds = restaurant.easypaisaCredentials!;
  return {
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    provider: restaurant.customerPaymentProvider,
    config: toRestaurantEasypaisaRuntimeConfig({
      storeId: creds.storeId,
      hashKey: decryptSecret(creds.hashKeyEnc),
      username: creds.username,
      password: creds.passwordEnc ? decryptSecret(creds.passwordEnc) : null,
      mode: creds.mode,
    }),
  };
}

export async function getRestaurantEasypaisaRuntimeConfigByRestaurantId(
  restaurantId: string
): Promise<RestaurantEasypaisaRuntimeConfig | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      customerPaymentProvider: true,
      easypaisaCredentials: true,
    },
  });
  if (
    !restaurant ||
    restaurant.customerPaymentProvider !== CustomerPaymentProvider.WALLETS ||
    !isRestaurantEasypaisaCredentialsReady(restaurant.easypaisaCredentials)
  ) {
    return null;
  }
  const creds = restaurant.easypaisaCredentials!;
  return toRestaurantEasypaisaRuntimeConfig({
    storeId: creds.storeId,
    hashKey: decryptSecret(creds.hashKeyEnc),
    username: creds.username,
    password: creds.passwordEnc ? decryptSecret(creds.passwordEnc) : null,
    mode: creds.mode,
  });
}

export async function getPublicRestaurantPaymentConfigBySlug(
  slug: string
): Promise<PublicRestaurantPaymentConfig | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      customerPaymentProvider: true,
      paypalCredentials: true,
      stripeCredentials: true,
      jazzCashCredentials: true,
      easypaisaCredentials: true,
      ...RESTAURANT_REGIONAL_DB_SELECT,
    },
  });
  if (!restaurant) return null;

  const regional = parseRestaurantRegionalSettings(restaurant);
  const restaurantCurrency = toPayPalCurrencyCode(regional.currencyCode);
  const restaurantCountry = regional.countryCode;

  const provider = restaurant.customerPaymentProvider;
  if (provider === CustomerPaymentProvider.PAYPAL) {
    const creds = restaurant.paypalCredentials;
    if (!isRestaurantPayPalCredentialsReady(creds)) {
      return {
        provider,
        ready: false,
        currencyCode: restaurantCurrency,
        countryCode: restaurantCountry,
      };
    }
    const paypalCurrency = toPayPalCurrencyCode(
      creds!.currency || restaurantCurrency
    );
    return {
      provider,
      ready: true,
      currencyCode: paypalCurrency,
      countryCode: resolvePayPalBuyerCountry(
        creds!.countryCode || restaurantCountry,
        paypalCurrency
      ),
      paypal: {
        clientId: creds!.clientId,
        currency: paypalCurrency,
        mode: normalizePayPalMode(creds!.mode),
        buyerCountry: resolvePayPalBuyerCountry(
          creds!.countryCode || restaurantCountry,
          paypalCurrency
        ),
      },
    };
  }

  if (provider === CustomerPaymentProvider.STRIPE) {
    const creds = restaurant.stripeCredentials;
    if (!isRestaurantStripeCredentialsReady(creds)) {
      return {
        provider,
        ready: false,
        currencyCode: restaurantCurrency,
        countryCode: restaurantCountry,
      };
    }
    return {
      provider,
      ready: true,
      currencyCode: restaurantCurrency,
      countryCode: restaurantCountry,
      stripe: {
        publishableKey: creds!.publishableKey,
        mode: normalizeStripeMode(
          creds!.mode,
          creds!.publishableKey,
          undefined
        ),
        currency: restaurantCurrency,
      },
    };
  }

  if (provider === CustomerPaymentProvider.WALLETS) {
    const jazzReady = isRestaurantJazzCashCredentialsReady(
      restaurant.jazzCashCredentials
    );
    const easyReady = isRestaurantEasypaisaCredentialsReady(
      restaurant.easypaisaCredentials
    );
    const wallets: PublicRestaurantPaymentConfig['wallets'] = {};
    if (jazzReady) wallets.jazzcash = { ready: true };
    if (easyReady) wallets.easypaisa = { ready: true };
    return {
      provider,
      ready: jazzReady || easyReady,
      currencyCode: restaurantCurrency,
      countryCode: restaurantCountry,
      wallets: jazzReady || easyReady ? wallets : undefined,
    };
  }

  return {
    provider: CustomerPaymentProvider.NONE,
    ready: false,
    currencyCode: restaurantCurrency,
    countryCode: restaurantCountry,
  };
}

export async function upsertRestaurantPayPalCredentials(params: {
  restaurantId: string;
  clientId: string;
  clientSecret?: string;
  webhookId?: string | null;
  mode: string;
  currency: string;
  countryCode: string;
  isVerified: boolean;
}) {
  const existing = await db.restaurantPayPalCredentials.findUnique({
    where: { restaurantId: params.restaurantId },
  });
  const clientSecret =
    params.clientSecret?.trim() ||
    (existing ? decryptSecret(existing.clientSecretEnc) : '');
  if (!clientSecret) {
    throw new Error('Client secret is required.');
  }

  const countryCode = normalizePayPalCountryCode(
    params.countryCode,
    resolvePayPalBuyerCountry(null, params.currency)
  );

  const row = await db.restaurantPayPalCredentials.upsert({
    where: { restaurantId: params.restaurantId },
    create: {
      restaurantId: params.restaurantId,
      clientId: params.clientId.trim(),
      clientSecretEnc: encryptSecret(clientSecret),
      webhookId: params.webhookId?.trim() || null,
      mode: normalizePayPalMode(params.mode),
      currency: params.currency.trim().toUpperCase() || 'EUR',
      countryCode,
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
    update: {
      clientId: params.clientId.trim(),
      clientSecretEnc: encryptSecret(clientSecret),
      webhookId: params.webhookId?.trim() || null,
      mode: normalizePayPalMode(params.mode),
      currency: params.currency.trim().toUpperCase() || 'EUR',
      countryCode,
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
  });
  return paypalDto(row);
}

export async function upsertRestaurantStripeCredentials(params: {
  restaurantId: string;
  publishableKey: string;
  secretKey?: string;
  webhookSecret?: string | null;
  mode: string;
  isVerified: boolean;
}) {
  const existing = await db.restaurantStripeCredentials.findUnique({
    where: { restaurantId: params.restaurantId },
  });
  const secretKey =
    params.secretKey?.trim() ||
    (existing ? decryptSecret(existing.secretKeyEnc) : '');
  if (!secretKey) {
    throw new Error('Secret key is required.');
  }

  const webhookSecret =
    params.webhookSecret === undefined
      ? existing?.webhookSecretEnc
        ? decryptSecret(existing.webhookSecretEnc)
        : null
      : params.webhookSecret?.trim() || null;

  const row = await db.restaurantStripeCredentials.upsert({
    where: { restaurantId: params.restaurantId },
    create: {
      restaurantId: params.restaurantId,
      publishableKey: params.publishableKey.trim(),
      secretKeyEnc: encryptSecret(secretKey),
      webhookSecretEnc: webhookSecret ? encryptSecret(webhookSecret) : null,
      mode: normalizeStripeMode(
        params.mode,
        params.publishableKey,
        secretKey
      ),
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
    update: {
      publishableKey: params.publishableKey.trim(),
      secretKeyEnc: encryptSecret(secretKey),
      webhookSecretEnc: webhookSecret ? encryptSecret(webhookSecret) : null,
      mode: normalizeStripeMode(
        params.mode,
        params.publishableKey,
        secretKey
      ),
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
  });
  return stripeDto(row);
}

export async function upsertRestaurantJazzCashCredentials(params: {
  restaurantId: string;
  merchantId: string;
  password?: string;
  integritySalt?: string;
  mode: string;
  isVerified: boolean;
}) {
  const existing = await db.restaurantJazzCashCredentials.findUnique({
    where: { restaurantId: params.restaurantId },
  });
  const password =
    params.password?.trim() ||
    (existing ? decryptSecret(existing.passwordEnc) : '');
  const integritySalt =
    params.integritySalt?.trim() ||
    (existing ? decryptSecret(existing.integritySaltEnc) : '');
  if (!password) throw new Error('Password is required.');
  if (!integritySalt) throw new Error('Integrity salt is required.');

  const row = await db.restaurantJazzCashCredentials.upsert({
    where: { restaurantId: params.restaurantId },
    create: {
      restaurantId: params.restaurantId,
      merchantId: params.merchantId.trim(),
      passwordEnc: encryptSecret(password),
      integritySaltEnc: encryptSecret(integritySalt),
      mode: normalizeJazzCashMode(params.mode),
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
    update: {
      merchantId: params.merchantId.trim(),
      passwordEnc: encryptSecret(password),
      integritySaltEnc: encryptSecret(integritySalt),
      mode: normalizeJazzCashMode(params.mode),
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
  });
  return jazzCashDto(row);
}

export async function upsertRestaurantEasypaisaCredentials(params: {
  restaurantId: string;
  storeId: string;
  hashKey?: string;
  username?: string | null;
  password?: string | null;
  mode: string;
  isVerified: boolean;
}) {
  const existing = await db.restaurantEasypaisaCredentials.findUnique({
    where: { restaurantId: params.restaurantId },
  });
  const hashKey =
    params.hashKey?.trim() ||
    (existing ? decryptSecret(existing.hashKeyEnc) : '');
  if (!hashKey) throw new Error('Hash key is required.');

  const password =
    params.password === undefined
      ? existing?.passwordEnc
        ? decryptSecret(existing.passwordEnc)
        : null
      : params.password?.trim() || null;

  const username =
    params.username === undefined
      ? existing?.username ?? null
      : params.username?.trim() || null;

  const row = await db.restaurantEasypaisaCredentials.upsert({
    where: { restaurantId: params.restaurantId },
    create: {
      restaurantId: params.restaurantId,
      storeId: params.storeId.trim(),
      hashKeyEnc: encryptSecret(hashKey),
      username,
      passwordEnc: password ? encryptSecret(password) : null,
      mode: normalizeEasypaisaMode(params.mode),
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
    update: {
      storeId: params.storeId.trim(),
      hashKeyEnc: encryptSecret(hashKey),
      username,
      passwordEnc: password ? encryptSecret(password) : null,
      mode: normalizeEasypaisaMode(params.mode),
      isVerified: params.isVerified,
      lastVerifiedAt: params.isVerified ? new Date() : null,
    },
  });
  return easypaisaDto(row);
}

export async function deleteRestaurantPayPalCredentials(restaurantId: string) {
  await db.restaurantPayPalCredentials.deleteMany({ where: { restaurantId } });
  await db.restaurant.updateMany({
    where: {
      id: restaurantId,
      customerPaymentProvider: CustomerPaymentProvider.PAYPAL,
    },
    data: { customerPaymentProvider: CustomerPaymentProvider.NONE },
  });
}

export async function deleteRestaurantStripeCredentials(restaurantId: string) {
  await db.restaurantStripeCredentials.deleteMany({ where: { restaurantId } });
  await db.restaurant.updateMany({
    where: {
      id: restaurantId,
      customerPaymentProvider: CustomerPaymentProvider.STRIPE,
    },
    data: { customerPaymentProvider: CustomerPaymentProvider.NONE },
  });
}

async function maybeDisableWalletsIfNoneReady(restaurantId: string) {
  const [jazz, easy] = await Promise.all([
    db.restaurantJazzCashCredentials.findUnique({ where: { restaurantId } }),
    db.restaurantEasypaisaCredentials.findUnique({ where: { restaurantId } }),
  ]);
  if (
    isRestaurantJazzCashCredentialsReady(jazz) ||
    isRestaurantEasypaisaCredentialsReady(easy)
  ) {
    return;
  }
  await db.restaurant.updateMany({
    where: {
      id: restaurantId,
      customerPaymentProvider: CustomerPaymentProvider.WALLETS,
    },
    data: { customerPaymentProvider: CustomerPaymentProvider.NONE },
  });
}

export async function deleteRestaurantJazzCashCredentials(
  restaurantId: string
) {
  await db.restaurantJazzCashCredentials.deleteMany({ where: { restaurantId } });
  await maybeDisableWalletsIfNoneReady(restaurantId);
}

export async function deleteRestaurantEasypaisaCredentials(
  restaurantId: string
) {
  await db.restaurantEasypaisaCredentials.deleteMany({
    where: { restaurantId },
  });
  await maybeDisableWalletsIfNoneReady(restaurantId);
}
