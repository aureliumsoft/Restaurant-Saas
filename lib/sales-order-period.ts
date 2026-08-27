import { Prisma } from '@prisma/client';

import type { db } from '@/lib/db';
import { getOrderDisplayTimezone } from '@/lib/order-display-timezone';
import type { SalesOrdersPeriodFilter } from '@/types/sales-order';

export function parseSalesOrdersPeriod(
  value: string | null
): SalesOrdersPeriodFilter {
  return value === 'today' ? 'today' : 'overall';
}

/** Non-owner/admin users are limited to today's data. */
export function enforceSalesOrdersPeriod(
  requested: SalesOrdersPeriodFilter,
  canViewHistorical: boolean
): SalesOrdersPeriodFilter {
  return canViewHistorical ? requested : 'today';
}

export function enforceAnalyticsDays(
  requested: number,
  canViewHistorical: boolean,
  advancedAnalytics: boolean
): number {
  if (!canViewHistorical) return 1;
  if (!advancedAnalytics) return 7;
  return requested === 14 || requested === 30 ? requested : 7;
}

export function salesOrderFilterTimezone(): string {
  return getOrderDisplayTimezone();
}

/** Calendar YYYY-MM-DD for a Date in an IANA timezone (no DB round-trip). */
export function calendarDayKeyInTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Last `n` calendar day keys ending today in `timeZone` (oldest → newest). */
export function lastNCalendarDayKeys(n: number, timeZone: string): string[] {
  const today = calendarDayKeyInTimezone(new Date(), timeZone);
  const [y, m, d] = today.split('-').map(Number);
  if (!y || !m || !d) {
    return Array.from({ length: n }, (_, i) => {
      const dt = new Date();
      dt.setUTCDate(dt.getUTCDate() - (n - 1 - i));
      return dt.toISOString().slice(0, 10);
    });
  }
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    keys.push(dt.toISOString().slice(0, 10));
  }
  return keys;
}

/** Calendar date (YYYY-MM-DD) for "now" in the given IANA timezone. */
export async function getTodayDayKeyInTimezone(
  database: typeof db,
  tz: string
): Promise<string> {
  const rows = await database.$queryRaw<Array<{ d: string }>>(
    Prisma.sql`SELECT (timezone(${tz}::text, now()))::date::text AS d`
  );
  return rows[0]?.d ?? calendarDayKeyInTimezone(new Date(), tz);
}

/** UTC instants for the start (inclusive) and end (exclusive) of today in `tz`. */
export async function getTodayCreatedAtBounds(
  database: typeof db,
  tz: string
): Promise<{ gte: Date; lt: Date }> {
  const rows = await database.$queryRaw<Array<{ gte: Date; lt: Date }>>(
    Prisma.sql`
      SELECT
        (date_trunc('day', timezone(${tz}::text, now())) AT TIME ZONE ${tz}::text) AS gte,
        ((date_trunc('day', timezone(${tz}::text, now())) + interval '1 day') AT TIME ZONE ${tz}::text) AS lt
    `
  );
  const row = rows[0];
  if (!row) {
    const now = new Date();
    return { gte: now, lt: now };
  }
  return row;
}

export function prismaCreatedAtTodayWhere(bounds: { gte: Date; lt: Date }) {
  return { createdAt: { gte: bounds.gte, lt: bounds.lt } };
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
