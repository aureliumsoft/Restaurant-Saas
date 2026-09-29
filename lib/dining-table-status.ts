import type { Prisma } from '@prisma/client';
import { DiningTableStatus } from '@prisma/client';

/** Order statuses that no longer keep a dining table reserved. */
const TERMINAL_ORDER_STATUSES = [
  'canceled',
  'cancelled',
  'failed',
  'cancel',
  'completed',
  'complete',
  'delivered',
] as const;

type Tx = Prisma.TransactionClient;

export function isDiningTableReserved(
  status: DiningTableStatus | string | null | undefined
): boolean {
  return String(status ?? '').toUpperCase() === 'RESERVED';
}

/** Mark a table reserved when a dine-in order is placed on it. */
export async function markDiningTableReserved(
  tx: Tx,
  diningTableId: string | null | undefined
): Promise<void> {
  if (!diningTableId) return;
  await tx.diningTable.updateMany({
    where: { id: diningTableId },
    data: { status: DiningTableStatus.RESERVED },
  });
}

/**
 * Set table AVAILABLE when no active (non-terminal) orders remain on it.
 * Call after order complete / cancel / table payment.
 */
export async function releaseDiningTableIfIdle(
  tx: Tx,
  diningTableId: string | null | undefined
): Promise<void> {
  if (!diningTableId) return;

  const remaining = await tx.order.count({
    where: {
      diningTableId,
      NOT: {
        OR: TERMINAL_ORDER_STATUSES.map((status) => ({
          status: { equals: status, mode: 'insensitive' as const },
        })),
      },
    },
  });

  if (remaining > 0) return;

  await tx.diningTable.updateMany({
    where: { id: diningTableId },
    data: { status: DiningTableStatus.AVAILABLE },
  });
}

/**
 * When an order moves from one table to another (or clears the table),
 * reserve the new table and release the previous one if idle.
 */
export async function syncDiningTableStatusOnOrderTableChange(
  tx: Tx,
  opts: {
    previousDiningTableId: string | null | undefined;
    nextDiningTableId: string | null | undefined;
  }
): Promise<void> {
  const prev = opts.previousDiningTableId ?? null;
  const next = opts.nextDiningTableId ?? null;
  if (prev === next) {
    if (next) await markDiningTableReserved(tx, next);
    return;
  }
  if (next) await markDiningTableReserved(tx, next);
  if (prev) await releaseDiningTableIfIdle(tx, prev);
}
