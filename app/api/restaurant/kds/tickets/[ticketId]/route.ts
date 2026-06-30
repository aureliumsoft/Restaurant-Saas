import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';

const FINAL_TO_ORDER: Record<string, string> = {
  completed: 'completed',
  canceled: 'canceled',
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'kds',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { ticketId } = await params;

    const body = await req.json().catch(() => ({}));
    const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (!(status in FINAL_TO_ORDER)) {
      return NextResponse.json({ error: 'Status must be completed or canceled' }, { status: 400 });
    }

    const rows = await db.$queryRaw<{ orderId: string }[]>(
      Prisma.sql`
        SELECT "orderId"
        FROM "KitchenTicket"
        WHERE "id" = ${ticketId}
          AND "restaurantId" = ${auth.restaurantId}
        LIMIT 1
      `
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    const orderId = rows[0].orderId;

    await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "KitchenTicket"
          SET "status" = ${status}, "updatedAt" = now()
          WHERE "id" = ${ticketId}
        `
      );
      await tx.order.update({
        where: { id: orderId },
        data: { status: FINAL_TO_ORDER[status] },
      });
    });

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { branchId: true },
    });
    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId: order?.branchId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('kds ticket patch', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}
