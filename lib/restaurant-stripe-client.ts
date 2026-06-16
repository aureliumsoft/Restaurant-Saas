import Stripe from 'stripe';

import {
  minimumCheckoutAmountMajor,
  toStripeUnitAmount,
} from '@/lib/stripe-server';

export type RestaurantStripeRuntimeConfig = {
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string | null;
  mode: 'test' | 'live';
};

export function normalizeStripeMode(
  raw: string | null | undefined,
  publishableKey?: string,
  secretKey?: string
): 'test' | 'live' {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'live' || normalized === 'test') {
    return normalized;
  }
  const pk = publishableKey?.trim() ?? '';
  const sk = secretKey?.trim() ?? '';
  if (pk.includes('_live_') || sk.includes('_live_')) return 'live';
  return 'test';
}

export function toRestaurantStripeRuntimeConfig(params: {
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string | null;
  mode?: string | null;
}): RestaurantStripeRuntimeConfig {
  const publishableKey = params.publishableKey.trim();
  const secretKey = params.secretKey.trim();
  return {
    publishableKey,
    secretKey,
    webhookSecret: params.webhookSecret?.trim() || null,
    mode: normalizeStripeMode(params.mode, publishableKey, secretKey),
  };
}

export function getRestaurantStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey.trim());
}

export async function testRestaurantStripeCredentials(
  config: RestaurantStripeRuntimeConfig
): Promise<void> {
  const stripe = getRestaurantStripeClient(config.secretKey);
  await stripe.balance.retrieve();
}

export async function createRestaurantStripeCheckoutSession(
  config: RestaurantStripeRuntimeConfig,
  params: {
    amount: number;
    currency: string;
    title: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }
) {
  const currency = params.currency.trim().toLowerCase();
  const minMajor = minimumCheckoutAmountMajor(currency);
  if (params.amount < minMajor) {
    throw new Error(
      `Amount is below the minimum for ${currency.toUpperCase()} checkout (${minMajor}).`
    );
  }

  const stripe = getRestaurantStripeClient(config.secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: toStripeUnitAmount(params.amount, currency),
          product_data: {
            name: params.title.slice(0, 200),
          },
        },
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }
  return { id: session.id, url: session.url };
}

export async function retrieveRestaurantStripeCheckoutSession(
  config: RestaurantStripeRuntimeConfig,
  sessionId: string
) {
  const stripe = getRestaurantStripeClient(config.secretKey);
  return stripe.checkout.sessions.retrieve(sessionId);
}

export function verifyRestaurantStripeWebhook(
  config: RestaurantStripeRuntimeConfig,
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!config.webhookSecret) {
    throw new Error('Stripe webhook signing secret is not configured for this restaurant.');
  }
  const stripe = getRestaurantStripeClient(config.secretKey);
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.webhookSecret
  );
}
