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
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { resolvePosPaymentLedgerAmount } from '@/lib/order-payment';
import { getOrOpenPosShift } from '@/lib/pos-shift';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';

import {
  normalizePosOrderLines,
  paymentModeToMethodLabel,
  type PosOrderLineInput,
} from '@/lib/pos-order-lines';
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
      select: RESTAURANT_SERVICE_CHARGE_DB_SELECT,
    });
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
        const activeShift = await getOrOpenPosShift({
          restaurantId,
          branchId,
          userId: auth.userId,
        });

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
                posShiftId: activeShift.id,
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

        await tx.orderItem.createMany({
          data: normalizedItems.map((line) => ({
            orderId: order?.id ?? '',
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            price: line.price,
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

    publishOrderLifecycleUpdate({
      restaurantId,
      branchId: result.order.branchId,
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
