import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';
import { z } from 'zod';

import { validateBranchForRestaurant } from '@/lib/branch/branch-scope';
import { findDiningTableForBranch } from '@/lib/dining-tables-query';
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
  computeCheckoutTotal,
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  totalsMatch,
} from '@/lib/restaurant-service-charge';

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
  customerPhone: z.string().max(40).optional(),
  branchId: z.string().uuid().optional(),
  paymentStatus: z.enum(['pending', 'completed']).optional(),
  paymentMethod: z.string().min(1).max(100).optional(),
});

function buildKioskAddressSnapshot(
  fulfillment: 'dine_in' | 'take_away',
  tableName?: string,
  cookingNote?: string,
  customerName?: string,
  customerPhone?: string
): string {
  const lines: string[] = [
    'Source: Kiosk',
    `Fulfillment: ${fulfillment === 'dine_in' ? 'Dine in' : 'Take away'}`,
  ];
  if (tableName?.trim()) lines.push(`Table: ${tableName.trim()}`);
  if (fulfillment === 'dine_in' && tableName?.trim()) {
    lines.push(`Name: ${kioskDineInCustomerDisplayName(tableName)}`);
  } else {
    if (customerName?.trim()) lines.push(`Name: ${customerName.trim()}`);
    if (customerPhone?.trim()) lines.push(`Phone: ${customerPhone.trim()}`);
  }
  if (cookingNote?.trim()) lines.push(`Cooking / notes: ${cookingNote.trim()}`);
  return lines.join('\n');
}

function ticketProductName(
  productName: string,
  groups: z.infer<typeof modifierGroupSchema>[]
): string {
  if (!groups.length) return productName;
  const bits = groups.map((g) => {
    const names = g.selections.map((s) => s.name).join(', ');
    return `${g.groupName}: ${names}`;
  });
  return `${productName} (${bits.join('; ')})`;
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
    branchId: bodyBranchId,
    paymentStatus,
    paymentMethod,
  } = parsed.data;

  const slug = restaurantSlug.trim();
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, ...RESTAURANT_SERVICE_CHARGE_DB_SELECT },
  });

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

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
      where: { restaurantId: restaurant.id },
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
    selectedTableId = table.id;
    selectedTableName = table.name;
  }

  const addressSnapshot = buildKioskAddressSnapshot(
    fulfillment,
    selectedTableName,
    cookingNote,
    customerName,
    customerPhone
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
        customerName,
        customerPhone,
      });

      let order: Awaited<ReturnType<typeof tx.order.create>> | undefined;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          order = await tx.order.create({
            data: {
              restaurantId: restaurant.id,
              branchId,
              customerId: customerId ?? undefined,
              ticketDate,
              ticketNumber,
              status: 'pending',
              total: computedTotal,
              sourceType: OrderSourceType.KIOSK,
              address: addressSnapshot || null,
              diningTableId: selectedTableId ?? undefined,
              tableLabel: selectedTableName ?? undefined,
              taxAmount: 0,
              discountAmount: 0,
              serviceChargeAmount,
              idempotencyKey: idempotencyKey ?? undefined,
            },
          });
          break;
        } catch (e) {
          if (!isTicketNumberConflict(e) || attempt >= 7) throw e;
          ticketNumber += 1;
        }
      }

      if (!order) {
        throw new Error('Failed to create order after ticket retries');
      }

      await Promise.all(
        lines.map(async (line) => {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              menuItemId: line.menuItemId,
              quantity: line.quantity,
              price: line.unitPrice,
            },
          });

          const flatMods = line.modifiers.flatMap((g) => g.selections);
          if (flatMods.length > 0) {
            await tx.orderItemModifier.createMany({
              data: flatMods.map((s) => ({
                orderItemId: orderItem.id,
                menuItemId: normalizePersonalizeModifierMenuItemId(s.menuItemId),
                name: s.name,
                unitPrice: s.unitPrice,
                quantity: 1,
              })),
            });
          }
        })
      );

      // Table + unpaid (or pending) → hold for POS table sheet; do not send kitchen yet.
      // Paid orders (cash completed / card) still get a kitchen ticket immediately.
      const resolvedPaymentStatus = paymentStatus ?? 'completed';
      const isTableOpenCheck =
        Boolean(selectedTableId) &&
        resolvedPaymentStatus.toLowerCase() === 'pending';

      if (!isTableOpenCheck) {
        const ticket = await tx.kitchenTicket.create({
          data: {
            restaurantId: restaurant.id,
            orderId: order.id,
            status: 'pending',
            selectedMinutes: SELECTED_MINUTES_KIOSK,
          },
        });

        await tx.kitchenTicketItem.createMany({
          data: lines.map((line) => ({
            kitchenTicketId: ticket.id,
            productName: ticketProductName(line.productName, line.modifiers),
            quantity: line.quantity,
          })),
        });
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: computedTotal,
          status: resolvedPaymentStatus,
          method: paymentMethod?.trim() || 'Kiosk',
          restaurantId: restaurant.id,
        },
      });

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
    if (isPrismaUniqueViolation(e)) {
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
