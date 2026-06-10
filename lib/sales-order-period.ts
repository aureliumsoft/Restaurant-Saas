import { Prisma } from '@prisma/client';

import { getOrderDisplayTimezone } from '@/lib/order-display-timezone';
import type { SalesOrdersPeriodFilter } from '@/types/sales-order';

export function parseSalesOrdersPeriod(
  value: string | null
): SalesOrdersPeriodFilter {
  return value === 'today' ? 'today' : 'overall';
}

export function salesOrderFilterTimezone(): string {
  return getOrderDisplayTimezone();
}

/** Filter menu orders to the restaurant's current calendar day. */
export function salesOrderPeriodMenuSql(
  period: SalesOrdersPeriodFilter,
  tz: string
): Prisma.Sql {
  if (period !== 'today') return Prisma.empty;
  return Prisma.sql`AND (timezone(${tz}::text, o."createdAt"))::date = (timezone(${tz}::text, now()))::date`;
}

/** Filter POS sale transactions to the restaurant's current calendar day. */
export function salesOrderPeriodTransactionSql(
  period: SalesOrdersPeriodFilter,
  tz: string
): Prisma.Sql {
  if (period !== 'today') return Prisma.empty;
  return Prisma.sql`AND (timezone(${tz}::text, t."createdAt"))::date = (timezone(${tz}::text, now()))::date`;
}
