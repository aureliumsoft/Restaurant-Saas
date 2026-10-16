import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SubscriptionPlan } from '@prisma/client';

import { db } from '@/lib/db';
import { ensurePayPalPlanForCatalog } from '@/lib/paypal-subscriptions';
import {
  getPayPalConfigError,
  getPayPalPlatformConfig,
  isPayPalConfigured,
} from '@/lib/paypal-server';
import {
  bilingualPlanPriceLabel,
  parseBillingInterval,
  resolveCatalogFinalAmount,
} from '@/lib/subscription-catalog-pricing';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: getPayPalConfigError() ?? 'PayPal is not configured' },
      { status: 503 }
    );
  }

  const planRaw = req.nextUrl.searchParams.get('plan')?.toUpperCase().trim();
  const interval = parseBillingInterval(
    req.nextUrl.searchParams.get('interval')
  );
  const planValues = Object.values(SubscriptionPlan) as string[];
  if (!planRaw || !planValues.includes(planRaw)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }
  const plan = planRaw as SubscriptionPlan;

  const catalog = await db.subscriptionCatalog.findUnique({ where: { plan } });
  if (!catalog) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 404 });
  }

  const amount = resolveCatalogFinalAmount({
    interval,
    price: catalog.price,
    yearlyPrice: catalog.yearlyPrice,
    monthlyDiscountEnabled: catalog.monthlyDiscountEnabled,
    monthlyDiscountPercent: catalog.monthlyDiscountPercent,
    yearlyDiscountEnabled: catalog.yearlyDiscountEnabled,
    yearlyDiscountPercent: catalog.yearlyDiscountPercent,
  });

  try {
    const { planId } = await ensurePayPalPlanForCatalog(plan, interval);
    const config = getPayPalPlatformConfig();
    return NextResponse.json({
      clientId: config.clientId,
      planId,
      currency: config.currency,
      mode: config.mode,
      planName: catalog.name,
      priceLabel: bilingualPlanPriceLabel(amount, interval),
      amount,
      interval,
    });
  } catch (e) {
    console.error('PayPal subscription-config failed:', e);
    return NextResponse.json(
      { error: 'Could not prepare subscription plan' },
      { status: 502 }
    );
  }
}
