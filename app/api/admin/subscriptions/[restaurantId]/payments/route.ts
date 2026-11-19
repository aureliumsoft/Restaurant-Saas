import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';
import { parseSubscriptionDateInput } from '@/lib/subscription-timezone';
import { resolveRouteParams } from '@/lib/resolve-route-id';

const postSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().trim().min(2).max(10).optional(),
  paidAt: z.string().max(40).optional(),
  periodStart: z.string().max(40).nullable().optional(),
  periodEnd: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  setStatusActive: z.boolean().optional(),
});

function toDateOrNull(input: string | null | undefined): Date | null {
  const parsed = parseSubscriptionDateInput(input ?? undefined);
  if (parsed === undefined || parsed === null) return null;
  return parsed;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { restaurantId } = await resolveRouteParams(ctx.params, ['restaurantId']);
  try {
    const rows = await db.$queryRaw<
      Array<{
        id: string;
        amount: number;
        currency: string;
        paidAt: Date;
        periodStart: Date | null;
        periodEnd: Date | null;
        notes: string | null;
      }>
    >(Prisma.sql`
      SELECT "id","amount","currency","paidAt","periodStart","periodEnd","notes"
      FROM "SubscriptionPayment"
      WHERE "restaurantId" = ${restaurantId}
      ORDER BY "paidAt" DESC
      LIMIT 20
    `);

    return NextResponse.json(
      {
        data: rows.map((r) => ({
          ...r,
          paidAt: r.paidAt.toISOString(),
          periodStart: r.periodStart?.toISOString() ?? null,
          periodEnd: r.periodEnd?.toISOString() ?? null,
        })),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { restaurantId } = await resolveRouteParams(ctx.params, ['restaurantId']);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, subscription: { select: { id: true } } },
  });
  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  try {
    const currency = (parsed.data.currency ?? 'EUR').toUpperCase();
    const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
    const periodStart = toDateOrNull(parsed.data.periodStart);
    const periodEnd = toDateOrNull(parsed.data.periodEnd);
    const setActive = parsed.data.setStatusActive ?? false;
    const paymentId = `subpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const data = await db.$transaction(async (tx) => {
      const subscriptionSelect = {
        id: true,
        status: true,
        currentPeriodEnd: true,
        plan: true,
        paypalSubscriptionId: true,
      } as const;
      let sub = await tx.restaurantSubscription.findUnique({
        where: { restaurantId },
        select: subscriptionSelect,
      });
      if (!sub) {
        sub = await tx.restaurantSubscription.create({
          data: {
            restaurantId,
            plan: 'FREE',
            status: 'TRIAL',
          },
          select: subscriptionSelect,
        });
      } else if (setActive || periodEnd) {
        sub = await tx.restaurantSubscription.update({
          where: { id: sub.id },
          data: {
            ...(setActive ? { status: 'ACTIVE' as const, adminPeriodEndAt: null } : {}),
            ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
          },
          select: subscriptionSelect,
        });
      }

      const recordedBy =
        auth.session?.user?.id && typeof auth.session.user.id === 'string'
          ? auth.session.user.id
          : null;
      const paymentRows = await tx.$queryRaw<
        Array<{
          id: string;
          amount: number;
          currency: string;
          paidAt: Date;
          periodEnd: Date | null;
        }>
      >(Prisma.sql`
        INSERT INTO "SubscriptionPayment"
          ("id","restaurantId","restaurantSubscriptionId","amount","currency","paidAt","periodStart","periodEnd","notes","recordedByUserId","createdAt","updatedAt")
        VALUES
          (${paymentId}, ${restaurantId}, ${sub.id}, ${parsed.data.amount}, ${currency}, ${paidAt}, ${periodStart}, ${periodEnd}, ${parsed.data.notes ?? null}, ${recordedBy}, now(), now())
        RETURNING "id","amount","currency","paidAt","periodEnd"
      `);
      const payment = paymentRows[0] ?? null;

      return { payment, subscription: sub };
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
