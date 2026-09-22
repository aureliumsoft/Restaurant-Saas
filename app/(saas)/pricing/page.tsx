import { Prisma } from '@prisma/client';

import { PricingPageView } from '@/components/saas/pricing-page-view';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/app-session';
import { getRestaurantForUser } from '@/lib/restaurant-owner';
import { isSubscriptionPeriodActive } from '@/lib/subscription-access';
import { processSubscriptionLifecycle } from '@/lib/subscription-lifecycle';

function formatPeriodEnd(iso: Date | null): string {
  if (!iso) return '';
  return iso.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function PricingPage() {
  const session = await getAppSession();
  const isLoggedIn = Boolean(session?.user?.email);

  let currentPlanSlug: string | null = null;
  let subscriptionPeriodActive = false;
  let periodEndLabel: string | null = null;

  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (user) {
      const restaurant = await getRestaurantForUser(user.id);
      if (restaurant) {
        await processSubscriptionLifecycle(restaurant.id);
        const sub = await db.restaurantSubscription.findUnique({
          where: { restaurantId: restaurant.id },
          select: {
            plan: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        });
        if (sub?.plan) {
          currentPlanSlug = sub.plan;
          subscriptionPeriodActive = isSubscriptionPeriodActive(sub);
          const end =
            sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd;
          periodEndLabel = formatPeriodEnd(end);
        }
      }
    }
  }

  let plans: Array<{
    plan: string;
    name: string;
    price: number;
    priceLabel: string;
    description: string;
    features: string[];
  }> = [];
  try {
    const rows = await db.$queryRaw<
      Array<{
        plan: string;
        name: string;
        price: number;
        priceLabel: string;
        description: string;
        features: string[] | null;
      }>
    >(Prisma.sql`
      SELECT "plan"::text AS "plan", "name", "price", "priceLabel", "description", "features"
      FROM "SubscriptionCatalog"
      ORDER BY CASE "plan"
        WHEN 'STARTER' THEN 1
        WHEN 'GROWTH' THEN 2
        WHEN 'SCALE' THEN 3
        ELSE 99
      END
    `);
    if (rows.length > 0) {
      plans = rows.map((r) => ({
        plan: r.plan,
        name: r.name,
        price: Number(r.price) || 0,
        priceLabel: r.priceLabel,
        description: r.description,
        features: r.features ?? [],
      }));
    }
  } catch {
    plans = [];
  }

  return (
    <PricingPageView
      isLoggedIn={isLoggedIn}
      currentPlanSlug={currentPlanSlug}
      subscriptionPeriodActive={subscriptionPeriodActive}
      periodEndLabel={periodEndLabel}
      plans={plans}
    />
  );
}
