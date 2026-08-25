import { OrderSourceType } from '@prisma/client';
import { z } from 'zod';

import { validateBranchForRestaurant } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import {
  isPersonalizeModifierMenuItemId,
  normalizePersonalizeModifierMenuItemId,
} from '@/lib/menu/personalize-modifiers';
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
import { resolveWebCustomerName } from '@/lib/web-customer';
import {
  consumeIngredientsForOrder,
  isMajorIngredientOutOfStockError,
} from '@/lib/inventory/stock';
import type { NextResponse } from 'next/server';

const SELECTED_MINUTES_ONLINE = 30;

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
  variationId: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().uuid().optional().nullable()
  ),
  modifiers: z.array(modifierGroupSchema).default([]),
});

const optionalOrderString = z.string().optional().nullable();

const orderInfoSchema = z.object({
  mode: z.enum(['delivery', 'pickUp']),
  restaurantName: optionalOrderString,
  storeId: optionalOrderString,
  storeName: optionalOrderString,
  storeAddress: optionalOrderString,
  address: optionalOrderString,
  apartment: optionalOrderString,
  gateCode: optionalOrderString,
  addressName: optionalOrderString,
  customerPhone: optionalOrderString,
  restaurantSlug: optionalOrderString,
});

const orderScheduleSchema = z.object({
  mode: z.enum(['asap', 'later']).optional().default('asap'),
  slot: z.string().max(60).optional(),
  slotDateTime: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().datetime().optional()
  ),
});

export const customerOrderPostSchema = z
  .object({
    restaurantSlug: z.string().min(1).max(200),
    orderType: z.enum(['delivery', 'pickUp']),
    orderInfo: orderInfoSchema,
    lines: z.array(lineSchema).min(1).max(200),
    subtotal: z.number().finite().nonnegative(),
    total: z.number().finite().nonnegative(),
    cutlery: z.boolean(),
    comment: z.string().max(2000).optional(),
    schedule: orderScheduleSchema.optional(),
    paymentStatus: z.enum(['pending', 'completed']).optional(),
    paymentMethod: z.string().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const name = data.orderInfo.addressName?.trim() ?? '';
    const phone = data.orderInfo.customerPhone?.trim() ?? '';
    const address = data.orderInfo.address?.trim() ?? '';
    if (!name && data.orderType === 'delivery') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderInfo', 'addressName'],
        message: 'Customer name is required',
      });
    }
    if (data.orderType === 'delivery' && !address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderInfo', 'address'],
        message: 'Delivery address is required',
      });
    }
    if (data.orderType === 'delivery' && !phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderInfo', 'customerPhone'],
        message: 'Customer phone is required for delivery',
      });
    }
    const storeId = data.orderInfo.storeId?.trim() ?? '';
    if (!storeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderInfo', 'storeId'],
        message: 'Branch is required',
      });
    }
  });

export type CustomerOrderPostInput = z.infer<typeof customerOrderPostSchema>;

function buildAddressSnapshot(
  orderType: 'delivery' | 'pickUp',
  info: z.infer<typeof orderInfoSchema>,
  cutlery: boolean,
  comment?: string
): string {
  const lines: string[] = [
    'Source: Online',
    `Fulfillment: ${orderType === 'delivery' ? 'Delivery' : 'Pick-up'}`,
  ];

  if (info.restaurantName?.trim()) {
    lines.push(`Restaurant: ${info.restaurantName.trim()}`);
  }

  if (orderType === 'delivery') {
    if (info.addressName?.trim()) lines.push(`Name: ${info.addressName.trim()}`);
    if (info.customerPhone?.trim())
      lines.push(`Phone: ${info.customerPhone.trim()}`);
    if (info.storeName?.trim()) lines.push(`Branch: ${info.storeName.trim()}`);
    if (info.storeAddress?.trim())
      lines.push(`Branch address: ${info.storeAddress.trim()}`);
    if (info.address?.trim()) lines.push(`Address: ${info.address.trim()}`);
    if (info.apartment?.trim())
      lines.push(`Apartment / door: ${info.apartment.trim()}`);
    if (info.gateCode?.trim()) lines.push(`Gate code: ${info.gateCode.trim()}`);
  } else {
    lines.push(`Name: ${resolveWebCustomerName(orderType, info.addressName)}`);
    if (info.customerPhone?.trim())
      lines.push(`Phone: ${info.customerPhone.trim()}`);
    if (info.storeName?.trim())
      lines.push(`Pickup location: ${info.storeName.trim()}`);
    if (info.storeAddress?.trim())
      lines.push(`Store address: ${info.storeAddress.trim()}`);
  }

  if (cutlery) {
    lines.push('Cutlery requested: yes');
  }
  if (comment?.trim()) {
    lines.push(`Customer note: ${comment.trim()}`);
  }

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

export type CreateCustomerOrderResult =
  | {
      ok: true;
      orderId: string;
      shortOrderId: string;
      restaurantId: string;
      ticketNumber: number | null;
    }
  | { ok: false; status: number; error: unknown; response?: NextResponse };

export async function createCustomerOrder(options: {
  data: CustomerOrderPostInput;
  /** Trusted account ID from session or payment intent — never from untrusted browser payload alone. */
  customerAccountId?: string | null;
  idempotencyKey?: string | null;
  /** Payment already captured (Stripe / PayPal / wallet). Never fail the sale on stock. */
  paidExternally?: boolean;
}): Promise<CreateCustomerOrderResult> {
  const {
    restaurantSlug,
    orderType,
    orderInfo,
    lines,
    subtotal,
    total,
    cutlery,
    comment,
    schedule,
    paymentStatus,
    paymentMethod,
  } = options.data;

  const slug = restaurantSlug.trim();
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, ...RESTAURANT_SERVICE_CHARGE_DB_SELECT },
  });

  if (!restaurant) {
    return { ok: false, status: 404, error: 'Restaurant not found' };
  }

  const idempotencyKey = options.idempotencyKey ?? null;
  const idempotentHit = await respondIfIdempotentOrderExists(
    idempotencyKey,
    restaurant.id
  );
  if (idempotentHit) {
    return { ok: false, status: 200, error: 'idempotent', response: idempotentHit };
  }

  const paidExternally = options.paidExternally === true;

  const computedSubtotal = lines.reduce(
    (sum, l) => sum + l.unitPrice * l.quantity,
    0
  );
  if (!paidExternally && Math.abs(computedSubtotal - subtotal) > 0.02) {
    return {
      ok: false,
      status: 400,
      error: 'Subtotal does not match cart lines',
    };
  }

  const serviceCharges = parseRestaurantServiceCharges(restaurant);
  const { serviceChargeAmount, total: computedTotal } = computeCheckoutTotal(
    computedSubtotal,
    serviceCharges,
    'online'
  );
  const orderTotal = paidExternally ? total : computedTotal;
  const orderServiceCharge = paidExternally
    ? Math.max(0, Number((total - computedSubtotal).toFixed(2)))
    : serviceChargeAmount;
  if (!paidExternally && !totalsMatch(computedTotal, total)) {
    return {
      ok: false,
      status: 400,
      error: 'Total does not match subtotal plus service charge',
    };
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

  const branchId = orderInfo.storeId?.trim() || null;
  if (
    !branchId ||
    !(await validateBranchForRestaurant(branchId, restaurant.id))
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid branch for this restaurant',
    };
  }

  const menuRows = await db.menuItem.findMany({
    where: { restaurantId: restaurant.id, id: { in: [...menuIds] } },
    select: {
      id: true,
      variations: { select: { id: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!paidExternally && menuRows.length !== menuIds.size) {
    return {
      ok: false,
      status: 400,
      error: 'One or more menu items are invalid for this restaurant',
    };
  }
  const validMenuIds = new Set(menuRows.map((m) => m.id));

  const variationsByItemId = new Map(
    menuRows.map((row) => [row.id, row.variations])
  );
  const resolvedLines = lines.map((line) => {
    if (line.variationId?.trim()) return line;
    const fallback = variationsByItemId.get(line.menuItemId)?.[0]?.id;
    if (!fallback) return line;
    return { ...line, variationId: fallback };
  });

  let trustedAccountId: string | null = null;
  let accountEmail: string | null = null;
  let accountName: string | null = null;
  let accountPhone: string | null = null;

  if (options.customerAccountId) {
    const account = await db.customerAccount.findFirst({
      where: {
        id: options.customerAccountId,
        restaurantId: restaurant.id,
        disabledAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
      },
    });
    if (account) {
      trustedAccountId = account.id;
      accountEmail = account.email;
      accountName = account.name;
      accountPhone = account.phone;
    }
  }

  const addressSnapshot = buildAddressSnapshot(
    orderType,
    orderInfo,
    cutlery,
    comment
  );
  const customerName =
    orderInfo.addressName?.trim() ||
    accountName ||
    resolveWebCustomerName(orderType, orderInfo.addressName);
  const customerPhone =
    orderInfo.customerPhone?.trim() ||
    accountPhone ||
    (orderType === 'pickUp' ? 'N/A' : '');

  try {
    const result = await db.$transaction(
      async (tx) => {
        const ticketDate = utcTicketDateFromNow();
        let ticketNumber = await allocateTicketNumber(tx, {
          restaurantId: restaurant.id,
          ticketDate,
          branchId,
        });

        let customerId: string;
        if (trustedAccountId) {
          const existingProfile = await tx.customer.findFirst({
            where: {
              restaurantId: restaurant.id,
              accountId: trustedAccountId,
            },
            select: { id: true },
          });
          if (existingProfile) {
            const updated = await tx.customer.update({
              where: { id: existingProfile.id },
              data: {
                name: customerName,
                email: accountEmail,
                phone: customerPhone || 'N/A',
              },
              select: { id: true },
            });
            customerId = updated.id;
          } else {
            const created = await tx.customer.create({
              data: {
                restaurantId: restaurant.id,
                accountId: trustedAccountId,
                name: customerName,
                email: accountEmail,
                phone: customerPhone || 'N/A',
              },
              select: { id: true },
            });
            customerId = created.id;
          }
        } else {
          const customer = await tx.customer.create({
            data: {
              restaurantId: restaurant.id,
              name: customerName,
              phone: customerPhone || 'N/A',
              email: null,
            },
            select: { id: true },
          });
          customerId = customer.id;
        }

        let order: Awaited<ReturnType<typeof tx.order.create>> | undefined;
        for (let attempt = 0; attempt < 8; attempt++) {
          try {
            order = await tx.order.create({
              data: {
                restaurantId: restaurant.id,
                branchId,
                customerId,
                customerAccountId: trustedAccountId,
                ticketDate,
                ticketNumber,
                status: 'pending',
                total: orderTotal,
                sourceType: OrderSourceType.ONLINE,
                address: addressSnapshot || null,
                cutleryRequested: cutlery,
                customerComment: comment?.trim() || null,
                orderScheduleMode: schedule?.mode ?? 'asap',
                orderScheduleSlot: schedule?.slot?.trim() || null,
                orderScheduleAt: schedule?.slotDateTime
                  ? new Date(schedule.slotDateTime)
                  : null,
                taxAmount: 0,
                discountAmount: 0,
                serviceChargeAmount: orderServiceCharge,
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

        for (const line of resolvedLines) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              menuItemId: validMenuIds.has(line.menuItemId)
                ? line.menuItemId
                : null,
              productName: line.productName,
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
        }

        const ticket = await tx.kitchenTicket.create({
          data: {
            restaurantId: restaurant.id,
            orderId: order.id,
            status: 'pending',
            selectedMinutes: SELECTED_MINUTES_ONLINE,
          },
        });

        await tx.kitchenTicketItem.createMany({
          data: resolvedLines.map((line) => ({
            kitchenTicketId: ticket.id,
            productName: ticketProductName(line.productName, line.modifiers),
            quantity: line.quantity,
          })),
        });

        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: orderTotal,
            status: paymentStatus ?? 'completed',
            method: paymentMethod?.trim() || 'Online checkout',
            restaurantId: restaurant.id,
          },
        });

        await consumeIngredientsForOrder(tx, {
          restaurantId: restaurant.id,
          orderId: order.id,
          requireAvailableStock: !paidExternally,
          requireVariation: !paidExternally,
          lines: resolvedLines.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            variationId: line.variationId,
            modifiers: line.modifiers,
          })),
        });

        return { order, ticketNumber };
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    publishOrderLifecycleUpdate({
      restaurantId: restaurant.id,
      branchId,
    });

    return {
      ok: true,
      orderId: result.order.id,
      shortOrderId: result.order.shortOrderId,
      restaurantId: restaurant.id,
      ticketNumber: result.ticketNumber,
    };
  } catch (e) {
    if (isMajorIngredientOutOfStockError(e)) {
      return { ok: false, status: 400, error: e.message };
    }
    if (e instanceof Error && e.message.includes('Select a variation')) {
      return { ok: false, status: 400, error: e.message };
    }
    if (isPrismaUniqueViolation(e)) {
      const recovered = await recoverOrderFromIdempotencyConflict(
        idempotencyKey,
        restaurant.id
      );
      if (recovered) {
        return {
          ok: false,
          status: 200,
          error: 'idempotent',
          response: recovered,
        };
      }
    }
    console.error(e);
    return { ok: false, status: 500, error: 'Failed to place order' };
  }
}

/** Helper for payment syncers that have a raw payload object. */
export function parseCustomerOrderPayload(
  payload: unknown
): CustomerOrderPostInput | null {
  const parsed = customerOrderPostSchema.safeParse(payload);
  if (!parsed.success) {
    console.error(
      'Invalid customer order payload',
      parsed.error.flatten()
    );
    return null;
  }
  return parsed.data;
}

export function customerOrderPayloadError(payload: unknown): string | null {
  const parsed = customerOrderPostSchema.safeParse(payload);
  if (parsed.success) return null;
  const flat = parsed.error.flatten();
  const field = Object.entries(flat.fieldErrors)
    .map(([key, messages]) =>
      messages?.length ? `${key}: ${messages.join(', ')}` : null
    )
    .find((row): row is string => Boolean(row));
  return field ?? flat.formErrors[0] ?? 'Invalid order payload';
}

export { parseOrderIdempotencyKey };
