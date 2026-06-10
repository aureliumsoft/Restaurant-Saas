import type { Prisma } from '@prisma/client';

import { isPrismaUniqueViolation } from '@/lib/order-idempotency-server';

export function utcTicketDateFromNow(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Next daily ticket number for a restaurant branch (resets to 1 each UTC date).
 * Each branch maintains its own sequence — main branch #1 and second branch #1
 * on the same day are independent.
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
  const scopedPrevious = await tx.order.findFirst({
    where: {
      restaurantId: args.restaurantId,
      ticketDate: args.ticketDate,
      branchId: args.branchId,
    },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });

  let candidate = (scopedPrevious?.ticketNumber ?? 0) + 1;

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
    if (!scopedTaken) return candidate;
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
