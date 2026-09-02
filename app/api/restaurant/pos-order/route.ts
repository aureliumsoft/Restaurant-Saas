import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import { findDiningTableForBranch } from '@/lib/dining-tables-query';
import { db } from '@/lib/db';
import {
  allocateTicketNumber,
  isTicketNumberConflict,
  utcTicketDateFromNow,
} from '@/lib/order-ticket-number';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  resolveServiceChargeAmount,
} from '@/lib/restaurant-service-charge';
import { isDineInPayBeforeKitchen } from '@/lib/restaurant-dine-in-payment';
import {
  parseRestaurantFulfillmentSettings,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} from '@/lib/restaurant-fulfillment-settings';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { resolvePosPaymentLedgerAmount } from '@/lib/order-payment';
import { getOpenPosShift } from '@/lib/pos-shift';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import {
  consumeIngredientsForOrder,
  isMajorIngredientOutOfStockError,
} from '@/lib/inventory/stock';

import {
  normalizePosOrderLines,
  paymentModeToMethodLabel,
  type PosOrderLineInput,
} from '@/lib/pos-order-lines';
import { createOrderItemsWithModifiers } from '@/lib/pos-order-modifiers';
import {
  isPrismaUniqueViolation,
  parseOrderIdempotencyKey,
  recoverOrderFromIdempotencyConflict,
  respondIfIdempotentOrderExists,
} from '@/lib/order-idempotency-server';

export async function POST(req: NextRequest) {
  let restaurantId = '';
  let idempotencyKey: string | null = null;
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    restaurantId = auth.restaurantId;
    idempotencyKey = parseOrderIdempotencyKey(req);
    const existing = await respondIfIdempotentOrderExists(
      idempotencyKey,
      restaurantId
    );
    if (existing) {
      // Keep flat fields for POS UI + nested data for offline flush parser.
      const body = await existing.json();
      const data = (body as { data?: Record<string, unknown> }).data;
      return NextResponse.json(
        {
          id: data?.orderId,
          shortOrderId: data?.shortOrderId,
          ticketNumber: data?.ticketNumber ?? null,
          data,
          message: 'POS order already saved',
        },
        { status: 200 }
      );
    }

    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      restaurantId
    );

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const paymentRaw = body.payment;
    const paymentStr =
      typeof paymentRaw === 'number'
        ? String(paymentRaw)
        : typeof paymentRaw === 'string'
          ? paymentRaw.trim()
          : '';
    if (paymentStr === '') {
      return NextResponse.json(
        { error: 'Payment amount is required' },
        { status: 400 }
      );
    }

    const paymentAmount = Number(paymentStr);
    if (Number.isNaN(paymentAmount) || paymentAmount < 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    const grandTotal = Number(body.grandTotal);
    if (Number.isNaN(grandTotal) || grandTotal < 0) {
      return NextResponse.json({ error: 'Invalid total' }, { status: 400 });
    }

    const items = Array.isArray(body.items) ? (body.items as PosOrderLineInput[]) : [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    let branchId: string | null =
      typeof body.branchId === 'string' && body.branchId.trim()
        ? body.branchId.trim()
        : branchScope?.activeBranchId ?? null;
    if (branchId) {
      const ok = await validateBranchForRestaurant(branchId, restaurantId);
      if (!ok) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      if (
        branchScope &&
        !branchScope.allowedBranchIds.includes(branchId)
      ) {
        return NextResponse.json(
          { error: 'You do not have access to this branch.' },
          { status: 403 }
        );
      }
    }

    const paymentMode =
      typeof body.paymentMode === 'string' ? body.paymentMode : 'cash';
    const paymentStatusRaw =
      typeof body.paymentStatus === 'string' ? body.paymentStatus.trim().toLowerCase() : '';
    const initialPaymentStatus =
      paymentStatusRaw === 'pending' ||
      paymentStatusRaw === 'completed' ||
      paymentStatusRaw === 'failed' ||
      paymentStatusRaw === 'cancelled'
        ? paymentStatusRaw
        : 'completed';
    const methodLabel = paymentModeToMethodLabel(paymentMode);
    const { ledgerAmount, validationError } = resolvePosPaymentLedgerAmount({
      grandTotal,
      tenderedAmount: paymentAmount,
      paymentMode,
      paymentStatus: initialPaymentStatus,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const addressRaw = body.address;
    const address =
      typeof addressRaw === 'string' && addressRaw.trim() !== ''
        ? addressRaw.trim()
        : null;

    const taxRaw = Number(body.taxAmount);
    const taxAmount =
      Number.isFinite(taxRaw) && taxRaw >= 0 ? taxRaw : 0;

    const discRaw = Number(body.discountAmount);
    const discountAmount =
      Number.isFinite(discRaw) && discRaw >= 0 ? discRaw : 0;

    const serviceChargeRaw = Number(body.serviceChargeAmount);
    const claimedServiceCharge =
      Number.isFinite(serviceChargeRaw) && serviceChargeRaw >= 0
        ? serviceChargeRaw
        : 0;

    const restaurantCharges = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
        ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
        dineInPaymentTiming: true,
      },
    });
    const fulfillmentSettings = parseRestaurantFulfillmentSettings(
      restaurantCharges
    );
    const expectedServiceCharge = resolveServiceChargeAmount(
      parseRestaurantServiceCharges(restaurantCharges),
      'pos'
    );
    if (Math.abs(claimedServiceCharge - expectedServiceCharge) > 0.02) {
      return NextResponse.json(
        { error: 'Service charge does not match restaurant settings' },
        { status: 400 }
      );
    }

    const customerNameTrim =
      typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const customerPhoneTrim =
      typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';

    const tableIdRaw =
      typeof (body as { tableId?: unknown }).tableId === 'string'
        ? (body as { tableId: string }).tableId.trim()
        : '';
    let diningTableId: string | null = null;
    let tableLabel: string | null = null;
    if (tableIdRaw) {
      const diningTable = await findDiningTableForBranch(
        tableIdRaw,
        restaurantId,
        branchId
      );
      if (!diningTable) {
        return NextResponse.json({ error: 'Invalid table selection' }, { status: 400 });
      }
      diningTableId = diningTable.id;
      tableLabel = diningTable.name;
    }

    if (tableIdRaw && !fulfillmentSettings.dineInEnabled) {
      return NextResponse.json(
        { error: 'Dine-in orders are not enabled for this restaurant' },
        { status: 403 }
      );
    }
    if (address && !fulfillmentSettings.deliveryEnabled) {
      return NextResponse.json(
        { error: 'Delivery orders are not enabled for this restaurant' },
        { status: 403 }
      );
    }
    if (
      (paymentMode === 'card' || paymentMode === 'card_terminal') &&
      !fulfillmentSettings.cardPaymentsEnabled
    ) {
      return NextResponse.json(
        { error: 'Card payments are not enabled for this restaurant' },
        { status: 403 }
      );
    }

    // Pay-before-kitchen: table orders must be paid at POS (card terminal may stay
    // pending until the terminal callback completes payment).
    if (
      diningTableId &&
      initialPaymentStatus === 'pending' &&
      paymentMode !== 'card_terminal' &&
      isDineInPayBeforeKitchen(restaurantCharges?.dineInPaymentTiming)
    ) {
      return NextResponse.json(
        {
          error:
            'This restaurant requires payment before table orders go to the kitchen. Collect payment at the POS first, or switch Settings → Payments → “Pay when guest leaves”.',
        },
        { status: 400 }
      );
    }

    const normalizedItems = await normalizePosOrderLines({
      restaurantId,
      items,
      db,
    });
    if (!normalizedItems) {
      return NextResponse.json(
        { error: 'No valid menu items found in cart' },
        { status: 400 }
      );
    }

    let customerId: string | undefined;
    if (customerPhoneTrim) {
      const displayName = customerNameTrim || 'Walk-in';
      const existing = await db.customer.findFirst({
        where: {
          restaurantId,
          phone: customerPhoneTrim,
        },
        select: { id: true, name: true },
      });
      if (existing) {
        if (customerNameTrim && customerNameTrim !== existing.name) {
          await db.customer.update({
            where: { id: existing.id },
            data: { name: customerNameTrim },
          });
        }
        customerId = existing.id;
      } else {
        const created = await db.customer.create({
          data: {
            name: displayName,
            phone: customerPhoneTrim,
            restaurantId,
          },
          select: { id: true },
        });
        customerId = created.id;
      }
    }

    const result = await db.$transaction(
      async (tx) => {
        const openShift = await getOpenPosShift({
          restaurantId,
          branchId,
        });
        if (!openShift) {
          throw new Error('NO_ACTIVE_SHIFT');
        }

        const ticketDate = utcTicketDateFromNow();
        let ticketNumber = await allocateTicketNumber(tx, {
          restaurantId,
          ticketDate,
          branchId,
        });

        let order: Awaited<ReturnType<typeof tx.order.create>> | undefined;
        for (let attempt = 0; attempt < 8; attempt++) {
          try {
            order = await tx.order.create({
              data: {
                restaurantId,
                branchId,
                customerId,
                ticketDate,
                ticketNumber,
                status: 'pending',
                total: grandTotal,
                sourceType: OrderSourceType.POS,
                address,
                taxAmount,
                discountAmount,
                serviceChargeAmount: expectedServiceCharge,
                diningTableId,
                tableLabel,
                posShiftId: openShift.id,
                ...(idempotencyKey ? { idempotencyKey } : {}),
              },
            });
            break;
          } catch (e) {
            if (isPrismaUniqueViolation(e) && idempotencyKey) {
              throw e;
            }
            if (!isTicketNumberConflict(e) || attempt >= 7) throw e;
            ticketNumber += 1;
          }
        }

        if (!order) {
          throw new Error('Failed to create order after ticket retries');
        }

        await createOrderItemsWithModifiers(tx, order.id, normalizedItems);

        await consumeIngredientsForOrder(tx, {
          restaurantId,
          branchId: order.branchId,
          orderId: order.id,
          createdByUserId: auth.userId,
          lines: normalizedItems.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            variationId: line.variationId,
            modifiers: line.modifiers,
          })),
        });

        // Kitchen ticket is created from POS via /api/restaurant/kds/tickets after
        // staff enters prep time (skips KDS Manager queue).

        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: ledgerAmount,
            status: initialPaymentStatus,
            method: methodLabel,
            restaurantId,
          },
        });

        return { order, ticketNumber };
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    // Table place: kitchen ticket (and KDS UI) comes on a follow-up POST — don't
    // fan out kds/order_display yet. Keep inventory + recent for stock/shift only.
    publishOrderLifecycleUpdate({
      restaurantId,
      branchId: result.order.branchId,
      exclude: diningTableId
        ? [
            'kiosk.pending_cash',
            'dashboard.analytics',
            'kds.tickets',
            'kds.manager',
            'order_display',
            'sales.orders',
          ]
        : ['dashboard.analytics', 'kiosk.pending_cash'],
    });

    return NextResponse.json(
      {
        id: result.order.id,
        shortOrderId: result.order.shortOrderId,
        ticketNumber: result.ticketNumber,
        data: {
          orderId: result.order.id,
          shortOrderId: result.order.shortOrderId,
          restaurantId,
          ticketNumber: result.ticketNumber,
        },
        message: 'POS order saved',
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof Error && e.message === 'NO_ACTIVE_SHIFT') {
      return NextResponse.json(
        { error: 'Start a new shift before creating orders.' },
        { status: 409 }
      );
    }
    if (isMajorIngredientOutOfStockError(e)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof Error && e.message.includes('Select a variation')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (isPrismaUniqueViolation(e)) {
      const recovered = await recoverOrderFromIdempotencyConflict(
        idempotencyKey,
        restaurantId
      );
      if (recovered) {
        const body = await recovered.json();
        const data = (body as { data?: Record<string, unknown> }).data;
        return NextResponse.json(
          {
            id: data?.orderId,
            shortOrderId: data?.shortOrderId,
            ticketNumber: data?.ticketNumber ?? null,
            data,
            message: 'POS order already saved',
          },
          { status: 200 }
        );
      }
    }
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to save POS order' },
      { status: 500 }
    );
  }
}
