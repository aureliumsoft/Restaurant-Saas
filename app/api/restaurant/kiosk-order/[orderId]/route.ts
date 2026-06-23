import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import { db } from '@/lib/db';
import {
  normalizePosOrderLines,
  paymentMethodToMode,
  type PosOrderLineInput,
} from '@/lib/pos-order-lines';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  resolveServiceChargeAmount,
} from '@/lib/restaurant-service-charge';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

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
      menuItem: { select: { name: true, imageUrl: true } },
      modifiers: {
        select: { name: true, unitPrice: true },
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
    menuItemId: string;
    quantity: number;
    price: number;
    menuItem: { name: string; imageUrl: string | null };
    modifiers: Array<{ name: string; unitPrice: number }>;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
  }>;
}) {
  const payment = order.payments[0] ?? null;
  return {
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
    paymentStatus: payment?.status ?? 'pending',
    paymentMethod: payment?.method ?? 'Cash',
    paymentMode: paymentMethodToMode(payment?.method),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      quantity: item.quantity,
      unitPrice: Number(item.price) || 0,
      imageUrl: item.menuItem.imageUrl,
      modifiers: item.modifiers.map((modifier) => ({
        name: modifier.name,
        unitPrice: Number(modifier.unitPrice) || 0,
      })),
    })),
  };
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

    const { orderId } = await ctx.params;
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: auth.restaurantId,
        sourceType: OrderSourceType.KIOSK,
      },
      select: orderSelect,
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data: mapOrderDetail(order) });
  } catch (error) {
    console.error('kiosk-order GET', error);
    return NextResponse.json(
      { error: 'Failed to load kiosk order' },
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

    const { orderId } = await ctx.params;
    const existing = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: auth.restaurantId,
        sourceType: OrderSourceType.KIOSK,
      },
      select: {
        id: true,
        status: true,
        branchId: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true },
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
      'kiosk'
    );
    if (Math.abs(claimedServiceCharge - expectedServiceCharge) > 0.02) {
      return NextResponse.json(
        { error: 'Service charge does not match restaurant settings' },
        { status: 400 }
      );
    }

    const taxRaw = Number(body.taxAmount);
    const taxAmount = Number.isFinite(taxRaw) && taxRaw >= 0 ? taxRaw : 0;
    const discRaw = Number(body.discountAmount);
    const discountAmount =
      Number.isFinite(discRaw) && discRaw >= 0 ? discRaw : 0;

    await db.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      await tx.orderItem.createMany({
        data: normalizedItems.map((line) => ({
          orderId: existing.id,
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          price: line.price,
        })),
      });

      await tx.order.update({
        where: { id: existing.id },
        data: {
          total: grandTotal,
          taxAmount,
          discountAmount,
          serviceChargeAmount: expectedServiceCharge,
        },
      });

      const paymentId = existing.payments[0]?.id;
      const paymentStatus = existing.payments[0]?.status ?? 'pending';
      if (paymentId) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            amount: grandTotal,
            status:
              paymentStatus === 'completed' || paymentStatus === 'complete'
                ? paymentStatus
                : 'pending',
            method: 'Cash',
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

    return NextResponse.json({
      data: mapOrderDetail(updated),
      message: 'Kiosk order updated',
    });
  } catch (error) {
    console.error('kiosk-order PATCH', error);
    return NextResponse.json(
      { error: 'Failed to update kiosk order' },
      { status: 500 }
    );
  }
}
