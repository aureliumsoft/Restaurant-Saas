import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';
import { z } from 'zod';

import { validateBranchForRestaurant } from '@/lib/branch/branch-scope';
import { buildKitchenTicketItemRows } from '@/lib/kitchen-ticket-items';
import { getCustomerAccountSession } from '@/lib/customer-auth/session';
import { findDiningTableForBranch } from '@/lib/dining-tables-query';
import { markDiningTableReserved } from '@/lib/dining-table-status';
import { db } from '@/lib/db';
import {
  isPersonalizeModifierMenuItemId,
  normalizePersonalizeModifierMenuItemId,
} from '@/lib/menu/personalize-modifiers';
import {
  kioskDineInCustomerDisplayName,
  upsertKioskOrderCustomer,
} from '@/lib/kiosk-customer';
import {
  isPrismaUniqueViolation,
  parseOrderIdempotencyKey,
  recoverOrderFromIdempotencyConflict,
  respondIfIdempotentOrderExists,
} from '@/lib/order-idempotency-server';
import {
  allocateTicketNumber,
  isTicketNumberConflict,
  utcTicketDateFromNow,
} from '@/lib/order-ticket-number';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import {
  consumeIngredientsForOrder,
  isMajorIngredientOutOfStockError,
} from '@/lib/inventory/stock';
import {
  computeCheckoutTotal,
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  totalsMatch,
} from '@/lib/restaurant-service-charge';
import {
  parseRestaurantFulfillmentSettings,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} from '@/lib/restaurant-fulfillment-settings';

const SELECTED_MINUTES_KIOSK = 25;

const modifierSelectionSchema = z.object({
  menuItemId: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.number().finite().nonnegative(),
});

const modifierGroupSchema = z.object({
  attributeGroupId: z.string(),
  groupName: z.string(),
  selections: z.array(modifierSelectionSchema),
});

const lineSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().finite().nonnegative(),
  productName: z.string().min(1),
  variationId: z.string().uuid().optional().nullable(),
  modifiers: z.array(modifierGroupSchema).default([]),
});

const postSchema = z.object({
  restaurantSlug: z.string().min(1).max(200),
  fulfillment: z.enum(['dine_in', 'take_away']),
  tableId: z.string().uuid().optional(),
  lines: z.array(lineSchema).min(1).max(200),
  subtotal: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
  cookingNote: z.string().max(2000).optional(),
  customerName: z.string().max(120).optional(),
  customerEmail: z.string().email().max(320).optional(),
  customerPhone: z.string().max(40).optional(),
  branchId: z.string().uuid().optional(),
  paymentStatus: z.enum(['pending', 'completed']).optional(),
  paymentMethod: z.string().min(1).max(100).optional(),
  mobileTableQr: z.boolean().optional(),
});

function buildKioskAddressSnapshot(
  fulfillment: 'dine_in' | 'take_away',
  tableName?: string,
  cookingNote?: string,
  customerName?: string,
  customerPhone?: string,
  customerEmail?: string,
  mobileTableQr?: boolean
): string {
  const lines: string[] = [
    'Source: Kiosk',
    `Fulfillment: ${fulfillment === 'dine_in' ? 'Dine in' : 'Take away'}`,
  ];
  if (tableName?.trim()) lines.push(`Table: ${tableName.trim()}`);
  if (mobileTableQr) {
    if (customerName?.trim()) lines.push(`Name: ${customerName.trim()}`);
    if (customerEmail?.trim()) lines.push(`Email: ${customerEmail.trim()}`);
  } else if (fulfillment === 'dine_in' && tableName?.trim()) {
    lines.push(`Name: ${kioskDineInCustomerDisplayName(tableName)}`);
  } else {
    if (customerName?.trim()) lines.push(`Name: ${customerName.trim()}`);
    if (customerPhone?.trim()) lines.push(`Phone: ${customerPhone.trim()}`);
  }
  if (cookingNote?.trim()) lines.push(`Cooking / notes: ${cookingNote.trim()}`);
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  if (!('KIOSK' in OrderSourceType)) {
    return NextResponse.json(
      {
        error:
          'Kiosk orders are not available: this build’s Prisma client is missing OrderSourceType.KIOSK. Stop the dev server, run `npx prisma migrate deploy` (or `migrate dev`), then `npx prisma generate`, and start again.',
      },
      { status: 503 }
    );
  }

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

  const {
    restaurantSlug,
    fulfillment,
    tableId,
    lines,
    subtotal,
    total,
    cookingNote,
    customerName,
    customerPhone,
    customerEmail,
    branchId: bodyBranchId,
    paymentStatus,
    paymentMethod,
    mobileTableQr,
  } = parsed.data;

  const slug = restaurantSlug.trim();
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
      ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
    },
  });

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const fulfillmentSettings = parseRestaurantFulfillmentSettings(restaurant);
  const isTableDineIn =
    fulfillment === 'dine_in' &&
    (Boolean(tableId) || Boolean(mobileTableQr));

  if (!isTableDineIn && !fulfillmentSettings.kioskEnabled) {
    return NextResponse.json(
      { error: 'Kiosk ordering is not enabled for this restaurant' },
      { status: 403 }
    );
  }
  if (fulfillment === 'dine_in' && !fulfillmentSettings.dineInEnabled) {
    return NextResponse.json(
      { error: 'Dine-in is not available at this restaurant' },
      { status: 403 }
    );
  }
  const paymentMethodNorm = paymentMethod?.trim().toLowerCase() ?? '';
  if (
    paymentMethodNorm.includes('card') &&
    !fulfillmentSettings.cardPaymentsEnabled
  ) {
    return NextResponse.json(
      { error: 'Card payments are not enabled for this restaurant' },
      { status: 403 }
    );
  }

  const customerSession = mobileTableQr
    ? await getCustomerAccountSession(req, { restaurantId: restaurant.id })
    : null;

  if (mobileTableQr && !customerSession) {
    return NextResponse.json(
      { error: 'Sign in is required for mobile table QR orders.' },
      { status: 401 }
    );
  }

  const resolvedCustomerName =
    mobileTableQr && customerSession
      ? customerSession.name.trim() || customerName?.trim()
      : customerName?.trim();
  const resolvedCustomerEmail =
    mobileTableQr && customerSession
      ? customerSession.email.trim() || customerEmail?.trim()
      : customerEmail?.trim();

  const idempotencyKey = parseOrderIdempotencyKey(req);
  const idempotentHit = await respondIfIdempotentOrderExists(
    idempotencyKey,
    restaurant.id
  );
  if (idempotentHit) return idempotentHit;

  const computedSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  if (Math.abs(computedSubtotal - subtotal) > 0.02) {
    return NextResponse.json({ error: 'Subtotal does not match cart lines' }, { status: 400 });
  }

  const serviceCharges = parseRestaurantServiceCharges(restaurant);
  const { serviceChargeAmount, total: computedTotal } = computeCheckoutTotal(
    computedSubtotal,
    serviceCharges,
    'kiosk'
  );
  if (!totalsMatch(computedTotal, total)) {
    return NextResponse.json(
      { error: 'Total does not match subtotal plus service charge' },
      { status: 400 }
    );
  }

  const menuIds = new Set<string>();
  for (const line of lines) {
    menuIds.add(line.menuItemId);
    for (const g of line.modifiers) {
      for (const s of g.selections) {
        if (!isPersonalizeModifierMenuItemId(s.menuItemId)) {
          menuIds.add(s.menuItemId);
        }
      }
    }
  }

  const menuRows = await db.menuItem.findMany({
    where: { restaurantId: restaurant.id, id: { in: [...menuIds] } },
    select: { id: true },
  });
  if (menuRows.length !== menuIds.size) {
    return NextResponse.json(
      { error: 'One or more menu items are invalid for this restaurant' },
      { status: 400 }
    );
  }

  let branchId: string | null = bodyBranchId ?? null;
  if (branchId) {
    const ok = await validateBranchForRestaurant(branchId, restaurant.id);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
    }
  } else {
    const defaultBranch = await db.branch.findFirst({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    branchId = defaultBranch?.id ?? null;
  }

  let selectedTableId: string | undefined;
  let selectedTableName: string | undefined;
  if (fulfillment === 'dine_in') {
    if (!tableId) {
      return NextResponse.json(
        { error: 'Table is required for dine in orders' },
        { status: 400 }
      );
    }
    const table = await findDiningTableForBranch(
      tableId,
      restaurant.id,
      branchId
    );
    if (!table) {
      return NextResponse.json({ error: 'Selected table not found' }, { status: 400 });
    }
    if (table.status === 'RESERVED') {
      return NextResponse.json(
        { error: 'That table is already reserved. Choose an available table.' },
        { status: 409 }
      );
    }
    selectedTableId = table.id;
    selectedTableName = table.name;
  }

  const addressSnapshot = buildKioskAddressSnapshot(
    fulfillment,
    selectedTableName,
    cookingNote,
    resolvedCustomerName,
    customerPhone,
    resolvedCustomerEmail,
    mobileTableQr
  );

  try {
    const result = await db.$transaction(async (tx) => {
      const ticketDate = utcTicketDateFromNow();
      let ticketNumber = await allocateTicketNumber(tx, {
        restaurantId: restaurant.id,
        ticketDate,
        branchId,
      });

      const customerId = await upsertKioskOrderCustomer(tx, restaurant.id, {
        fulfillment,
        tableId: selectedTableId,
        tableName: selectedTableName,
        customerName: resolvedCustomerName,
        customerPhone,
        customerEmail: resolvedCustomerEmail,
        customerAccountId: customerSession?.accountId,
        mobileTableQr,
      });

      // Table + unpaid → hold for the POS table sheet. Paid orders still go to the kitchen.
      const resolvedPaymentStatus = paymentStatus ?? 'completed';
      const isTableOpenCheck =
        Boolean(selectedTableId) &&
        resolvedPaymentStatus.toLowerCase() === 'pending';

      const linePayload = JSON.stringify(
        lines.map((line, idx) => ({
          idx,
          menuItemId: line.menuItemId,
          productName: line.productName,
          quantity: line.quantity,
          price: line.unitPrice,
        }))
      );
      const modifierPayload = JSON.stringify(
        lines.flatMap((line, lineIdx) =>
          line.modifiers
            .flatMap((group) =>
              group.selections.map((selection) => ({
                groupName: group.groupName,
                selection,
              }))
            )
            .map(({ groupName, selection }, sortOrder) => ({
              lineIdx,
              menuItemId: normalizePersonalizeModifierMenuItemId(
                selection.menuItemId
              ),
              name: selection.name,
              groupName: groupName?.trim() || null,
              unitPrice: selection.unitPrice,
              sortOrder,
            }))
        )
      );
      const kitchenPayload = isTableOpenCheck
        ? '[]'
        : JSON.stringify(
            buildKitchenTicketItemRows(
              lines.map((line) => ({
                quantity: line.quantity,
                productName: line.productName,
                modifiers: line.modifiers.flatMap((group) =>
                  group.selections.map((sel) => ({
                    name: sel.name,
                    quantity: 1,
                    menuItemId: sel.menuItemId,
                    groupName: group.groupName,
                  }))
                ),
              }))
            ).map((row, sortOrder) => ({
              productName: row.productName,
              quantity: row.quantity,
              sortOrder,
            }))
          );

      let order:
        | {
            id: string;
            shortOrderId: string;
            branchId: string | null;
          }
        | undefined;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const inserted = await tx.$queryRaw<
            Array<{
              id: string;
              shortOrderId: string;
              branchId: string | null;
            }>
          >`
            WITH new_order AS (
              INSERT INTO "Order" (
                id, "restaurantId", "branchId", "customerId", "ticketDate",
                "ticketNumber", status, total, "sourceType", address,
                "taxAmount", "discountAmount", "serviceChargeAmount",
                "customerComment", "diningTableId", "tableLabel",
                "idempotencyKey", "createdAt", "updatedAt"
              )
              VALUES (
                gen_random_uuid(),
                ${restaurant.id},
                ${branchId},
                ${customerId},
                ${ticketDate}::date,
                ${ticketNumber},
                'pending',
                ${computedTotal},
                'KIOSK'::"OrderSourceType",
                ${addressSnapshot || null},
                0,
                0,
                ${serviceChargeAmount},
                ${cookingNote?.trim() || null},
                ${selectedTableId ?? null},
                ${selectedTableName ?? null},
                ${idempotencyKey},
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
              RETURNING id, "shortOrderId", "branchId"
            ),
            line_rows AS (
              SELECT
                gen_random_uuid() AS id,
                (line->>'menuItemId') AS "menuItemId",
                line->>'productName' AS "productName",
                (line->>'quantity')::int AS quantity,
                (line->>'price')::double precision AS price,
                (line->>'idx')::int AS idx
              FROM jsonb_array_elements(${linePayload}::jsonb) AS line
            ),
            inserted_items AS (
              INSERT INTO "OrderItem" (
                id, "orderId", "menuItemId", "productName", quantity, price,
                "createdAt", "updatedAt"
              )
              SELECT
                l.id, o.id, l."menuItemId", l."productName", l.quantity, l.price,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              FROM line_rows l
              CROSS JOIN new_order o
              RETURNING id
            ),
            inserted_mods AS (
              INSERT INTO "OrderItemModifier" (
                id, "orderItemId", "menuItemId", name, "groupName",
                "unitPrice", quantity, "sortOrder", "createdAt", "updatedAt"
              )
              SELECT
                gen_random_uuid(),
                l.id,
                NULLIF(m->>'menuItemId', ''),
                m->>'name',
                NULLIF(m->>'groupName', ''),
                (m->>'unitPrice')::double precision,
                1,
                (m->>'sortOrder')::int,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              FROM jsonb_array_elements(${modifierPayload}::jsonb) AS m
              JOIN line_rows l ON l.idx = (m->>'lineIdx')::int
              RETURNING id
            ),
            inserted_ticket AS (
              INSERT INTO "KitchenTicket" (
                id, "restaurantId", "orderId", status, "selectedMinutes",
                "startedAt", "createdAt", "updatedAt"
              )
              SELECT
                gen_random_uuid()::text,
                ${restaurant.id},
                o.id,
                'pending',
                ${SELECTED_MINUTES_KIOSK},
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              FROM new_order o
              WHERE ${isTableOpenCheck} = FALSE
                AND jsonb_array_length(${kitchenPayload}::jsonb) > 0
              RETURNING id
            ),
            inserted_ticket_items AS (
              INSERT INTO "KitchenTicketItem" (
                id, "kitchenTicketId", "productName", quantity, "sortOrder"
              )
              SELECT
                gen_random_uuid()::text,
                t.id,
                k->>'productName',
                (k->>'quantity')::int,
                (k->>'sortOrder')::int
              FROM inserted_ticket t
              CROSS JOIN jsonb_array_elements(${kitchenPayload}::jsonb) AS k
              RETURNING id
            ),
            inserted_payment AS (
              INSERT INTO "Payment" (
                id, "orderId", amount, status, method, "restaurantId",
                "createdAt", "updatedAt"
              )
              SELECT
                gen_random_uuid(),
                o.id,
                ${computedTotal},
                ${resolvedPaymentStatus},
                ${paymentMethod?.trim() || 'Kiosk'},
                ${restaurant.id},
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              FROM new_order o
              RETURNING id
            )
            SELECT
              o.id,
              o."shortOrderId",
              o."branchId",
              (SELECT count(*) FROM inserted_items) AS item_count,
              (SELECT count(*) FROM inserted_mods) AS mod_count,
              (SELECT count(*) FROM inserted_ticket) AS ticket_count,
              (SELECT count(*) FROM inserted_ticket_items) AS ticket_item_count,
              (SELECT count(*) FROM inserted_payment) AS payment_count
            FROM new_order o
          `;
          const row = inserted[0];
          if (!row?.id || !row.shortOrderId) {
            throw new Error('Failed to create order');
          }
          order = row;
          break;
        } catch (e) {
          const message = e instanceof Error ? e.message : '';
          const ticketConflict =
            isTicketNumberConflict(e) || /ticketNumber|ticketDate/i.test(message);
          if (!ticketConflict || attempt >= 7) throw e;
          ticketNumber += 1;
        }
      }

      if (!order) {
        throw new Error('Failed to create order after ticket retries');
      }

      await consumeIngredientsForOrder(tx, {
        restaurantId: restaurant.id,
        branchId: order.branchId,
        orderId: order.id,
        lines: lines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          variationId: line.variationId,
          modifiers: line.modifiers,
        })),
      });

      if (selectedTableId) {
        await markDiningTableReserved(tx, selectedTableId);
      }

      return { order, ticketNumber, isTableOpenCheck };
    }, { timeout: 20000, maxWait: 10000 });

    publishOrderLifecycleUpdate({
      restaurantId: restaurant.id,
      branchId: result.order.branchId,
    });

    return NextResponse.json(
      {
        data: {
          orderId: result.order.id,
          shortOrderId: result.order.shortOrderId,
          restaurantId: restaurant.id,
          ticketNumber: result.ticketNumber,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    if (isMajorIngredientOutOfStockError(e)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.message.includes('Select a variation')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const conflictMessage = e instanceof Error ? e.message : '';
    if (
      isPrismaUniqueViolation(e) ||
      /idempotency/i.test(conflictMessage)
    ) {
      const recovered = await recoverOrderFromIdempotencyConflict(
        idempotencyKey,
        restaurant.id
      );
      if (recovered) return recovered;
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
