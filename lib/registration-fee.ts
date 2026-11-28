import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

import { db } from '@/lib/db';

/** Apply one-time registration fee unlock for Free plan access. */
export async function markRegistrationFeePaid(opts: {
  restaurantId: string;
  amount: number;
  currency?: string;
  notes?: string;
  recordedByUserId?: string | null;
}) {
  const currency = (opts.currency ?? 'EUR').toUpperCase();
  const paidAt = new Date();

  const notes = opts.notes ?? 'registration_fee';

  const existingPayment = notes.startsWith('registration_fee:paypal:')
    ? await db.subscriptionPayment.findFirst({
        where: { restaurantId: opts.restaurantId, notes },
        select: { id: true },
      })
    : null;

  const subscription = await db.restaurantSubscription.upsert({
    where: { restaurantId: opts.restaurantId },
    create: {
      restaurantId: opts.restaurantId,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      trialEndsAt: null,
      currentPeriodEnd: null,
      registrationFeePaid: true,
      registrationFeePaidAt: paidAt,
      registrationFeeAmount: opts.amount,
      registrationFeeCurrency: currency,
      autoRenew: false,
    },
    update: {
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      trialEndsAt: null,
      currentPeriodEnd: null,
      registrationFeePaid: true,
      registrationFeePaidAt: paidAt,
      registrationFeeAmount: opts.amount,
      registrationFeeCurrency: currency,
      autoRenew: false,
    },
  });

  if (!existingPayment) {
    await db.subscriptionPayment.create({
      data: {
        restaurantId: opts.restaurantId,
        restaurantSubscriptionId: subscription.id,
        amount: opts.amount,
        currency,
        paidAt,
        notes,
        recordedByUserId: opts.recordedByUserId ?? null,
      },
    });
  }

  return subscription;
}

/** Mark registration fee paid when activating a non-Free subscription (no extra charge). */
export async function ensureRegistrationFeeFlagOnPaidPlan(
  restaurantId: string
) {
  const existing = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
    select: { registrationFeePaid: true },
  });
  if (existing?.registrationFeePaid) return;

  await db.restaurantSubscription.update({
    where: { restaurantId },
    data: {
      registrationFeePaid: true,
      registrationFeePaidAt: new Date(),
    },
  });
}
