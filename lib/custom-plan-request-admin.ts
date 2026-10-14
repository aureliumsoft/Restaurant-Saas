import {
  CustomPlanRequestStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';

import { db } from '@/lib/db';

export async function resolveRestaurantIdForCustomRequest(opts: {
  restaurantId?: string | null;
  restaurantName: string;
  email: string;
}): Promise<string | null> {
  if (opts.restaurantId) {
    const byId = await db.restaurant.findUnique({
      where: { id: opts.restaurantId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  const name = opts.restaurantName.trim();
  if (name) {
    const byName = await db.restaurant.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { slug: { equals: name.toLowerCase().replace(/\s+/g, '-'), mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (byName) return byName.id;
  }

  const email = opts.email.trim().toLowerCase();
  if (email) {
    const owner = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (owner) {
      const owned = await db.restaurant.findFirst({
        where: { ownerId: owner.id },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (owned) return owned.id;
    }
  }

  return null;
}

export async function applyCustomPlanDecision(opts: {
  requestId: string;
  action: 'accept' | 'reject';
  reviewedByUserId?: string | null;
  restaurantIdOverride?: string | null;
}): Promise<
  | {
      ok: true;
      status: CustomPlanRequestStatus;
      plan: SubscriptionPlan;
      restaurantId: string;
    }
  | { ok: false; error: string; status?: number }
> {
  const request = await db.customPlanRequest.findUnique({
    where: { id: opts.requestId },
  });
  if (!request) {
    return { ok: false, error: 'Request not found', status: 404 };
  }
  if (request.status !== CustomPlanRequestStatus.PENDING) {
    return {
      ok: false,
      error: `Request already ${request.status.toLowerCase()}`,
      status: 409,
    };
  }

  const restaurantId =
    opts.restaurantIdOverride?.trim() ||
    request.restaurantId ||
    (await resolveRestaurantIdForCustomRequest({
      restaurantId: request.restaurantId,
      restaurantName: request.restaurantName,
      email: request.email,
    }));

  if (!restaurantId) {
    return {
      ok: false,
      error:
        'No restaurant linked. Open the request and select a restaurant, or ensure the requester owns a restaurant.',
      status: 400,
    };
  }

  const accept = opts.action === 'accept';
  const plan = accept ? SubscriptionPlan.CUSTOM : SubscriptionPlan.FREE;
  const status = accept
    ? CustomPlanRequestStatus.ACCEPTED
    : CustomPlanRequestStatus.REJECTED;
  const modules = accept ? request.selectedModules : [];
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  await db.$transaction(async (tx) => {
    await tx.restaurantSubscription.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        autoRenew: false,
        customSelectedModules: modules,
        notes: accept
          ? `Custom plan accepted. Modules: ${modules.join(', ') || '—'}`
          : 'Custom plan request rejected — Free plan applied.',
      },
      update: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        customSelectedModules: modules,
        notes: accept
          ? `Custom plan accepted. Modules: ${modules.join(', ') || '—'}`
          : 'Custom plan request rejected — Free plan applied.',
      },
    });

    await tx.customPlanRequest.update({
      where: { id: request.id },
      data: {
        status,
        restaurantId,
        reviewedAt: new Date(),
        reviewedByUserId: opts.reviewedByUserId ?? null,
      },
    });
  });

  return { ok: true, status, plan, restaurantId };
}
