'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getClientSubscriptionAdminTimezone,
  subscriptionDateInputToIso,
} from '@/lib/subscription-timezone-client';

const ADMIN_TZ = getClientSubscriptionAdminTimezone();

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName: string;
  suggestedAmount: string;
  onSaved: () => void;
};

export function RecordPaymentDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  suggestedAmount,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [amountError, setAmountError] = useState('');
  const [dateError, setDateError] = useState('');
  const [markRegistrationFee, setMarkRegistrationFee] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(suggestedAmount);
    setPaidOn(new Date().toISOString().slice(0, 10));
    setAmountError('');
    setDateError('');
    setMarkRegistrationFee(false);
  }, [open, suggestedAmount]);

  async function save() {
    const parsed = Number(amount);
    const badAmount = !amount.trim() || !Number.isFinite(parsed) || parsed <= 0;
    const badDate = !paidOn;
    setAmountError(badAmount ? t('admin.subscriptions.amountRequired') : '');
    setDateError(badDate ? t('admin.subscriptions.paymentDateRequired') : '');
    if (badAmount || badDate) return;

    setSaving(true);
    try {
      await axios.post(`/api/admin/subscriptions/${restaurantId}/payments`, {
        amount: parsed,
        currency: 'EUR',
        paidAt: subscriptionDateInputToIso(`${paidOn}T12:00`, ADMIN_TZ),
        setStatusActive: markRegistrationFee,
        markRegistrationFeePaid: markRegistrationFee,
        notes: markRegistrationFee ? 'registration_fee_manual' : null,
      });
      toast.success(t('admin.subscriptions.paymentRecorded'));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t('admin.subscriptions.paymentSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-0 text-muted-foreground"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          {t('cancel')}
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.subscriptions.recordPayment')}</h1>
        <p className="text-sm text-muted-foreground">
          {restaurantName}. {t('admin.subscriptions.paymentOnlyHint')}
        </p>
      </div>
      <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">{t('admin.subscriptions.amount')}</Label>
            <Input
              id="pay-amount"
              inputMode="decimal"
              value={amount}
              aria-invalid={Boolean(amountError)}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError('');
              }}
            />
            {amountError ? <p className="text-sm text-destructive">{amountError}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-date">{t('admin.subscriptions.date')}</Label>
            <Input
              id="pay-date"
              type="date"
              value={paidOn}
              aria-invalid={Boolean(dateError)}
              onChange={(e) => {
                setPaidOn(e.target.value);
                setDateError('');
              }}
            />
            {dateError ? <p className="text-sm text-destructive">{dateError}</p> : null}
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={markRegistrationFee}
              onChange={(e) => setMarkRegistrationFee(e.target.checked)}
            />
            <span>
              {t('admin.subscriptions.markRegistrationFee', {
                defaultValue:
                  'Mark as registration fee (unlock Free plan dashboard access)',
              })}
            </span>
          </label>
      </div>
      <Button type="button" className="w-full" onClick={() => void save()} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('admin.subscriptions.saving')}
          </>
        ) : (
          t('admin.subscriptions.recordPayment')
        )}
      </Button>
    </div>
  );
}
