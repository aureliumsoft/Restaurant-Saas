export type SalesOrderStatusBucket = 'completed' | 'pending' | 'canceled';

/** Normalize menu order / POS transaction status for sales reporting. */
export function salesOrderStatusBucket(status: string): SalesOrderStatusBucket {
  const s = status.trim().toLowerCase();
  if (s === 'completed' || s === 'complete') return 'completed';
  if (
    s === 'canceled' ||
    s === 'cancelled' ||
    s === 'failed' ||
    s === 'cancel'
  ) {
    return 'canceled';
  }
  return 'pending';
}

export function isCompletedSalesStatus(status: string): boolean {
  return salesOrderStatusBucket(status) === 'completed';
}

export function isCanceledOrderStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'canceled' || s === 'cancelled';
}

export function isPendingPaymentStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'pending' || s === 'pedding';
}

export function isCompletedPaymentStatus(
  status: string | null | undefined
): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'completed' || s === 'complete' || s === 'paid' || s === 'success';
}

export function isCanceledPaymentStatus(
  status: string | null | undefined
): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return (
    s === 'canceled' ||
    s === 'cancelled' ||
    s === 'failed' ||
    s === 'cancel'
  );
}

/** Revenue counts only when payment is completed (not pending/cancelled). */
export function orderCountsTowardRevenue(opts: {
  orderStatus: string;
  paymentStatus: string | null | undefined;
}): boolean {
  const payment = String(opts.paymentStatus ?? '').trim();
  if (payment) {
    if (isCanceledPaymentStatus(payment) || isPendingPaymentStatus(payment)) {
      return false;
    }
    return isCompletedPaymentStatus(payment);
  }
  return isCompletedSalesStatus(opts.orderStatus);
}

/** Prisma filter: active orders for dashboard charts (excludes canceled/failed). */
export function analyticsActiveOrderStatusWhere() {
  return {
    NOT: {
      OR: [
        { status: { equals: 'canceled', mode: 'insensitive' as const } },
        { status: { equals: 'cancelled', mode: 'insensitive' as const } },
        { status: { equals: 'failed', mode: 'insensitive' as const } },
        { status: { equals: 'cancel', mode: 'insensitive' as const } },
      ],
    },
  };
}

export function rowTotalAmount(total: number | null | undefined): number {
  if (total == null || Number.isNaN(total)) return 0;
  return total;
}
