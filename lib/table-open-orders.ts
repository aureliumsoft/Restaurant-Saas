import type { Prisma } from '@prisma/client';
import { OrderSourceType } from '@prisma/client';

import { orderBranchWhere } from '@/lib/branch/branch-scope';
import { db } from '@/lib/db';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';

const CANCELED: string[] = [
  'canceled',
  'cancelled',
  'failed',
  'cancel',
];

/** Open table tabs: unpaid and/or not yet sent to kitchen. */
export function openTableOrdersWhere(
  restaurantId: string,
  branchId: string | null
): Prisma.OrderWhereInput {
  return {
    restaurantId,
    diningTableId: { not: null },
    status: { notIn: CANCELED },
    ...orderBranchWhere(branchId),
    OR: [
      {
        payments: {
          some: {
            status: { equals: 'pending', mode: 'insensitive' },
          },
        },
      },
      {
        kitchenTickets: {
          none: {
            status: { notIn: ['canceled', 'cancelled'] },
          },
        },
      },
    ],
  };
}

function isPendingPaymentStatus(status: string | null | undefined): boolean {
  return String(status ?? 'pending').toLowerCase() === 'pending';
}

export type OpenTableOrderLine = {
  quantity: number;
  name: string;
};

export type OpenTableOrderRow = {
  id: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  status: string;
  sourceType: string;
  tableLabel: string | null;
  diningTableId: string;
  createdAt: string;
  kitchenSent: boolean;
  /** Active kitchen ticket status when sent (making, ready, etc.). */
  kitchenStatus: string | null;
  customerName: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  itemCount: number;
  items: OpenTableOrderLine[];
};

export type OpenTableCard = {
  diningTableId: string;
  tableLabel: string;
  orderCount: number;
  /** Sum of tickets still awaiting payment. */
  totalDue: number;
  unpaidCount: number;
  kitchenPendingCount: number;
  kitchenSentCount: number;
  sources: string[];
  orders: OpenTableOrderRow[];
};

export async function loadOpenTableOrderCards(opts: {
  restaurantId: string;
  branchId: string | null;
}): Promise<OpenTableCard[]> {
  const orders = await db.order.findMany({
    where: openTableOrdersWhere(opts.restaurantId, opts.branchId),
    orderBy: [{ createdAt: 'asc' }],
    take: 200,
    select: {
      id: true,
      shortOrderId: true,
      ticketNumber: true,
      total: true,
      status: true,
      sourceType: true,
      tableLabel: true,
      diningTableId: true,
      createdAt: true,
      customer: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          productName: true,
          menuItem: { select: { name: true } },
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { method: true, status: true, amount: true },
      },
      kitchenTickets: {
        where: {
          status: {
            notIn: ['canceled', 'cancelled'],
          },
        },
        select: { id: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });

  const byTable = new Map<string, OpenTableOrderRow[]>();

  for (const o of orders) {
    if (!o.diningTableId) continue;
    const activeTicket = o.kitchenTickets[0] ?? null;
    const kitchenSent = Boolean(activeTicket);
    const row: OpenTableOrderRow = {
      id: o.id,
      shortOrderId: o.shortOrderId,
      ticketNumber: o.ticketNumber,
      total: Number(o.total) || 0,
      status: o.status,
      sourceType: String(o.sourceType),
      tableLabel: o.tableLabel,
      diningTableId: o.diningTableId,
      createdAt: o.createdAt.toISOString(),
      kitchenSent,
      kitchenStatus: activeTicket?.status ?? null,
      customerName: o.customer?.name ?? null,
      paymentMethod: o.payments[0]?.method ?? null,
      paymentStatus: o.payments[0]?.status ?? 'pending',
      itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
      items: o.items.map((it) => ({
        quantity: it.quantity,
        name: orderItemDisplayName(it),
      })),
    };
    const list = byTable.get(o.diningTableId) ?? [];
    list.push(row);
    byTable.set(o.diningTableId, list);
  }

  const cards: OpenTableCard[] = [];
  for (const [diningTableId, tableOrders] of byTable) {
    const tableLabel =
      tableOrders.find((o) => o.tableLabel)?.tableLabel?.trim() ||
      'Table';
    const sources = [
      ...new Set(tableOrders.map((o) => o.sourceType)),
    ];
    cards.push({
      diningTableId,
      tableLabel,
      orderCount: tableOrders.length,
      totalDue: tableOrders
        .filter((o) => isPendingPaymentStatus(o.paymentStatus))
        .reduce((s, o) => s + o.total, 0),
      unpaidCount: tableOrders.filter((o) =>
        isPendingPaymentStatus(o.paymentStatus)
      ).length,
      kitchenPendingCount: tableOrders.filter((o) => !o.kitchenSent).length,
      kitchenSentCount: tableOrders.filter((o) => o.kitchenSent).length,
      sources,
      orders: tableOrders,
    });
  }

  cards.sort((a, b) =>
    a.tableLabel.localeCompare(b.tableLabel, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );

  return cards;
}

export { OrderSourceType };
