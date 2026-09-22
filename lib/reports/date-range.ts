import { Prisma } from '@prisma/client';

import type { db } from '@/lib/db';
import {
  calendarDayKeyInTimezone,
  getTodayCreatedAtBounds,
  getTodayDayKeyInTimezone,
  salesOrderFilterTimezone,
} from '@/lib/sales-order-period';

export type ReportDateRange = {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
};

function startOfUtcDayFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0));
}

function endOfUtcDayFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));
}

/** Parse YYYY-MM-DD (or ISO) into a calendar day key. */
export function parseDayKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve report date range.
 * Owners: default last 30 calendar days (inclusive).
 * Non-owners: forced to today only.
 */
export async function resolveReportDateRange(opts: {
  database: typeof db;
  canViewHistorical: boolean;
  fromParam?: string | null;
  toParam?: string | null;
}): Promise<ReportDateRange> {
  const tz = salesOrderFilterTimezone();
  const todayKey = await getTodayDayKeyInTimezone(opts.database, tz);

  if (!opts.canViewHistorical) {
    const bounds = await getTodayCreatedAtBounds(opts.database, tz);
    return {
      from: bounds.gte,
      to: new Date(bounds.lt.getTime() - 1),
      fromKey: todayKey,
      toKey: todayKey,
    };
  }

  let toKey = parseDayKey(opts.toParam) ?? todayKey;
  let fromKey = parseDayKey(opts.fromParam);
  if (!fromKey) {
    const [y, m, d] = todayKey.split('-').map(Number);
    const start = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) - 29));
    fromKey = start.toISOString().slice(0, 10);
  }
  if (fromKey > toKey) {
    const tmp = fromKey;
    fromKey = toKey;
    toKey = tmp;
  }

  return {
    from: startOfUtcDayFromKey(fromKey),
    to: endOfUtcDayFromKey(toKey),
    fromKey,
    toKey,
  };
}

/** Prisma createdAt range (inclusive end-of-day). */
export function prismaCreatedAtRangeWhere(range: ReportDateRange) {
  return { createdAt: { gte: range.from, lte: range.to } };
}

export function prismaPaidAtRangeWhere(range: ReportDateRange) {
  return { paidAt: { gte: range.from, lte: range.to } };
}

/** SQL fragment for Order.createdAt in range. */
export function orderCreatedAtRangeSql(range: ReportDateRange): Prisma.Sql {
  return Prisma.sql`AND o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}`;
}

export function transactionCreatedAtRangeSql(range: ReportDateRange): Prisma.Sql {
  return Prisma.sql`AND t."createdAt" >= ${range.from} AND t."createdAt" <= ${range.to}`;
}

export function subscriptionPaidAtRangeSql(range: ReportDateRange): Prisma.Sql {
  return Prisma.sql`AND s."paidAt" >= ${range.from} AND s."paidAt" <= ${range.to}`;
}

export function defaultReportFromToKeys(canViewHistorical: boolean): {
  from: string;
  to: string;
} {
  const tz = salesOrderFilterTimezone();
  const today = calendarDayKeyInTimezone(new Date(), tz);
  if (!canViewHistorical) {
    return { from: today, to: today };
  }
  const [y, m, d] = today.split('-').map(Number);
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) - 29));
  return { from: start.toISOString().slice(0, 10), to: today };
}
