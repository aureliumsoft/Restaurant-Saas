import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import { findDiningTableForBranch } from '@/lib/dining-tables-query';
import { db } from '@/lib/db';
import { resolvePosPaymentLedgerAmount } from '@/lib/order-payment';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';
import {
  normalizePosOrderLines,
  paymentMethodToMode,
  paymentModeToMethodLabel,
  type PosOrderLineInput,
} from '@/lib/pos-order-lines';
import { createOrderItemsWithModifiers } from '@/lib/pos-order-modifiers';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  resolveServiceChargeAmount,
} from '@/lib/restaurant-service-charge';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';
import { publishOrderLifecycleUpdate } from '@/lib/realtime/publish';
import { resolveRouteParams } from '@/lib/resolve-route-id';
import { withUrlId } from '@/lib/with-url-id';

const orderSelect = {
  id: true,
  shortOrderId: true,
  ticketNumber: true,
  total: true,
  status: true,
  taxAmount: true,
  discountAmount: true,
  serviceChargeAmount: true,
  address: true,
  diningTableId: true,
  tableLabel: true,
  createdAt: true,
  customer: { select: { name: true, phone: true } },
  items: {
    select: {
      id: true,
      menuItemId: true,
      quantity: true,
      price: true,
      productName: true,
      menuItem: { select: { name: true, imageUrl: true } },
      modifiers: {
        select: { name: true, unitPrice: true, menuItemId: true, quantity: true },
      },
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { id: true, amount: true, status: true, method: true },
  },
} as const;

function mapOrderDetail(order: {
  id: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  taxAmount: number;
  discountAmount: number;
  serviceChargeAmount: number;
  address: string | null;
  diningTableId: string | null;
  tableLabel: string | null;
  createdAt: Date;
  customer: { name: string; phone: string | null } | null;
  items: Array<{
    id: string;
    menuItemId: string | null;
    quantity: number;
    price: number;
    productName: string | null;
    menuItem: { name: string; imageUrl: string | null } | null;
    modifiers: Array<{ name: string; unitPrice: number; menuItemId: string | null; quantity: number }>;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
  }>;
}) {
  const payment = order.payments[0] ?? null;
  return withUrlId({
    id: order.id,
    shortOrderId: order.shortOrderId,
    ticketNumber: order.ticketNumber,
    total: Number(order.total) || 0,
    status: order.status,
    taxAmount: Number(order.taxAmount) || 0,
    discountAmount: Number(order.discountAmount) || 0,
    serviceChargeAmount: Number(order.serviceChargeAmount) || 0,
    address: order.address,
    tableId: order.diningTableId,
    tableLabel: order.tableLabel,
    customerName: order.customer?.name ?? null,
    customerPhone: order.customer?.phone ?? null,
    paymentId: payment?.id ?? null,
    paymentAmount: payment?.amount ?? (Number(order.total) || 0),
    paymentStatus: payment?.status ?? 'completed',
    paymentMethod: payment?.method ?? 'Cash',
    paymentMode: paymentMethodToMode(payment?.method),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: orderItemDisplayName(item),
      quantity: item.quantity,
      unitPrice: Number(item.price) || 0,
      imageUrl: item.menuItem?.imageUrl ?? null,
      modifiers: item.modifiers.map((modifier) => ({
        name: modifier.name,
        unitPrice: Number(modifier.unitPrice) || 0,
        menuItemId: modifier.menuItemId,
        quantity: modifier.quantity,
      })),
    })),
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'access',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { orderId } = await resolveRouteParams(ctx.params, ['orderId']);
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: auth.restaurantId,
        sourceType: {
          in: [
            OrderSourceType.POS,
            OrderSourceType.KIOSK,
            OrderSourceType.ONLINE,
          ],
        },
      },
      select: orderSelect,
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data: mapOrderDetail(order) });
  } catch (error) {
    console.error('pos-order GET', error);
    return NextResponse.json(
      { error: 'Failed to load POS order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { orderId } = await resolveRouteParams(ctx.params, ['orderId']);
    const existing = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: auth.restaurantId,
        sourceType: OrderSourceType.POS,
      },
      select: {
        id: true,
        status: true,
        branchId: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const status = String(existing.status ?? '').toLowerCase();
    if (status === 'canceled' || status === 'cancelled' || status === 'failed') {
      return NextResponse.json(
        { error: 'Canceled orders cannot be edited.' },
        { status: 409 }
      );
    }

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

    const items = Array.isArray(body.items)
      ? (body.items as PosOrderLineInput[])
      : [];
    const normalizedItems = await normalizePosOrderLines({
      restaurantId: auth.restaurantId,
      items,
      db,
    });
    if (!normalizedItems) {
      return NextResponse.json(
        { error: 'No valid menu items found in cart' },
        { status: 400 }
      );
    }

    const branchScope = await getBranchScopeFromRequest(
      req,
      auth.userId,
      auth.restaurantId
    );
    let branchId: string | null =
      typeof body.branchId === 'string' && body.branchId.trim()
        ? body.branchId.trim()
        : existing.branchId ?? branchScope?.activeBranchId ?? null;
    if (branchId) {
      const ok = await validateBranchForRestaurant(branchId, auth.restaurantId);
      if (!ok) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
    }

    const paymentMode =
      typeof body.paymentMode === 'string' ? body.paymentMode : 'cash';
    const paymentStatusRaw =
      typeof body.paymentStatus === 'string'
        ? body.paymentStatus.trim().toLowerCase()
        : '';
    const paymentStatus =
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
      paymentStatus,
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
    const taxAmount = Number.isFinite(taxRaw) && taxRaw >= 0 ? taxRaw : 0;
    const discRaw = Number(body.discountAmount);
    const discountAmount =
      Number.isFinite(discRaw) && discRaw >= 0 ? discRaw : 0;
    const serviceChargeRaw = Number(body.serviceChargeAmount);
    const claimedServiceCharge =
      Number.isFinite(serviceChargeRaw) && serviceChargeRaw >= 0
        ? serviceChargeRaw
        : 0;

    const restaurantCharges = await db.restaurant.findUnique({
      where: { id: auth.restaurantId },
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
      typeof body.tableId === 'string' ? body.tableId.trim() : '';
    let diningTableId: string | null = null;
    let tableLabel: string | null = null;
    if (tableIdRaw) {
      const diningTable = await findDiningTableForBranch(
        tableIdRaw,
        auth.restaurantId,
        branchId
      );
      if (!diningTable) {
        return NextResponse.json(
          { error: 'Invalid table selection' },
          { status: 400 }
        );
      }
      diningTableId = diningTable.id;
      tableLabel = diningTable.name;
    }

    let customerId: string | undefined;
    if (customerPhoneTrim) {
      const displayName = customerNameTrim || 'Walk-in';
      const existingCustomer = await db.customer.findFirst({
        where: { restaurantId: auth.restaurantId, phone: customerPhoneTrim },
        select: { id: true, name: true },
      });
      if (existingCustomer) {
        if (customerNameTrim && customerNameTrim !== existingCustomer.name) {
          await db.customer.update({
            where: { id: existingCustomer.id },
            data: { name: customerNameTrim },
          });
        }
        customerId = existingCustomer.id;
      } else {
        const created = await db.customer.create({
          data: {
            name: displayName,
            phone: customerPhoneTrim,
            restaurantId: auth.restaurantId,
          },
          select: { id: true },
        });
        customerId = created.id;
      }
    }

    await db.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      await createOrderItemsWithModifiers(tx, existing.id, normalizedItems);

      await tx.order.update({
        where: { id: existing.id },
        data: {
          branchId,
          customerId: customerId ?? null,
          total: grandTotal,
          address,
          taxAmount,
          discountAmount,
          serviceChargeAmount: expectedServiceCharge,
          diningTableId,
          tableLabel,
        },
      });

      const paymentId = existing.payments[0]?.id;
      if (paymentId) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            amount: ledgerAmount,
            status: paymentStatus,
            method: methodLabel,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: existing.id,
            amount: ledgerAmount,
            status: paymentStatus,
            method: methodLabel,
            restaurantId: auth.restaurantId,
          },
        });
      }
    });

    const updated = await db.order.findFirst({
      where: { id: existing.id },
      select: orderSelect,
    });
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    publishOrderLifecycleUpdate({
      restaurantId: auth.restaurantId,
      branchId,
    });

    return NextResponse.json({
      data: mapOrderDetail(updated),
      message: 'POS order updated',
    });
  } catch (error) {
    console.error('pos-order PATCH', error);
    return NextResponse.json(
      { error: 'Failed to update POS order' },
      { status: 500 }
    );
  }
}
