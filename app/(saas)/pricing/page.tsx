import { Prisma } from '@prisma/client';

import { PricingPageView } from '@/components/saas/pricing-page-view';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/app-session';
import { getRestaurantForUser } from '@/lib/restaurant-owner';
import { isSubscriptionPeriodActive } from '@/lib/subscription-access';
import { processSubscriptionLifecycle } from '@/lib/subscription-lifecycle';
import { finalPrice } from '@/lib/subscription-catalog-pricing';

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
    yearlyPrice: number;
    priceLabel: string;
    description: string;
    features: string[];
    monthlyDiscountEnabled: boolean;
    monthlyDiscountPercent: number;
    yearlyDiscountEnabled: boolean;
    yearlyDiscountPercent: number;
    monthlyFinal: number;
    yearlyFinal: number;
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
        monthlyDiscountEnabled: boolean;
        monthlyDiscountPercent: number;
        yearlyPrice: number;
        yearlyDiscountEnabled: boolean;
        yearlyDiscountPercent: number;
      }>
    >(Prisma.sql`
      SELECT
        "plan"::text AS "plan",
        "name",
        "price",
        "priceLabel",
        "description",
        "features",
        COALESCE("monthlyDiscountEnabled", false) AS "monthlyDiscountEnabled",
        COALESCE("monthlyDiscountPercent", 0) AS "monthlyDiscountPercent",
        COALESCE("yearlyPrice", 0) AS "yearlyPrice",
        COALESCE("yearlyDiscountEnabled", false) AS "yearlyDiscountEnabled",
        COALESCE("yearlyDiscountPercent", 0) AS "yearlyDiscountPercent"
      FROM "SubscriptionCatalog"
      ORDER BY CASE "plan"
        WHEN 'FREE' THEN 1
        WHEN 'BASIC' THEN 2
        WHEN 'GROWTH' THEN 3
        WHEN 'SCALE' THEN 4
        WHEN 'PRO' THEN 5
        WHEN 'CUSTOM' THEN 6
        ELSE 99
      END
    `);
    if (rows.length > 0) {
      plans = rows.map((r) => {
        const price = Number(r.price) || 0;
        const yearlyPrice = Number(r.yearlyPrice) || 0;
        return {
          plan: r.plan,
          name: r.name,
          price,
          yearlyPrice,
          priceLabel: r.priceLabel,
          description: r.description,
          features: r.features ?? [],
          monthlyDiscountEnabled: Boolean(r.monthlyDiscountEnabled),
          monthlyDiscountPercent: Number(r.monthlyDiscountPercent) || 0,
          yearlyDiscountEnabled: Boolean(r.yearlyDiscountEnabled),
          yearlyDiscountPercent: Number(r.yearlyDiscountPercent) || 0,
          monthlyFinal: finalPrice(
            price,
            Boolean(r.monthlyDiscountEnabled),
            Number(r.monthlyDiscountPercent) || 0
          ),
          yearlyFinal: finalPrice(
            yearlyPrice,
            Boolean(r.yearlyDiscountEnabled),
            Number(r.yearlyDiscountPercent) || 0
          ),
        };
      });
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
