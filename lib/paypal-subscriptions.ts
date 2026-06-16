import type { RestaurantSubscription, SubscriptionPlan } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';

import { db } from '@/lib/db';
import { isPayPalNetworkError } from '@/lib/paypal-network';
import {
  hasActiveAdminPeriodLock,
  resolveRenewalPeriodEnd,
  shouldApplyPayPalPeriodOnRefresh,
  isPeriodExpired,
} from '@/lib/subscription-period';
import { applySubscriptionRenewal } from '@/lib/subscription-renewal';
import {
  getPayPalAccessToken,
  getPayPalPlatformConfig,
  isPayPalConfigured,
} from '@/lib/paypal-server';

export type PayPalSubscriptionDetails = {
  id: string;
  status: string;
  planId: string | null;
  subscriberEmail: string | null;
  nextBillingTime: Date | null;
  startTime: Date | null;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function getPayPalPlanStatus(
  planId: string,
  token: string,
  baseUrl: string
): Promise<string> {
  const res = await fetch(
    `${baseUrl}/v1/billing/plans/${encodeURIComponent(planId)}`,
    { headers: authHeaders(token), cache: 'no-store' }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `PayPal plan fetch failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
  const json = (await res.json()) as { status?: string };
  return String(json.status ?? '').toUpperCase();
}

/** Activate only when PayPal reports CREATED or INACTIVE; ignore if already ACTIVE. */
async function ensurePayPalPlanActive(
  planId: string,
  token: string,
  baseUrl: string,
  statusFromCreate?: string
): Promise<void> {
  const normalized = String(statusFromCreate ?? '').toUpperCase();
  if (normalized === 'ACTIVE') return;

  let status = normalized;
  if (!status) {
    status = await getPayPalPlanStatus(planId, token, baseUrl);
  }
  if (status === 'ACTIVE') return;
  if (status !== 'CREATED' && status !== 'INACTIVE') {
    throw new Error(`PayPal plan ${planId} is not activatable (status: ${status})`);
  }

  const activateRes = await fetch(
    `${baseUrl}/v1/billing/plans/${encodeURIComponent(planId)}/activate`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: '{}',
      cache: 'no-store',
    }
  );

  if (activateRes.ok) return;

  const text = await activateRes.text().catch(() => '');
  if (activateRes.status === 422 && text.includes('PLAN_STATUS_INVALID')) {
    const live = await getPayPalPlanStatus(planId, token, baseUrl);
    if (live === 'ACTIVE') return;
  }

  throw new Error(
    `PayPal plan activate failed (${activateRes.status}): ${text.slice(0, 500)}`
  );
}

/** Ensures a PayPal product + monthly plan exist for the catalog row; caches ids on SubscriptionCatalog. */
export async function ensurePayPalPlanForCatalog(
  plan: SubscriptionPlan
): Promise<{ planId: string; productId: string }> {
  if (!isPayPalConfigured()) {
    throw new Error('PayPal is not configured');
  }

  const catalog = await db.subscriptionCatalog.findUnique({ where: { plan } });
  if (!catalog) throw new Error(`Unknown subscription plan: ${plan}`);

  if (catalog.paypalPlanId && catalog.paypalProductId) {
    const config = getPayPalPlatformConfig();
    const token = await getPayPalAccessToken();
    try {
      await ensurePayPalPlanActive(
        catalog.paypalPlanId,
        token,
        config.baseUrl
      );
    } catch (e) {
      console.warn('PayPal plan status check failed:', e);
    }
    return { planId: catalog.paypalPlanId, productId: catalog.paypalProductId };
  }

  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();
  const currency = config.currency;
  const priceValue = Number(catalog.price).toFixed(2);

  let productId = catalog.paypalProductId;
  if (!productId) {
    const productRes = await fetch(`${config.baseUrl}/v1/catalogs/products`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: `${catalog.name} (${plan})`,
        description: catalog.description.slice(0, 256),
        type: 'SERVICE',
        category: 'SOFTWARE',
      }),
      cache: 'no-store',
    });
    if (!productRes.ok) {
      const text = await productRes.text().catch(() => '');
      throw new Error(
        `PayPal product create failed (${productRes.status}): ${text.slice(0, 500)}`
      );
    }
    const productJson = (await productRes.json()) as { id?: string };
    if (!productJson.id) throw new Error('PayPal product id missing');
    productId = productJson.id;
  }

  const planRes = await fetch(`${config.baseUrl}/v1/billing/plans`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      product_id: productId,
      name: `${catalog.name} Monthly`,
      description: catalog.description.slice(0, 128),
      billing_cycles: [
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: priceValue, currency_code: currency },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
    cache: 'no-store',
  });

  if (!planRes.ok) {
    const text = await planRes.text().catch(() => '');
    throw new Error(
      `PayPal plan create failed (${planRes.status}): ${text.slice(0, 500)}`
    );
  }

  const planJson = (await planRes.json()) as { id?: string; status?: string };
  if (!planJson.id) throw new Error('PayPal plan id missing');

  await ensurePayPalPlanActive(
    planJson.id,
    token,
    config.baseUrl,
    planJson.status
  );

  await db.subscriptionCatalog.update({
    where: { plan },
    data: {
      paypalProductId: productId,
      paypalPlanId: planJson.id,
    },
  });

  return { planId: planJson.id, productId };
}

export async function getPayPalSubscriptionDetails(
  subscriptionId: string
): Promise<PayPalSubscriptionDetails> {
  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `${config.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: authHeaders(token), cache: 'no-store' }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `PayPal subscription fetch failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json()) as {
    id?: string;
    status?: string;
    plan_id?: string;
    start_time?: string;
    billing_info?: {
      next_billing_time?: string;
    };
    subscriber?: {
      email_address?: string;
    };
  };

  return {
    id: json.id ?? subscriptionId,
    status: String(json.status ?? '').toUpperCase(),
    planId: json.plan_id ?? null,
    subscriberEmail: json.subscriber?.email_address ?? null,
    nextBillingTime: json.billing_info?.next_billing_time
      ? new Date(json.billing_info.next_billing_time)
      : null,
    startTime: json.start_time ? new Date(json.start_time) : null,
  };
}

function mapPayPalStatusToDb(status: string): SubscriptionStatus {
  switch (status) {
    case 'ACTIVE':
      return SubscriptionStatus.ACTIVE;
    case 'SUSPENDED':
    case 'EXPIRED':
      return SubscriptionStatus.PAST_DUE;
    case 'CANCELLED':
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.ACTIVE;
  }
}

async function resolvePlanFromCatalog(
  planId: string | null,
  fallback: SubscriptionPlan
): Promise<SubscriptionPlan> {
  if (!planId) return fallback;
  const row = await db.subscriptionCatalog.findFirst({
    where: { paypalPlanId: planId },
    select: { plan: true },
  });
  return row?.plan ?? fallback;
}

/** Sync PayPal subscription state into RestaurantSubscription + optional payment row. */
export async function syncRestaurantSubscriptionFromPayPal(opts: {
  restaurantId: string;
  paypalSubscriptionId: string;
  plan: SubscriptionPlan;
  recordPayment?: {
    amount: number;
    currency: string;
    idempotencyKey: string;
  };
  /** When true, always apply PayPal next billing (e.g. after a successful payment). */
  forcePeriodFromPayPal?: boolean;
}) {
  const details = await getPayPalSubscriptionDetails(opts.paypalSubscriptionId);
  const plan = await resolvePlanFromCatalog(details.planId, opts.plan);
  const status = mapPayPalStatusToDb(details.status);
  const existing = await db.restaurantSubscription.findUnique({
    where: { restaurantId: opts.restaurantId },
    select: {
      autoRenew: true,
      currentPeriodEnd: true,
      adminPeriodEndAt: true,
    },
  });

  let periodEnd =
    details.nextBillingTime ??
    resolveRenewalPeriodEnd(null, existing?.currentPeriodEnd ?? null);

  if (opts.forcePeriodFromPayPal) {
    periodEnd = resolveRenewalPeriodEnd(
      details.nextBillingTime,
      existing?.currentPeriodEnd ?? null
    );
  }

  const applyPayPalPeriod =
    !opts.forcePeriodFromPayPal &&
    existing?.autoRenew !== false &&
    !hasActiveAdminPeriodLock(existing) &&
    !existing?.currentPeriodEnd;

  const periodPatch =
    opts.forcePeriodFromPayPal || applyPayPalPeriod
      ? {
          currentPeriodEnd: periodEnd,
          ...(opts.forcePeriodFromPayPal ? { adminPeriodEndAt: null } : {}),
        }
      : {};

  await db.$transaction(async (tx) => {
    const sub = await tx.restaurantSubscription.upsert({
      where: { restaurantId: opts.restaurantId },
      create: {
        restaurantId: opts.restaurantId,
        plan,
        status,
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
        paypalSubscriptionId: opts.paypalSubscriptionId,
        paypalPlanId: details.planId,
        autoRenew: true,
        adminPeriodEndAt: null,
      },
      update: {
        plan,
        status,
        trialEndsAt: null,
        ...periodPatch,
        paypalSubscriptionId: opts.paypalSubscriptionId,
        paypalPlanId: details.planId ?? undefined,
      },
      select: { id: true },
    });

    if (opts.recordPayment) {
      const existing = await tx.subscriptionPayment.findFirst({
        where: {
          restaurantId: opts.restaurantId,
          notes: opts.recordPayment.idempotencyKey,
        },
        select: { id: true },
      });
      if (!existing) {
        const periodStart = new Date();
        await tx.subscriptionPayment.create({
          data: {
            restaurantId: opts.restaurantId,
            restaurantSubscriptionId: sub.id,
            amount: opts.recordPayment.amount,
            currency: opts.recordPayment.currency,
            paidAt: periodStart,
            periodStart,
            periodEnd,
            notes: opts.recordPayment.idempotencyKey,
          },
        });
      }
    }
  });

  return details;
}

export async function revisePayPalSubscriptionPlan(opts: {
  subscriptionId: string;
  planId: string;
}): Promise<{ approvalRequired: boolean; approvalUrl: string | null }> {
  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();
  const res = await fetch(
    `${config.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(opts.subscriptionId)}/revise`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ plan_id: opts.planId }),
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `PayPal subscription revise failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
  const json = (await res.json()) as {
    links?: Array<{ rel?: string; href?: string }>;
  };
  const approvalUrl =
    json.links?.find((l) => l.rel === 'approve')?.href ?? null;
  return { approvalRequired: Boolean(approvalUrl), approvalUrl };
}

export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason = 'Canceled by platform administrator'
): Promise<void> {
  try {
    const details = await getPayPalSubscriptionDetails(subscriptionId);
    if (details.status !== 'ACTIVE' && details.status !== 'SUSPENDED') {
      return;
    }
  } catch (e) {
    console.warn('PayPal status check before cancel failed:', e);
  }

  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();
  const res = await fetch(
    `${config.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 422 && text.includes('SUBSCRIPTION_STATUS_INVALID')) {
      return;
    }
    throw new Error(
      `PayPal subscription cancel failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
}

export async function activatePayPalSubscription(
  subscriptionId: string,
  reason = 'Reactivated by platform administrator'
): Promise<void> {
  try {
    const details = await getPayPalSubscriptionDetails(subscriptionId);
    if (details.status === 'ACTIVE') return;
  } catch (e) {
    console.warn('PayPal status check before activate failed:', e);
  }

  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();
  const res = await fetch(
    `${config.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/activate`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 422 && text.includes('SUBSCRIPTION_STATUS_INVALID')) {
      return;
    }
    throw new Error(
      `PayPal subscription activate failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
}

export type PayPalAdminSyncResult = {
  attempted: boolean;
  ok: boolean;
  messages: string[];
  planRevised?: boolean;
  statusAction?: 'canceled' | 'activated' | 'none';
};

/** Best-effort PayPal sync after admin edits plan/status. Billing date stays in our DB. */
export async function syncPayPalSubscriptionFromAdmin(opts: {
  paypalSubscriptionId: string;
  previousPlan: SubscriptionPlan;
  nextPlan: SubscriptionPlan;
  previousStatus: SubscriptionStatus;
  nextStatus: SubscriptionStatus;
}): Promise<PayPalAdminSyncResult> {
  if (!isPayPalConfigured()) {
    return {
      attempted: false,
      ok: true,
      messages: ['PayPal is not configured; database updated only.'],
    };
  }

  const messages: string[] = [];
  let planRevised = false;
  let statusAction: PayPalAdminSyncResult['statusAction'] = 'none';

  try {
    if (opts.nextPlan !== opts.previousPlan) {
      const { planId } = await ensurePayPalPlanForCatalog(opts.nextPlan);
      const revised = await revisePayPalSubscriptionPlan({
        subscriptionId: opts.paypalSubscriptionId,
        planId,
      });
      planRevised = true;
      if (revised.approvalRequired) {
        messages.push(
          'PayPal plan change submitted; the restaurant owner may need to re-approve in PayPal.'
        );
      } else {
        messages.push('PayPal subscription plan updated.');
      }
    }

    if (
      opts.nextStatus === SubscriptionStatus.CANCELED &&
      opts.previousStatus !== SubscriptionStatus.CANCELED
    ) {
      await cancelPayPalSubscription(opts.paypalSubscriptionId);
      statusAction = 'canceled';
      messages.push('PayPal subscription canceled.');
    } else if (
      opts.nextStatus === SubscriptionStatus.ACTIVE &&
      (opts.previousStatus === SubscriptionStatus.PAST_DUE ||
        opts.previousStatus === SubscriptionStatus.CANCELED)
    ) {
      try {
        await activatePayPalSubscription(opts.paypalSubscriptionId);
        statusAction = 'activated';
        messages.push('PayPal subscription reactivated.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('SUBSCRIPTION_STATUS_INVALID')) {
          throw e;
        }
        messages.push('PayPal subscription already active.');
      }
    }

    messages.push(
      'Billing period end is stored in the platform database; PayPal renews automatically when auto-renew is on.'
    );

    return {
      attempted: true,
      ok: true,
      messages,
      planRevised,
      statusAction,
    };
  } catch (e) {
    messages.push(e instanceof Error ? e.message : 'PayPal sync failed.');
    return { attempted: true, ok: false, messages, planRevised, statusAction };
  }
}

export async function handleSubscriptionPaymentSale(opts: {
  subscriptionId: string;
  saleId: string;
  amount: number;
  currency: string;
}) {
  const sub = await db.restaurantSubscription.findFirst({
    where: { paypalSubscriptionId: opts.subscriptionId },
    select: {
      restaurantId: true,
      plan: true,
      id: true,
      currentPeriodEnd: true,
    },
  });
  if (!sub) return;

  await applySubscriptionRenewal({
    restaurantId: sub.restaurantId,
    restaurantSubscriptionId: sub.id,
    amount: opts.amount,
    currency: opts.currency,
    idempotencyKey: `paypal_sale:${opts.saleId}`,
    previousPeriodEnd: sub.currentPeriodEnd,
  });
}

export type PayPalSubscriptionTransaction = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  time: Date;
};

export async function listPayPalSubscriptionTransactions(
  subscriptionId: string,
  startTime: Date
): Promise<PayPalSubscriptionTransaction[]> {
  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();
  const endTime = new Date();
  const params = new URLSearchParams({
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
  });

  const res = await fetch(
    `${config.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/transactions?${params}`,
    { headers: authHeaders(token), cache: 'no-store' }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `PayPal subscription transactions failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json()) as {
    transactions?: Array<{
      id?: string;
      status?: string;
      time?: string;
      amount_with_breakdown?: {
        gross_amount?: { currency_code?: string; value?: string };
      };
    }>;
  };

  return (json.transactions ?? [])
    .filter((t) => t.id)
    .map((t) => ({
      id: t.id!,
      status: String(t.status ?? '').toUpperCase(),
      amount: Number(t.amount_with_breakdown?.gross_amount?.value ?? 0) || 0,
      currency: String(
        t.amount_with_breakdown?.gross_amount?.currency_code ?? 'EUR'
      ).toUpperCase(),
      time: t.time ? new Date(t.time) : new Date(),
    }));
}

/** Charge outstanding subscription balance (saved PayPal payment method). */
export async function capturePayPalSubscriptionOutstanding(opts: {
  subscriptionId: string;
  amount: string;
  currency: string;
}): Promise<boolean> {
  const config = getPayPalPlatformConfig();
  const token = await getPayPalAccessToken();
  const res = await fetch(
    `${config.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(opts.subscriptionId)}/capture`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        note: 'Foodluk subscription auto-renewal',
        capture_type: 'OUTSTANDING_BALANCE',
        amount: {
          currency_code: opts.currency,
          value: opts.amount,
        },
      }),
      cache: 'no-store',
    }
  );
  if (res.ok) return true;
  const text = await res.text().catch(() => '');
  if (res.status === 422 && text.includes('SUBSCRIPTION_STATUS_INVALID')) {
    return false;
  }
  throw new Error(
    `PayPal subscription capture failed (${res.status}): ${text.slice(0, 500)}`
  );
}

/**
 * When period ended and auto-renew is on: find completed PayPal payments,
 * capture outstanding balance, then extend access by 30 days and set ACTIVE.
 */
export async function attemptSubscriptionAutoRenewal(
  restaurantId: string
): Promise<RestaurantSubscription | null> {
  const sub = await db.restaurantSubscription.findUnique({
    where: { restaurantId },
  });
  if (!sub?.autoRenew || !sub.paypalSubscriptionId) return sub;

  const catalog = await db.subscriptionCatalog.findUnique({
    where: { plan: sub.plan },
  });
  if (!catalog) return sub;

  const config = getPayPalPlatformConfig();
  const currency = config.currency.toUpperCase();
  const amountMajor = Number(catalog.price);
  const amountValue = amountMajor.toFixed(2);

  const periodExpired = isPeriodExpired(sub.currentPeriodEnd);
  const needsRenewal =
    periodExpired || sub.status === SubscriptionStatus.PAST_DUE;
  if (!needsRenewal) return sub;

  try {
    const searchFrom =
      sub.currentPeriodEnd ??
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const transactions = await listPayPalSubscriptionTransactions(
      sub.paypalSubscriptionId,
      new Date(searchFrom.getTime() - 24 * 60 * 60 * 1000)
    );

    for (const txn of transactions) {
      if (txn.status !== 'COMPLETED') continue;
      if (txn.time.getTime() < searchFrom.getTime() - 60_000) continue;

      const idempotencyKey = `paypal_sub_txn:${txn.id}`;
      const existing = await db.subscriptionPayment.findFirst({
        where: { restaurantId, notes: idempotencyKey },
        select: { id: true },
      });
      if (existing) continue;

      return applySubscriptionRenewal({
        restaurantId,
        restaurantSubscriptionId: sub.id,
        amount: txn.amount > 0 ? txn.amount : amountMajor,
        currency: txn.currency || currency,
        idempotencyKey,
        previousPeriodEnd: sub.currentPeriodEnd,
      });
    }

    let details = await getPayPalSubscriptionDetails(sub.paypalSubscriptionId);

    if (details.status === 'CANCELLED' || details.status === 'EXPIRED') {
      try {
        await activatePayPalSubscription(
          sub.paypalSubscriptionId,
          'Auto-renew reactivation'
        );
        details = await getPayPalSubscriptionDetails(sub.paypalSubscriptionId);
      } catch {
        return sub;
      }
    }

    if (
      details.nextBillingTime &&
      shouldApplyPayPalPeriodOnRefresh(sub, details.nextBillingTime)
    ) {
      return applySubscriptionRenewal({
        restaurantId,
        restaurantSubscriptionId: sub.id,
        amount: amountMajor,
        currency,
        idempotencyKey: `paypal_next_billing:${details.nextBillingTime.toISOString()}`,
        previousPeriodEnd: sub.currentPeriodEnd,
        paypalNextBilling: details.nextBillingTime,
      });
    }

    if (
      details.status === 'ACTIVE' ||
      details.status === 'SUSPENDED'
    ) {
      const captured = await capturePayPalSubscriptionOutstanding({
        subscriptionId: sub.paypalSubscriptionId,
        amount: amountValue,
        currency,
      });

      if (captured) {
        const afterCapture = await listPayPalSubscriptionTransactions(
          sub.paypalSubscriptionId,
          searchFrom
        ).catch(() => [] as PayPalSubscriptionTransaction[]);

        const freshTxn = afterCapture.find((t) => t.status === 'COMPLETED');
        const idempotencyKey = freshTxn
          ? `paypal_sub_txn:${freshTxn.id}`
          : `paypal_capture_renew:${sub.paypalSubscriptionId}:${Date.now()}`;

        return applySubscriptionRenewal({
          restaurantId,
          restaurantSubscriptionId: sub.id,
          amount: freshTxn?.amount && freshTxn.amount > 0 ? freshTxn.amount : amountMajor,
          currency: freshTxn?.currency || currency,
          idempotencyKey,
          previousPeriodEnd: sub.currentPeriodEnd,
        });
      }
    }
  } catch (e) {
    if (!isPayPalNetworkError(e)) {
      console.warn('Subscription auto-renewal failed:', e);
    }
  }

  return sub;
}

/** @deprecated Use attemptSubscriptionAutoRenewal */
export async function tryExtendSubscriptionFromPayPal(
  restaurantId: string
): Promise<RestaurantSubscription | null> {
  return attemptSubscriptionAutoRenewal(restaurantId);
}

export async function handleSubscriptionLifecycleEvent(
  subscriptionId: string,
  eventType: string
) {
  const sub = await db.restaurantSubscription.findFirst({
    where: { paypalSubscriptionId: subscriptionId },
    select: {
      restaurantId: true,
      plan: true,
      autoRenew: true,
      currentPeriodEnd: true,
    },
  });
  if (!sub) return;

  if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
    const periodEnded =
      sub.currentPeriodEnd != null &&
      sub.currentPeriodEnd.getTime() < Date.now();
    if (!sub.autoRenew || periodEnded) {
      await db.restaurantSubscription.update({
        where: { restaurantId: sub.restaurantId },
        data: { status: SubscriptionStatus.CANCELED },
      });
    }
    return;
  }

  if (
    eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' ||
    eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
  ) {
    await db.restaurantSubscription.update({
      where: { restaurantId: sub.restaurantId },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
    return;
  }

  if (
    eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' ||
    eventType === 'BILLING.SUBSCRIPTION.RE-ACTIVATED' ||
    eventType === 'BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED'
  ) {
    const row = await db.restaurantSubscription.findFirst({
      where: { paypalSubscriptionId: subscriptionId },
      select: { restaurantId: true, id: true, currentPeriodEnd: true, plan: true },
    });
    if (!row) return;

    const catalog = await db.subscriptionCatalog.findUnique({
      where: { plan: row.plan },
    });
    const amount = catalog?.price ?? 0;
    const config = getPayPalPlatformConfig();

    await applySubscriptionRenewal({
      restaurantId: row.restaurantId,
      restaurantSubscriptionId: row.id,
      amount: Number(amount) || 0,
      currency: config.currency.toUpperCase(),
      idempotencyKey: `paypal_webhook:${eventType}:${subscriptionId}:${Date.now()}`,
      previousPeriodEnd: row.currentPeriodEnd,
    });
    return;
  }

  await syncRestaurantSubscriptionFromPayPal({
    restaurantId: sub.restaurantId,
    paypalSubscriptionId: subscriptionId,
    plan: sub.plan,
  });
}
