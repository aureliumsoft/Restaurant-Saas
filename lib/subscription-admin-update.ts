import type { RestaurantSubscription, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

import { db } from '@/lib/db';
import { syncPlanQuotaLocks } from '@/lib/entitlements/sync-plan-quota-locks';
import {
  syncPayPalSubscriptionFromAdmin,
  type PayPalAdminSyncResult,
} from '@/lib/paypal-subscriptions';
import { syncPayPalAfterAdminPeriodChange } from '@/lib/subscription-lifecycle';
import {
  getPayPalBillingTimezone,
  getSubscriptionAdminTimezone,
  mirrorWallClockToTimezone,
} from '@/lib/subscription-timezone';

export type AdminSubscriptionPatch = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  notes?: string | null;
  /** Pricing comparison module ids; only applied for CUSTOM plan. */
  customSelectedModules?: string[];
};

export type AdminSubscriptionUpdateResult = {
  subscription: RestaurantSubscription;
  paypal: PayPalAdminSyncResult;
  paymentPeriodEndUpdated: boolean;
  periodEndChanged: boolean;
  adminTimezone: string;
  paypalBillingTimezone: string;
  paypalPeriodEndAt: string | null;
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

  const customSelectedModules =
    patch.plan === 'CUSTOM'
      ? (patch.customSelectedModules ?? existing?.customSelectedModules ?? [])
      : [];

  const planChanged =
    existing?.plan !== patch.plan ||
    (patch.plan === 'CUSTOM' &&
      JSON.stringify([...(patch.customSelectedModules ?? [])].sort()) !==
        JSON.stringify([...(existing?.customSelectedModules ?? [])].sort()));

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
      customSelectedModules,
    },
    update: {
      plan: patch.plan,
      status: patch.status,
      trialEndsAt,
      currentPeriodEnd,
      notes: patch.notes === undefined ? undefined : patch.notes,
      customSelectedModules,
      ...(periodChanged
        ? { adminPeriodEndAt: currentPeriodEnd }
        : patch.currentPeriodEnd === null
          ? { adminPeriodEndAt: null }
          : {}),
    },
  });

  if (planChanged || !existing) {
    await syncPlanQuotaLocks(restaurantId);
  }

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
    adminTimezone: getSubscriptionAdminTimezone(),
    paypalBillingTimezone: getPayPalBillingTimezone(),
    paypalPeriodEndAt: currentPeriodEnd
      ? mirrorWallClockToTimezone(
          currentPeriodEnd,
          getSubscriptionAdminTimezone(),
          getPayPalBillingTimezone()
        ).toISOString()
      : null,
  };
}
