import type { RestaurantSubscription } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';

import { db } from '@/lib/db';
import { isPayPalNetworkError } from '@/lib/paypal-network';
import {
  activatePayPalSubscription,
  attemptSubscriptionAutoRenewal,
  cancelPayPalSubscription,
} from '@/lib/paypal-subscriptions';
import { isPayPalConfigured } from '@/lib/paypal-server';
import { isPeriodExpired } from '@/lib/subscription-period';

export type AutoRenewUpdateResult = {
  subscription: RestaurantSubscription;
  paypalMessage: string | null;
};

export type LifecycleOptions = {
  /** Call PayPal to charge the saved card and extend the period. */
  syncPayPal?: boolean;
};

function isRenewableStatus(status: SubscriptionStatus): boolean {
  return (
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.PAST_DUE
  );
}

/** Expire when auto-renew off; charge + 30-day extension when auto-renew on. */
export async function processSubscriptionLifecycle(
  restaurantId: string,
  opts?: LifecycleOptions
): Promise<RestaurantSubscription | null> {
  const syncPayPal = opts?.syncPayPal === true;

  const sub = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
  });
  if (!sub || !isRenewableStatus(sub.status)) return sub;

  const periodExpired = isPeriodExpired(sub.currentPeriodEnd);
  if (!periodExpired && sub.status !== SubscriptionStatus.PAST_DUE) {
    return sub;
  }

  if (!sub.autoRenew) {
    if (syncPayPal && sub.paypalSubscriptionId && isPayPalConfigured()) {
      try {
        await cancelPayPalSubscription(
          sub.paypalSubscriptionId,
          'Subscription period ended; auto-renew is off'
        );
      } catch (e) {
        if (!isPayPalNetworkError(e)) {
          console.warn('PayPal cancel on expiry failed:', e);
        }
      }
    }
    if (periodExpired) {
      return db.restaurantSubscription.update({
        where: { restaurantId },
        data: { status: SubscriptionStatus.CANCELED, adminPeriodEndAt: null },
      });
    }
    return sub;
  }

  if (syncPayPal && sub.paypalSubscriptionId && isPayPalConfigured()) {
    return attemptSubscriptionAutoRenewal(restaurantId);
  }

  return sub;
}

export async function setRestaurantAutoRenew(
  restaurantId: string,
  autoRenew: boolean
): Promise<AutoRenewUpdateResult> {
  const sub = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
  });
  if (!sub) {
    throw new Error('No subscription found');
  }

  let paypalMessage: string | null = null;

  if (sub.paypalSubscriptionId && isPayPalConfigured()) {
    if (!autoRenew) {
      try {
        await cancelPayPalSubscription(
          sub.paypalSubscriptionId,
          'Auto-renew disabled by restaurant owner'
        );
        paypalMessage =
          'Auto-renew turned off. Your subscription will end on the period end date.';
      } catch (e) {
        if (isPayPalNetworkError(e)) {
          paypalMessage =
            'Auto-renew turned off in the platform. PayPal could not be reached — billing will stop at period end.';
        } else {
          console.warn('PayPal cancel on auto-renew off failed:', e);
          paypalMessage =
            'Auto-renew turned off. Your subscription will end on the period end date.';
        }
      }
    } else {
      try {
        await activatePayPalSubscription(
          sub.paypalSubscriptionId,
          'Auto-renew enabled by restaurant owner'
        );
        paypalMessage =
          'Auto-renew is on. PayPal will charge your saved payment method and extend your plan by 30 days.';
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isPayPalNetworkError(e)) {
          paypalMessage =
            'Auto-renew saved. PayPal could not be reached — renewal will retry when online.';
        } else if (msg.includes('SUBSCRIPTION_STATUS_INVALID')) {
          paypalMessage =
            'Auto-renew saved. PayPal subscription is already active.';
        } else {
          throw e;
        }
      }
    }
  } else if (!autoRenew) {
    paypalMessage =
      'Auto-renew turned off. Your subscription will end on the period end date.';
  } else {
    paypalMessage = 'Auto-renew is on.';
  }

  let subscription = await db.restaurantSubscription.update({
    where: { restaurantId },
    data: { autoRenew },
  });

  if (
    autoRenew &&
    isPeriodExpired(subscription.currentPeriodEnd) &&
    subscription.paypalSubscriptionId &&
    isPayPalConfigured()
  ) {
    subscription =
      (await attemptSubscriptionAutoRenewal(restaurantId)) ?? subscription;
    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd.getTime() > Date.now()
    ) {
      paypalMessage =
        'Auto-renew is on. Your subscription was renewed for 30 more days.';
    }
  }

  return { subscription, paypalMessage };
}

/** After admin sets a custom period end, align PayPal with auto-renew preference. */
export async function syncPayPalAfterAdminPeriodChange(opts: {
  paypalSubscriptionId: string;
  autoRenew: boolean;
}): Promise<string | null> {
  if (!isPayPalConfigured()) return null;

  if (!opts.autoRenew) {
    try {
      await cancelPayPalSubscription(
        opts.paypalSubscriptionId,
        'Custom period end set by platform admin; auto-renew is off'
      );
      return 'PayPal subscription canceled — will not renew after the period end date.';
    } catch (e) {
      if (isPayPalNetworkError(e)) {
        return 'Period end saved. PayPal could not be reached; cancel will sync when online.';
      }
      return e instanceof Error ? e.message : 'PayPal cancel failed.';
    }
  }

  try {
    await activatePayPalSubscription(
      opts.paypalSubscriptionId,
      'Custom period end set by platform admin; auto-renew is on'
    );
    return 'PayPal will charge the saved card on renewal and extend access by 30 days.';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isPayPalNetworkError(e)) {
      return 'Period end saved. PayPal could not be reached; renewal will retry when online.';
    }
    if (msg.includes('SUBSCRIPTION_STATUS_INVALID')) return null;
    return msg;
  }
}
