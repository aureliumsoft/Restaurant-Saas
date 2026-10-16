import { redirect } from 'next/navigation';
import { SubscriptionPlan } from '@prisma/client';

import { PaymentCheckoutClient } from '@/components/saas/payment-checkout-client';
import { getAppSession } from '@/lib/auth/app-session';
import { db } from '@/lib/db';
import { getPayPalConfigError, isPayPalConfigured } from '@/lib/paypal-server';
import {
  getCustomBaseModuleIds,
  PRICING_MODULE_ROWS,
} from '@/lib/pricing-comparison';
import { getRestaurantForUser } from '@/lib/restaurant-owner';
import {
  bilingualPlanPriceLabel,
  parseBillingInterval,
  resolveCatalogFinalAmount,
} from '@/lib/subscription-catalog-pricing';

type PaymentPageProps = {
  searchParams?: Promise<{
    plan?: string;
    modules?: string;
    interval?: string;
  }>;
};

function parseModulesParam(raw: string | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const allowed = new Set(PRICING_MODULE_ROWS.map((r) => r.id));
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((id) => allowed.has(id))
    ),
  ];
}

export default async function PaymentPage({ searchParams }: PaymentPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const planRaw =
    typeof params?.plan === 'string' ? params.plan.toUpperCase().trim() : 'FREE';
  const interval = parseBillingInterval(params?.interval);

  const planValues = Object.values(SubscriptionPlan) as string[];
  const plan = planValues.includes(planRaw)
    ? (planRaw as SubscriptionPlan)
    : null;
  if (!plan) redirect('/pricing');

  const catalog = await db.subscriptionCatalog.findUnique({
    where: { plan },
  });
  if (!catalog) redirect('/pricing');

  const session = await getAppSession();
  const userEmail =
    typeof session?.user?.email === 'string' && session.user.email.trim() !== ''
      ? session.user.email.trim()
      : null;

  let restaurantId: string | null = null;
  if (userEmail) {
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });
    if (user) {
      const restaurant = await getRestaurantForUser(user.id);
      if (restaurant) restaurantId = restaurant.id;
    }
  }

  const finalAmount = resolveCatalogFinalAmount({
    interval,
    price: catalog.price,
    yearlyPrice: catalog.yearlyPrice,
    monthlyDiscountEnabled: catalog.monthlyDiscountEnabled,
    monthlyDiscountPercent: catalog.monthlyDiscountPercent,
    yearlyDiscountEnabled: catalog.yearlyDiscountEnabled,
    yearlyDiscountPercent: catalog.yearlyDiscountPercent,
  });

  const isQuote =
    plan === SubscriptionPlan.FREE || plan === SubscriptionPlan.CUSTOM;
  const priceMajor =
    Number.isFinite(finalAmount) && finalAmount > 0 ? finalAmount : null;
  const priceLabel = isQuote
    ? catalog.priceLabel
    : bilingualPlanPriceLabel(finalAmount, interval);

  const isCustom = plan === SubscriptionPlan.CUSTOM;
  let selectedModules: string[] = [];
  if (isCustom) {
    const fromQuery = parseModulesParam(params?.modules);
    const base = getCustomBaseModuleIds();
    const limitedIds = PRICING_MODULE_ROWS.filter(
      (r) => r.byPlan.CUSTOM === 'limited'
    ).map((r) => r.id);
    selectedModules =
      fromQuery.length > 0
        ? [...new Set([...base, ...limitedIds, ...fromQuery])]
        : [...new Set([...base, ...limitedIds])];
  }

  return (
    <PaymentCheckoutClient
      plan={plan}
      planName={catalog.name}
      priceLabel={priceLabel}
      priceMajor={priceMajor}
      billingInterval={interval}
      description={catalog.description}
      features={catalog.features ?? []}
      selectedModules={selectedModules}
      stripeReady={isPayPalConfigured()}
      stripeConfigError={getPayPalConfigError()}
      signedIn={Boolean(userEmail)}
      userEmail={userEmail}
      restaurantId={restaurantId}
    />
  );
}
