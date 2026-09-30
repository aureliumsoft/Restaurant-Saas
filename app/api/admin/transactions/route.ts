import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';
import {
  buildPaginationMeta,
  clampPage,
  parsePaginationParams,
} from '@/lib/pagination';

/**
 * Platform SaaS billing transactions: subscription payments (and related notes).
 * Restaurant register/order history is not included here.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')?.trim() || null;
  const { page, pageSize } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const where: Prisma.SubscriptionPaymentWhereInput = {
    ...(restaurantId ? { restaurantId } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { currency: { contains: q, mode: 'insensitive' } },
            {
              restaurant: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { subdomain: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const total = await db.subscriptionPayment.count({ where });
  const safePage = clampPage(page, total, pageSize);
  const rows = await db.subscriptionPayment.findMany({
    where,
    orderBy: { paidAt: 'desc' },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      amount: true,
      currency: true,
      paidAt: true,
      periodStart: true,
      periodEnd: true,
      notes: true,
      restaurantId: true,
      restaurant: {
        select: { id: true, name: true, subdomain: true },
      },
      subscription: {
        select: { id: true, plan: true, status: true },
      },
    },
  });

  const data = rows.map((r) => ({
    id: r.id,
    kind: 'SUBSCRIPTION' as const,
    amount: r.amount,
    currency: r.currency,
    paidAt: r.paidAt.toISOString(),
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    notes: r.notes,
    restaurantId: r.restaurantId,
    restaurantName: r.restaurant?.name ?? '—',
    restaurantSubdomain: r.restaurant?.subdomain ?? null,
    plan: r.subscription?.plan ?? null,
    subscriptionStatus: r.subscription?.status ?? null,
  }));

  return NextResponse.json({
    data,
    meta: buildPaginationMeta(safePage, pageSize, total),
  });
}
