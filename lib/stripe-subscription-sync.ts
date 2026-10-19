import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

import { db } from '@/lib/db';
import { syncPlanQuotaLocks } from '@/lib/entitlements/sync-plan-quota-locks';
import { fromStripeUnitAmount } from '@/lib/stripe-server';
import { getRestaurantForUser } from '@/lib/restaurant-owner';

function parsePlan(raw: string | null | undefined): SubscriptionPlan | null {
  if (!raw) return null;
  const u = raw.toUpperCase().trim();
  return (Object.values(SubscriptionPlan) as string[]).includes(u)
    ? (u as SubscriptionPlan)
    : null;
}

async function resolveRestaurantIdFromSession(session: Stripe.Checkout.Session) {
  const fromMeta =
    typeof session.metadata?.restaurantId === 'string'
      ? session.metadata.restaurantId.trim()
      : '';
  if (fromMeta) return fromMeta;

  const userId =
    typeof session.metadata?.userId === 'string' ? session.metadata.userId.trim() : '';
  if (userId) {
    const restaurant = await getRestaurantForUser(userId);
    if (restaurant) return restaurant.id;
  }

  const email =
    (typeof session.customer_details?.email === 'string' && session.customer_details.email) ||
    (typeof session.customer_email === 'string' && session.customer_email) ||
    '';
  if (email) {
    const user = await db.user.findUnique({
      where: { email: email.trim() },
      select: { id: true },
    });
    if (user) {
      const restaurant = await getRestaurantForUser(user.id);
      if (restaurant) return restaurant.id;
    }
  }

  return null;
}

export async function syncSubscriptionForPaidCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<'updated' | 'skipped'> {
  if (session.payment_status !== 'paid') return 'skipped';

  const restaurantId = await resolveRestaurantIdFromSession(session);
  const plan = parsePlan(session.metadata?.plan);
  if (!restaurantId || !plan) return 'skipped';

  const currency = (session.currency ?? 'eur').toLowerCase();
  const amountMajor = fromStripeUnitAmount(session.amount_total, currency);
  const idempotencyKey = `stripe_session:${session.id}`;

  const existing = await db.subscriptionPayment.findFirst({
    where: { restaurantId, notes: idempotencyKey },
    select: { id: true },
  });
  if (existing) return 'updated';

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 30);

  const previousPlan = (
    await db.restaurantSubscription.findUnique({
      where: { restaurantId },
      select: { plan: true },
    })
  )?.plan;

  await db.$transaction(async (tx) => {
    const sub = await tx.restaurantSubscription.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      },
      select: { id: true },
    });

    await tx.subscriptionPayment.create({
      data: {
        restaurantId,
        restaurantSubscriptionId: sub.id,
        amount: amountMajor,
        currency: currency.toUpperCase(),
        paidAt: periodStart,
        periodStart,
        periodEnd,
        notes: idempotencyKey,
      },
    });
  });

  if (previousPlan !== plan) {
    await syncPlanQuotaLocks(restaurantId);
  }

  return 'updated';
}

