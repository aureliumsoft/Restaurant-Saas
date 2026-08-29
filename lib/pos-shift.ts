import { OrderSourceType, PosShiftStatus, type Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { isCanceledOrderStatus } from '@/lib/sales-order-status';

export type PosShiftOrderRow = {
  id: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  paymentMethod: string | null;
  paymentAmount: number | null;
  createdAt: string;
  customerName: string | null;
};

export type PosShiftPayload = {
  id: string;
  status: PosShiftStatus;
  startedAt: string;
  endedAt: string | null;
  closingCashInLocker: number | null;
  branchId: string | null;
  openedByName: string | null;
  closedByName: string | null;
  orderCount: number;
  totalSales: number;
  cashSalesTotal: number;
  nonCashSalesTotal: number;
  previousClosingCashInLocker: number | null;
  previousShiftEndedAt: string | null;
  expectedCashInLocker: number;
  orders: PosShiftOrderRow[];
};

export type PosShiftSummary = {
  id: string | null;
  orderCount: number;
  lastClosingCashInLocker: number | null;
  lastShiftEndedAt: string | null;
  /** Expected cash in locker (opening float + cash sales this shift). */
  cashInLocker: number | null;
};

const completedPaymentWhere = {
  payments: {
    some: {
      status: { in: ['completed', 'complete'] },
    },
  },
} satisfies Prisma.OrderWhereInput;

function isCashPayment(method: string | null): boolean {
  if (!method) return false;
  const normalized = method.toLowerCase();
  return normalized === 'cash' || normalized.includes('cash');
}

async function getPreviousClosedShift(params: {
  restaurantId: string;
  branchId: string | null;
  beforeDate?: Date;
}) {
  return db.posShift.findFirst({
    where: {
      restaurantId: params.restaurantId,
      branchId: params.branchId,
      status: PosShiftStatus.CLOSED,
      closingCashInLocker: { not: null },
      ...(params.beforeDate ? { endedAt: { lt: params.beforeDate } } : {}),
    },
    orderBy: { endedAt: 'desc' },
    select: {
      closingCashInLocker: true,
      endedAt: true,
    },
  });
}

export async function getOpenPosShift(params: {
  restaurantId: string;
  branchId: string | null;
}) {
  const { restaurantId, branchId } = params;
  return db.posShift.findFirst({
    where: {
      restaurantId,
      branchId,
      status: PosShiftStatus.OPEN,
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });
}

export async function openPosShift(params: {
  restaurantId: string;
  branchId: string | null;
  userId: string;
}) {
  const { restaurantId, branchId, userId } = params;

  const existing = await getOpenPosShift({ restaurantId, branchId });
  if (existing) {
    return null;
  }

  return db.posShift.create({
    data: {
      restaurantId,
      branchId,
      openedByUserId: userId,
      status: PosShiftStatus.OPEN,
    },
  });
}

async function loadShiftOrders(shiftId: string): Promise<PosShiftOrderRow[]> {
  const orders = await db.order.findMany({
    where: {
      posShiftId: shiftId,
      sourceType: { in: [OrderSourceType.POS, OrderSourceType.KIOSK] },
      OR: [
        completedPaymentWhere,
        {
          status: { in: ['canceled', 'cancelled'] },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      shortOrderId: true,
      ticketNumber: true,
      total: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { method: true, amount: true },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    shortOrderId: order.shortOrderId,
    ticketNumber: order.ticketNumber,
    total: Number(order.total) || 0,
    status: order.status,
    paymentMethod: order.payments[0]?.method ?? null,
    paymentAmount: order.payments[0]?.amount ?? null,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customer?.name ?? null,
  }));
}

async function getShiftCashSalesTotal(shiftId: string): Promise<number> {
  const orders = await db.order.findMany({
    where: {
      posShiftId: shiftId,
      sourceType: { in: [OrderSourceType.POS, OrderSourceType.KIOSK] },
      ...completedPaymentWhere,
    },
    select: {
      total: true,
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { method: true },
      },
    },
  });

  return orders.reduce((sum, order) => {
    if (!isCashPayment(order.payments[0]?.method ?? null)) return sum;
    return sum + (Number(order.total) || 0);
  }, 0);
}

export async function buildPosShiftSummary(params: {
  restaurantId: string;
  branchId: string | null;
}): Promise<PosShiftSummary> {
  const { restaurantId, branchId } = params;

  const [openShift, lastClosedShift] = await Promise.all([
    getOpenPosShift({ restaurantId, branchId }),
    getPreviousClosedShift({ restaurantId, branchId }),
  ]);

  if (!openShift) {
    return {
      id: null,
      orderCount: 0,
      lastClosingCashInLocker: lastClosedShift?.closingCashInLocker ?? null,
      lastShiftEndedAt: lastClosedShift?.endedAt?.toISOString() ?? null,
      cashInLocker: lastClosedShift?.closingCashInLocker ?? null,
    };
  }

  const [orderCount, cashSalesTotal] = await Promise.all([
    db.order.count({
      where: {
        posShiftId: openShift.id,
        sourceType: { in: [OrderSourceType.POS, OrderSourceType.KIOSK] },
        ...completedPaymentWhere,
      },
    }),
    getShiftCashSalesTotal(openShift.id),
  ]);

  const openingCash = lastClosedShift?.closingCashInLocker ?? 0;

  return {
    id: openShift.id,
    orderCount,
    lastClosingCashInLocker: lastClosedShift?.closingCashInLocker ?? null,
    lastShiftEndedAt: lastClosedShift?.endedAt?.toISOString() ?? null,
    cashInLocker: openingCash + cashSalesTotal,
  };
}

export async function buildPosShiftPayload(
  shiftId: string,
  options?: { restaurantId?: string; branchId?: string | null }
): Promise<PosShiftPayload | null> {
  const shift = await db.posShift.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      closingCashInLocker: true,
      branchId: true,
      restaurantId: true,
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });
  if (!shift) return null;

  const orders = await loadShiftOrders(shiftId);
  const completedOrders = orders.filter(
    (row) => !isCanceledOrderStatus(row.status)
  );
  const totalSales = completedOrders.reduce((sum, row) => sum + row.total, 0);
  const cashSalesTotal = completedOrders.reduce(
    (sum, row) => sum + (isCashPayment(row.paymentMethod) ? row.total : 0),
    0
  );
  const nonCashSalesTotal = Math.max(0, totalSales - cashSalesTotal);

  const previousShift = await getPreviousClosedShift({
    restaurantId: options?.restaurantId ?? shift.restaurantId,
    branchId: options?.branchId ?? shift.branchId,
    beforeDate:
      shift.status === PosShiftStatus.CLOSED ? shift.startedAt : undefined,
  });

  const previousClosingCashInLocker =
    previousShift?.closingCashInLocker ?? null;
  const previousShiftEndedAt =
    previousShift?.endedAt?.toISOString() ?? null;
  const previousCash = previousClosingCashInLocker ?? 0;
  const expectedCashInLocker = previousCash + cashSalesTotal;

  return {
    id: shift.id,
    status: shift.status,
    startedAt: shift.startedAt.toISOString(),
    endedAt: shift.endedAt?.toISOString() ?? null,
    closingCashInLocker: shift.closingCashInLocker,
    branchId: shift.branchId,
    openedByName: shift.openedBy?.name ?? null,
    closedByName: shift.closedBy?.name ?? null,
    orderCount: completedOrders.length,
    totalSales,
    cashSalesTotal,
    nonCashSalesTotal,
    previousClosingCashInLocker,
    previousShiftEndedAt,
    expectedCashInLocker,
    orders,
  };
}

export async function closePosShift(params: {
  shiftId: string;
  restaurantId: string;
  userId: string;
  closingCashInLocker: number;
  notes?: string | null;
}) {
  const shift = await db.posShift.findFirst({
    where: {
      id: params.shiftId,
      restaurantId: params.restaurantId,
      status: PosShiftStatus.OPEN,
    },
    select: { id: true },
  });
  if (!shift) return null;

  await db.posShift.update({
    where: { id: shift.id },
    data: {
      status: PosShiftStatus.CLOSED,
      endedAt: new Date(),
      closedByUserId: params.userId,
      closingCashInLocker: params.closingCashInLocker,
      notes: params.notes?.trim() || null,
    },
  });

  return buildPosShiftPayload(shift.id);
}
