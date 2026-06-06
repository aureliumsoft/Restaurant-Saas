import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OrderSourceType } from '@prisma/client';

import {
  getBranchScopeFromRequest,
  validateBranchForRestaurant,
} from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

type LineInput = {
  productId: string;
  name?: string;
  qty: number;
  unitPrice: number;
  lineDiscPct: number;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await getRestaurantIdForRequest(req, {
      moduleKey: 'pos',
      action: 'edit',
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

    const items = Array.isArray(body.items) ? (body.items as LineInput[]) : [];
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
    const methodLabel =
      paymentMode === 'card'
        ? 'Card'
        : paymentMode === 'card_terminal'
          ? 'Card Terminal'
        : paymentMode === 'split'
          ? 'Split'
          : 'Cash';

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
      const diningTable = await db.diningTable.findFirst({
        where: { id: tableIdRaw, restaurantId },
        select: { id: true, name: true },
      });
      if (!diningTable) {
        return NextResponse.json({ error: 'Invalid table selection' }, { status: 400 });
      }
      diningTableId = diningTable.id;
      tableLabel = diningTable.name;
    }

    const baseProductIds = items.map((line) =>
      String(line.productId).split('::sw:')[0] ?? String(line.productId)
    );
    const menuItems = await db.menuItem.findMany({
      where: {
        restaurantId,
        id: { in: baseProductIds },
      },
      select: { id: true, name: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    const normalizedItems = items
      .map((line) => {
        const baseProductId =
          String(line.productId).split('::sw:')[0] ?? String(line.productId);
        const menu = menuMap.get(baseProductId);
        if (!menu) return null;

        const qty = Math.max(1, Math.floor(Number(line.qty) || 0));
        const unit = Number(line.unitPrice);
        const discPct = Math.min(100, Math.max(0, Number(line.lineDiscPct) || 0));
        if (Number.isNaN(unit)) return null;

        const unitAfterDisc = unit * (1 - discPct / 100);
        return {
          menuItemId: menu.id,
          productName:
            typeof line.name === 'string' && line.name.trim() !== ''
              ? line.name.trim()
              : menu.name,
          quantity: qty,
          price: unitAfterDisc,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    if (normalizedItems.length === 0) {
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

    const result = await db.$transaction(async (tx) => {
      const ticketDate = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate()
        )
      );
      const previousOrder = await tx.order.findFirst({
        where: {
          restaurantId,
          ticketDate,
          branchId,
        },
        orderBy: { ticketNumber: 'desc' },
        select: { ticketNumber: true },
      });
      const nextTicketNumber = (previousOrder?.ticketNumber ?? -1) + 1;

      const order = await tx.order.create({
        data: {
          restaurantId,
          branchId,
          customerId,
          ticketDate,
          ticketNumber: nextTicketNumber,
          status: 'pending',
          total: grandTotal,
          sourceType: OrderSourceType.POS,
          address,
          taxAmount,
          discountAmount,
          diningTableId,
          tableLabel,
        },
      });

      await tx.orderItem.createMany({
        data: normalizedItems.map((line) => ({
          orderId: order.id,
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
          amount: paymentAmount,
          status: initialPaymentStatus,
          method: methodLabel,
          restaurantId,
        },
      });

      return { order, ticketNumber: nextTicketNumber };
    });

    return NextResponse.json(
      {
        id: result.order.id,
        shortOrderId: result.order.shortOrderId,
        ticketNumber: result.ticketNumber,
        message: 'POS order saved',
      },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to save POS order' },
      { status: 500 }
    );
  }
}
