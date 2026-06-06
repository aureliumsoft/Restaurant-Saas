import type { Prisma } from '@prisma/client';

import { isPrismaUniqueViolation } from '@/lib/order-idempotency-server';

export function utcTicketDateFromNow(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Next daily ticket number for a restaurant (and branch when set).
 * Uses the higher of branch-scoped and restaurant-wide sequences so legacy DB
 * indexes on (restaurantId, ticketDate, ticketNumber) stay satisfied.
 */
export async function allocateTicketNumber(
  tx: Prisma.TransactionClient,
  args: {
    restaurantId: string;
    ticketDate: Date;
    branchId: string | null;
  },
  maxAttempts = 16
): Promise<number> {
  const [scopedPrevious, globalPrevious] = await Promise.all([
    tx.order.findFirst({
      where: {
        restaurantId: args.restaurantId,
        ticketDate: args.ticketDate,
        branchId: args.branchId,
      },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    }),
    tx.order.findFirst({
      where: {
        restaurantId: args.restaurantId,
        ticketDate: args.ticketDate,
      },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    }),
  ]);

  let candidate =
    Math.max(
      (scopedPrevious?.ticketNumber ?? -1) + 1,
      (globalPrevious?.ticketNumber ?? -1) + 1
    );

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const scopedTaken = await tx.order.findFirst({
      where: {
        restaurantId: args.restaurantId,
        ticketDate: args.ticketDate,
        branchId: args.branchId,
        ticketNumber: candidate,
      },
      select: { id: true },
    });
    if (!scopedTaken) {
      const globalTaken = await tx.order.findFirst({
        where: {
          restaurantId: args.restaurantId,
          ticketDate: args.ticketDate,
          ticketNumber: candidate,
        },
        select: { id: true },
      });
      if (!globalTaken) return candidate;
    }
    candidate += 1;
  }

  throw new Error('Could not allocate ticket number');
}

export function isTicketNumberConflict(e: unknown): boolean {
  if (!isPrismaUniqueViolation(e)) return false;
  const target = (e as { meta?: { target?: string[] } }).meta?.target;
  if (!Array.isArray(target)) return true;
  return target.includes('ticketNumber') || target.includes('ticketDate');
}
