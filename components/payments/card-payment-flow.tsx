'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { CreditCard, CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type CardPaymentStatus =
  | 'idle'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled';

type UseCardPaymentFlowOptions = {
  amount: number;
  orderIdPrefix?: string;
  formatMoney?: (n: number) => string;
  currency?: string;
  /** Return an error message to skip the terminal charge (e.g. ingredient stock). */
  beforeCharge?: () => Promise<string | null>;
  onChargeBlocked?: (message: string) => void;
};

function defaultFormatMoney(n: number) {
  return n.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function useCardPaymentFlow({
  amount,
  orderIdPrefix = 'PRE',
  formatMoney = defaultFormatMoney,
  currency = 'EUR',
  beforeCharge,
  onChargeBlocked,
}: UseCardPaymentFlowOptions) {
  const beforeChargeRef = useRef(beforeCharge);
  beforeChargeRef.current = beforeCharge;
  const onChargeBlockedRef = useRef(onChargeBlocked);
  onChargeBlockedRef.current = onChargeBlocked;
  const [cardPaymentStatus, setCardPaymentStatus] =
    useState<CardPaymentStatus>('idle');
  const [cardProcessingOpen, setCardProcessingOpen] = useState(false);
  const [cardPaymentOutcomeOpen, setCardPaymentOutcomeOpen] = useState<
    'success' | 'error' | null
  >(null);
  const [cardTransactionId, setCardTransactionId] = useState<
    string | undefined
  >();
  const cardPaymentCancelledRef = useRef(false);
  const cardPaymentResolvedRef = useRef(false);

  function resetCardPayment() {
    setCardPaymentStatus('idle');
    setCardTransactionId(undefined);
    setCardPaymentOutcomeOpen(null);
    cardPaymentCancelledRef.current = false;
    cardPaymentResolvedRef.current = false;
  }

  function finalizeCardPayment(
    result: 'success' | 'error' | 'cancelled',
    txnId?: string,
    force = false
  ) {
    if (cardPaymentResolvedRef.current && !force) return;
    cardPaymentResolvedRef.current = true;
    setCardProcessingOpen(false);
    if (result === 'success') {
      setCardPaymentStatus('success');
      if (txnId) setCardTransactionId(txnId);
      setCardPaymentOutcomeOpen('success');
      return;
    }
    setCardPaymentStatus(result === 'cancelled' ? 'cancelled' : 'error');
    setCardTransactionId(undefined);
    setCardPaymentOutcomeOpen('error');
  }

  async function runTerminalCardCharge(): Promise<{
    ok: boolean;
    transactionId?: string;
    message?: string;
    cancelled?: boolean;
  }> {
    const terminalBase =
      process.env.NEXT_PUBLIC_POS_TERMINAL_API?.trim().replace(/\/$/, '') || '';
    if (!terminalBase) {
      return { ok: false, message: 'Terminal API not configured' };
    }
    try {
      const terminalRes = await axios.post<{
        status?: string;
        transactionId?: string;
        message?: string;
      }>(
        `${terminalBase}/charge`,
        {
          orderId: `${orderIdPrefix}-${Date.now()}`,
          amount,
          currency,
        },
        { timeout: 120000 }
      );
      if (cardPaymentCancelledRef.current) {
        return { ok: false, cancelled: true };
      }
      const status = String(terminalRes.data?.status ?? '').toLowerCase();
      const transactionId = terminalRes.data?.transactionId;
      const message = String(terminalRes.data?.message ?? '');
      if (
        status === 'approved' ||
        status === 'success' ||
        status === 'completed'
      ) {
        return { ok: true, transactionId };
      }
      if (status === 'cancelled' || status === 'canceled') {
        return { ok: false, cancelled: true, message };
      }
      return { ok: false, message };
    } catch {
      if (cardPaymentCancelledRef.current) {
        return { ok: false, cancelled: true };
      }
      return { ok: false, message: 'Card terminal request failed' };
    }
  }

  async function handleCardPayClick() {
    if (cardPaymentStatus === 'success') return;
    const blocked = await beforeChargeRef.current?.();
    if (blocked) {
      onChargeBlockedRef.current?.(blocked);
      return;
    }
    cardPaymentCancelledRef.current = false;
    cardPaymentResolvedRef.current = false;
    setCardProcessingOpen(true);
    setCardPaymentStatus('processing');

    const terminalBase =
      process.env.NEXT_PUBLIC_POS_TERMINAL_API?.trim().replace(/\/$/, '') ||
      '';
    if (!terminalBase) return;

    const result = await runTerminalCardCharge();
    if (cardPaymentCancelledRef.current) return;
    if (result.ok) {
      finalizeCardPayment('success', result.transactionId);
      return;
    }
    if (result.cancelled) {
      finalizeCardPayment('cancelled');
      return;
    }
    finalizeCardPayment('error');
  }

  function handleCardPaymentBypass() {
    cardPaymentCancelledRef.current = true;
    finalizeCardPayment('success', `BYPASS-${Date.now()}`, true);
  }

  function handleCardPaymentCancel() {
    cardPaymentCancelledRef.current = true;
    finalizeCardPayment('cancelled');
  }

  return {
    cardPaymentStatus,
    cardTransactionId,
    cardProcessingOpen,
    cardPaymentOutcomeOpen,
    setCardPaymentOutcomeOpen,
    isCardPaymentComplete: cardPaymentStatus === 'success',
    resetCardPayment,
    handleCardPayClick,
    handleCardPaymentBypass,
    handleCardPaymentCancel,
    setCardProcessingOpen,
    formatMoney,
  };
}

type CardPaymentDialogsProps = {
  amount: number;
  cardPaymentStatus: CardPaymentStatus;
  cardTransactionId?: string;
  cardProcessingOpen: boolean;
  cardPaymentOutcomeOpen: 'success' | 'error' | null;
  setCardPaymentOutcomeOpen: (v: 'success' | 'error' | null) => void;
  setCardProcessingOpen: (open: boolean) => void;
  onBypass: () => void;
  onCancel: () => void;
  formatMoney?: (n: number) => string;
  successContinueLabel?: string;
};

export function CardPaymentDialogs({
  amount,
  cardPaymentStatus,
  cardTransactionId,
  cardProcessingOpen,
  cardPaymentOutcomeOpen,
  setCardPaymentOutcomeOpen,
  setCardProcessingOpen,
  onBypass,
  onCancel,
  formatMoney = defaultFormatMoney,
  successContinueLabel = 'Continue',
}: CardPaymentDialogsProps) {
  return (
    <>
      <Dialog
        open={cardProcessingOpen}
        onOpenChange={(open) => {
          if (!open && cardPaymentStatus === 'processing') return;
          setCardProcessingOpen(open);
        }}
      >
        <DialogContent
          className="max-w-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle>Payment processing</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative flex h-28 w-36 flex-col items-center justify-end rounded-xl border-2 border-primary/40 bg-muted/50 p-3 shadow-inner">
              <div className="absolute inset-x-3 top-3 h-10 rounded-md bg-primary/15">
                <div className="mx-auto mt-2 h-2 w-16 animate-pulse rounded-full bg-primary/50" />
                <div className="mx-auto mt-2 h-1.5 w-10 animate-pulse rounded-full bg-primary/30 [animation-delay:150ms]" />
              </div>
              <div className="mb-1 flex h-10 w-full items-center justify-center rounded-md border border-primary/30 bg-background">
                <CreditCard className="h-6 w-6 animate-bounce text-primary" />
              </div>
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                ATM
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Insert or tap card on the terminal…
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(amount)}
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onBypass}
            >
              Bypass payment (test)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cardPaymentOutcomeOpen === 'success'}
        onOpenChange={(open) => {
          if (!open) setCardPaymentOutcomeOpen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Payment successful
            </AlertDialogTitle>
            <AlertDialogDescription>
              Card payment of {formatMoney(amount)} was approved
              {cardTransactionId ? ` (${cardTransactionId})` : ''}. You can now
              confirm your order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setCardPaymentOutcomeOpen(null)}
            >
              {successContinueLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cardPaymentOutcomeOpen === 'error'}
        onOpenChange={(open) => {
          if (!open) setCardPaymentOutcomeOpen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Payment failed
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cardPaymentStatus === 'cancelled'
                ? 'Card payment was cancelled. Tap Pay to try again.'
                : 'Card payment could not be completed. Tap Pay to try again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setCardPaymentOutcomeOpen(null)}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
