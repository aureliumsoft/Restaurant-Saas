import type { RestaurantSubscription, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

import { db } from '@/lib/db';
import {
  syncPayPalSubscriptionFromAdmin,
  type PayPalAdminSyncResult,
} from '@/lib/paypal-subscriptions';
import { syncPayPalAfterAdminPeriodChange } from '@/lib/subscription-lifecycle';

export type AdminSubscriptionPatch = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  notes?: string | null;
};

export type AdminSubscriptionUpdateResult = {
  subscription: RestaurantSubscription;
  paypal: PayPalAdminSyncResult;
  paymentPeriodEndUpdated: boolean;
  periodEndChanged: boolean;
};

function datesDiffer(a: Date | null | undefined, b: Date | null | undefined) {
  const aMs = a?.getTime() ?? null;
  const bMs = b?.getTime() ?? null;
  return aMs !== bMs;
}

async function syncLatestPaymentPeriodEnd(
  restaurantId: string,
  restaurantSubscriptionId: string,
  periodEnd: Date | null
): Promise<boolean> {
  const latest = await db.subscriptionPayment.findFirst({
    where: { restaurantId },
    orderBy: { paidAt: 'desc' },
    select: { id: true, periodEnd: true },
  });
  if (!latest) return false;
  if (!datesDiffer(latest.periodEnd, periodEnd)) return false;

  await db.subscriptionPayment.update({
    where: { id: latest.id },
    data: {
      periodEnd,
      restaurantSubscriptionId,
    },
  });
  return true;
}

export async function applyAdminSubscriptionUpdate(
  restaurantId: string,
  patch: AdminSubscriptionPatch
): Promise<AdminSubscriptionUpdateResult> {
  const existing = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
  });

  const trialEndsAt =
    patch.trialEndsAt === undefined
      ? existing?.trialEndsAt ?? null
      : patch.trialEndsAt;
  const currentPeriodEnd =
    patch.currentPeriodEnd === undefined
      ? existing?.currentPeriodEnd ?? null
      : patch.currentPeriodEnd;

  const periodChanged =
    patch.currentPeriodEnd !== undefined &&
    datesDiffer(existing?.currentPeriodEnd, currentPeriodEnd);

  const subscription = await db.restaurantSubscription.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      plan: patch.plan,
      status: patch.status,
      trialEndsAt,
      currentPeriodEnd,
      notes: patch.notes ?? null,
      autoRenew: true,
      adminPeriodEndAt: currentPeriodEnd,
    },
    update: {
      plan: patch.plan,
      status: patch.status,
      trialEndsAt,
      currentPeriodEnd,
      notes: patch.notes === undefined ? undefined : patch.notes,
      ...(periodChanged
        ? { adminPeriodEndAt: currentPeriodEnd }
        : patch.currentPeriodEnd === null
          ? { adminPeriodEndAt: null }
          : {}),
    },
  });

  const paymentPeriodEndUpdated = periodChanged
    ? await syncLatestPaymentPeriodEnd(
        restaurantId,
        subscription.id,
        currentPeriodEnd
      )
    : false;

  let paypal: PayPalAdminSyncResult = {
    attempted: false,
    ok: true,
    messages: [],
  };

  if (subscription.paypalSubscriptionId) {
    paypal = await syncPayPalSubscriptionFromAdmin({
      paypalSubscriptionId: subscription.paypalSubscriptionId,
      previousPlan: existing?.plan ?? patch.plan,
      nextPlan: patch.plan,
      previousStatus: existing?.status ?? patch.status,
      nextStatus: patch.status,
    });

    if (periodChanged) {
      const periodMsg = await syncPayPalAfterAdminPeriodChange({
        paypalSubscriptionId: subscription.paypalSubscriptionId,
        autoRenew: subscription.autoRenew,
      });
      if (periodMsg) {
        paypal.messages.push(periodMsg);
      }
    }
  } else if (periodChanged) {
    paypal = {
      attempted: false,
      ok: true,
      messages: [
        'No PayPal subscription linked; billing period updated in the database only.',
      ],
    };
  }

  return {
    subscription,
    paypal,
    paymentPeriodEndUpdated,
    periodEndChanged: periodChanged,
  };
}
