import { Prisma, type PrismaClient } from '@prisma/client';

import { db } from '@/lib/db';

function utcDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Assign a daily ticket number (starts from 1 each UTC date, per branch).
 * Uses SQL so it works even when Prisma client is stale.
 */
async function assignWithExecutor(
  exec: Prisma.TransactionClient | PrismaClient,
  orderId: string,
  restaurantId: string,
  branchId: string | null = null
): Promise<number | null> {
  const ticketDate = utcDateOnly(new Date());
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const rows = await exec.$queryRaw<Array<{ next: number }>>(
        branchId
          ? Prisma.sql`
          SELECT COALESCE(MAX("ticketNumber"), 0) + 1 AS next
          FROM "Order"
          WHERE "restaurantId" = ${restaurantId}::uuid
            AND "ticketDate" = ${ticketDate}::date
            AND "branchId" = ${branchId}::uuid
        `
          : Prisma.sql`
          SELECT COALESCE(MAX("ticketNumber"), 0) + 1 AS next
          FROM "Order"
          WHERE "restaurantId" = ${restaurantId}::uuid
            AND "ticketDate" = ${ticketDate}::date
            AND "branchId" IS NULL
        `
      );
      const ticketNumber = Number(rows[0]?.next ?? 1);
      await exec.$executeRaw(
        Prisma.sql`
          UPDATE "Order"
          SET "ticketDate" = ${ticketDate}::date,
              "ticketNumber" = ${ticketNumber}
          WHERE "id" = ${orderId}::uuid
        `
      );
      return ticketNumber;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // If concurrent request used same number, retry with next.
      if (/duplicate key value|unique constraint/i.test(msg)) continue;
      // If migration isn't applied yet, don't fail order creation.
      return null;
    }
  }
  return null;
}

/**
 * Use this inside an existing transaction only if absolutely necessary.
 */
export async function assignDailyTicketNumber(
  tx: Prisma.TransactionClient,
  orderId: string,
  restaurantId: string,
  branchId: string | null = null
): Promise<number | null> {
  return assignWithExecutor(tx, orderId, restaurantId, branchId);
}

/**
 * Preferred path: short dedicated transaction, avoids long interactive timeouts
 * in heavy order-creation transactions.
 */
export async function assignDailyTicketNumberForOrder(
  orderId: string,
  restaurantId: string,
  branchId: string | null = null
): Promise<number | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const assigned = await db.$transaction(async (tx) => {
        return assignWithExecutor(tx, orderId, restaurantId, branchId);
      });
      if (assigned != null) return assigned;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
  }
  // If assignment raced/partially succeeded, return whatever is currently stored.
  const existing = await readOrderTicketNumber(orderId);
  if (existing != null) return existing;

  // Last attempt without wrapping transaction.
  try {
    const direct = await assignWithExecutor(db, orderId, restaurantId, branchId);
    if (direct != null) return direct;
  } catch {
    // ignore
  }
  return await readOrderTicketNumber(orderId);
}

export async function readOrderTicketNumber(orderId: string): Promise<number | null> {
  try {
    const rows = await db.$queryRaw<Array<{ ticketNumber: number | null }>>(
      Prisma.sql`SELECT "ticketNumber" FROM "Order" WHERE id = ${orderId}::uuid LIMIT 1`
    );
    return rows[0]?.ticketNumber ?? null;
  } catch {
    return null;
  }
}
