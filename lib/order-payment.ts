import type { Prisma } from '@prisma/client';

export function isCanceledOrderStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return (
    normalized === 'canceled' ||
    normalized === 'cancelled' ||
    normalized === 'failed' ||
    normalized === 'cancel'
  );
}

/** Revenue ledger amount: order total, not cash tendered (change is not revenue). */
export function resolvePosPaymentLedgerAmount(params: {
  grandTotal: number;
  tenderedAmount: number;
  paymentMode: string;
  paymentStatus: string;
}): { ledgerAmount: number; validationError?: string } {
  const mode = params.paymentMode.toLowerCase();
  const status = params.paymentStatus.toLowerCase();

  if (status === 'completed' && mode === 'cash') {
    if (params.tenderedAmount + 0.001 < params.grandTotal) {
      return {
        ledgerAmount: params.grandTotal,
        validationError: 'Paid amount is less than order total.',
      };
    }
  }

  return { ledgerAmount: params.grandTotal };
}

export async function cancelOrderPayments(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  await tx.payment.updateMany({
    where: { orderId },
    data: { status: 'cancelled' },
  });
}
