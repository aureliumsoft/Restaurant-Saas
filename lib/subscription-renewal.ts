import type { RestaurantSubscription } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';

import { db } from '@/lib/db';
import {
  addSubscriptionPeriodDays,
  resolveRenewalPeriodEnd,
} from '@/lib/subscription-period';

export async function applySubscriptionRenewal(opts: {
  restaurantId: string;
  restaurantSubscriptionId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  previousPeriodEnd: Date | null;
  paypalNextBilling?: Date | null;
}): Promise<RestaurantSubscription> {
  const periodStart = new Date();
  const periodEnd = resolveRenewalPeriodEnd(
    opts.paypalNextBilling ?? null,
    opts.previousPeriodEnd
  );

  return db.$transaction(async (tx) => {
    const existing = await tx.subscriptionPayment.findFirst({
      where: {
        restaurantId: opts.restaurantId,
        notes: opts.idempotencyKey,
      },
      select: { id: true },
    });

    if (!existing) {
      await tx.subscriptionPayment.create({
        data: {
          restaurantId: opts.restaurantId,
          restaurantSubscriptionId: opts.restaurantSubscriptionId,
          amount: opts.amount,
          currency: opts.currency.toUpperCase(),
          paidAt: periodStart,
          periodStart,
          periodEnd,
          notes: opts.idempotencyKey,
        },
      });
    }

    return tx.restaurantSubscription.update({
      where: { restaurantId: opts.restaurantId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        adminPeriodEndAt: null,
        autoRenew: true,
      },
    });
  });
}

/** Extend period from PayPal next billing without a new payment row. */
export async function extendSubscriptionFromPayPalBilling(
  restaurantId: string,
  nextBilling: Date
): Promise<RestaurantSubscription> {
  return db.restaurantSubscription.update({
    where: { restaurantId },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: nextBilling,
      adminPeriodEndAt: null,
    },
  });
}

export function nextRenewalPeriodEnd(previousEnd: Date | null): Date {
  const base = new Date(
    Math.max(previousEnd?.getTime() ?? Date.now(), Date.now())
  );
  return addSubscriptionPeriodDays(base);
}
