import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getBranchScopeFromRequest, orderBranchSql } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

const MIN_PREP_MINUTES = 1;
const MAX_PREP_MINUTES = 240;

function parsePrepMinutes(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const m = Math.round(n);
  if (m < MIN_PREP_MINUTES || m > MAX_PREP_MINUTES) return null;
  return m;
}

type OrderLineForKitchen = {
  quantity: number;
  menuItem: { name: string };
  modifiers: { name: string; quantity: number }[];
};

function buildKitchenTicketItemRows(
  lines: OrderLineForKitchen[]
): { productName: string; quantity: number }[] {
  const rows: { productName: string; quantity: number }[] = [];
  for (const line of lines) {
    rows.push({
      productName: line.menuItem.name,
      quantity: line.quantity,
    });
    for (const mod of line.modifiers) {
      const modName = String(mod.name || '').trim();
      if (!modName) continue;
      rows.push({
        productName: `+ ${modName}`,
        quantity: mod.quantity,
      });
    }
  }
  return rows;
}

const KDS_TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

type TicketRow = {
  id: string;
  orderId: string;
  status: string;
  selectedMinutes: number;
  startedAt: Date;
  createdAt: Date;
  sourceType: string;
  orderTotal: number;
  customerName: string | null;
  // Daily token number + 6-char tracking id (`Order.ticketNumber` /
  // `Order.shortOrderId`). Surfaced on the kitchen screen so the cook and
  // the customer-facing display reference the same identifiers.
  shortOrderId: string | null;
  ticketNumber: number | null;
};

type TicketItemRow = {
  id: string;
  kitchenTicketId: string;
  productName: string;
  quantity: number;
};

export async function GET(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKeys: ['kds', 'pos'],
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const restaurantId = auth.restaurantId;
    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      restaurantId
    );
    const branchSql = orderBranchSql(branchScope?.activeBranchId ?? null);

    const requestedStatus = req.nextUrl.searchParams.get('status')?.trim().toLowerCase();
    const statusFilter =
      requestedStatus && ['making', 'completed', 'canceled'].includes(requestedStatus)
        ? requestedStatus
        : 'making';

    const rows = await db.$queryRaw<TicketRow[]>(
      Prisma.sql`
        SELECT
          kt."id",
          kt."orderId",
          kt."status",
          kt."selectedMinutes",
          kt."startedAt",
          kt."createdAt",
          o."sourceType"::text AS "sourceType",
          o."total" AS "orderTotal",
          o."shortOrderId",
          o."ticketNumber",
          c."name" AS "customerName"
        FROM "KitchenTicket" kt
        JOIN "Order" o ON o."id" = kt."orderId"
        LEFT JOIN "Customer" c ON c."id" = o."customerId"
        WHERE kt."restaurantId" = ${restaurantId}
          ${branchSql}
          AND lower(kt."status") = ${statusFilter}
        ORDER BY kt."createdAt" DESC
      `
    );

    const ticketIds = rows.map((r) => r.id);
    const itemRows =
      ticketIds.length > 0
        ? await db.$queryRaw<TicketItemRow[]>(
            Prisma.sql`
              SELECT "id", "kitchenTicketId", "productName", "quantity"
              FROM "KitchenTicketItem"
              WHERE "kitchenTicketId" IN (${Prisma.join(ticketIds)})
              ORDER BY "id" ASC
            `
          )
        : [];

    const itemsByTicket = new Map<string, TicketItemRow[]>();
    for (const it of itemRows) {
      const arr = itemsByTicket.get(it.kitchenTicketId) ?? [];
      arr.push(it);
      itemsByTicket.set(it.kitchenTicketId, arr);
    }

    const data = rows.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      items: itemsByTicket.get(r.id) ?? [],
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('kds tickets get', error);
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKeys: ['kds', 'pos'],
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const restaurantId = auth.restaurantId;

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const selectedMinutes = parsePrepMinutes(body?.selectedMinutes);
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }
    if (selectedMinutes === null) {
      return NextResponse.json(
        {
          error: `Prep time must be between ${MIN_PREP_MINUTES} and ${MAX_PREP_MINUTES} minutes`,
        },
        { status: 400 }
      );
    }

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            menuItem: { select: { name: true } },
            modifiers: { select: { name: true, quantity: true } },
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const existing = await db.$queryRaw<{ id: string; status: string }[]>(
      Prisma.sql`
        SELECT "id", "status"
        FROM "KitchenTicket"
        WHERE "orderId" = ${orderId}
          AND lower("status") IN ('pending', 'making')
        LIMIT 1
      `
    );
    const itemRows = buildKitchenTicketItemRows(order.items);

    if (existing.length > 0) {
      const activeTicket = existing[0];
      if (String(activeTicket.status).toLowerCase() === 'making') {
        return NextResponse.json({ error: 'Order already in making' }, { status: 409 });
      }

      await db.$transaction(async (tx) => {
        await tx.kitchenTicket.update({
          where: { id: activeTicket.id },
          data: {
            status: 'making',
            selectedMinutes,
            startedAt: new Date(),
          },
        });

        const existingItemCount = await tx.kitchenTicketItem.count({
          where: { kitchenTicketId: activeTicket.id },
        });
        if (existingItemCount === 0 && itemRows.length > 0) {
          await tx.kitchenTicketItem.createMany({
            data: itemRows.map((row) => ({
              kitchenTicketId: activeTicket.id,
              productName: row.productName,
              quantity: row.quantity,
            })),
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'making' },
        });

        await tx.payment.updateMany({
          where: { orderId: order.id, status: 'pending' },
          data: { status: 'completed' },
        });
      }, KDS_TX_OPTIONS);

      return NextResponse.json({ data: { id: activeTicket.id } }, { status: 200 });
    }

    const ticket = await db.$transaction(async (tx) => {
      const created = await tx.kitchenTicket.create({
        data: {
          restaurantId,
          orderId: order.id,
          status: 'making',
          selectedMinutes,
          startedAt: new Date(),
        },
      });

      if (itemRows.length > 0) {
        await tx.kitchenTicketItem.createMany({
          data: itemRows.map((row) => ({
            kitchenTicketId: created.id,
            productName: row.productName,
            quantity: row.quantity,
          })),
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'making' },
      });

      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'pending' },
        data: { status: 'completed' },
      });

      return created;
    }, KDS_TX_OPTIONS);

    return NextResponse.json({ data: { id: ticket.id } }, { status: 201 });
  } catch (error) {
    console.error('kds tickets post', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
