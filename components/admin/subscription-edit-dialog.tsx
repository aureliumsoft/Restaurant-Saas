'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  formatInTimezone,
  getClientPayPalBillingTimezone,
  getClientSubscriptionAdminTimezone,
  mirrorWallClockToTimezone,
  parseDatetimeLocalInTimezone,
  subscriptionDateInputToIso,
  utcToDatetimeLocalInTimezone,
} from '@/lib/subscription-timezone-client';
import { Loader2, Plus, Save } from 'lucide-react';

type Sub = {
  id: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  notes: string | null;
  paypalSubscriptionId?: string | null;
} | null;

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  notes: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName: string;
  subscription: Sub;
  onSaved: () => void;
};

const ADMIN_TZ = getClientSubscriptionAdminTimezone();
const PAYPAL_TZ = getClientPayPalBillingTimezone();

function formatPayPalPreview(localValue: string): string | null {
  const parsed = parseDatetimeLocalInTimezone(localValue, ADMIN_TZ);
  if (!parsed) return null;
  const mirrored = mirrorWallClockToTimezone(parsed, ADMIN_TZ, PAYPAL_TZ);
  return formatInTimezone(mirrored.toISOString(), PAYPAL_TZ);
}

export function SubscriptionEditDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  subscription,
  onSaved,
}: Props) {
  const [plan, setPlan] = useState('STARTER');
  const [status, setStatus] = useState('TRIAL');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPeriodEnd, setPaymentPeriodEnd] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(subscription?.plan ?? 'STARTER');
    setStatus(subscription?.status ?? 'TRIAL');
    setTrialEndsAt(utcToDatetimeLocalInTimezone(subscription?.trialEndsAt ?? null, ADMIN_TZ));
    setCurrentPeriodEnd(
      utcToDatetimeLocalInTimezone(subscription?.currentPeriodEnd ?? null, ADMIN_TZ)
    );
    setNotes(subscription?.notes ?? '');
    setPaymentAmount('');
    setPaymentPeriodEnd(
      utcToDatetimeLocalInTimezone(subscription?.currentPeriodEnd ?? null, ADMIN_TZ)
    );
    setPaymentNotes('');
    setPayments([]);
  }, [open, subscription]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadingPayments(true);
    axios
      .get<{ data: PaymentRow[] }>(`/api/admin/subscriptions/${restaurantId}/payments`)
      .then((r) => {
        if (mounted) setPayments(r.data.data ?? []);
      })
      .catch(() => {
        if (mounted) setPayments([]);
      })
      .finally(() => {
        if (mounted) setLoadingPayments(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, restaurantId]);

  const periodEndPayPalPreview = useMemo(
    () => formatPayPalPreview(currentPeriodEnd),
    [currentPeriodEnd]
  );

  const paymentPeriodEndPayPalPreview = useMemo(
    () => formatPayPalPreview(paymentPeriodEnd),
    [paymentPeriodEnd]
  );

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.patch<{
        data?: unknown;
        sync?: {
          paypal?: { ok?: boolean; messages?: string[] };
          paymentPeriodEndUpdated?: boolean;
          periodEndChanged?: boolean;
          adminTimezone?: string;
          paypalBillingTimezone?: string;
          paypalPeriodEndAt?: string | null;
        };
      }>(`/api/admin/subscriptions/${restaurantId}`, {
        plan,
        status,
        trialEndsAt: trialEndsAt
          ? subscriptionDateInputToIso(trialEndsAt, ADMIN_TZ)
          : null,
        currentPeriodEnd: currentPeriodEnd
          ? subscriptionDateInputToIso(currentPeriodEnd, ADMIN_TZ)
          : null,
        notes: notes.trim() || null,
      });
      toast.success('Subscription updated');
      const sync = res.data?.sync;
      if (sync?.periodEndChanged) {
        toast.info('Period end saved. PayPal will follow auto-renew settings.');
      }
      if (sync?.paymentPeriodEndUpdated) {
        toast.info('Latest payment record period end updated.');
      }
      if (sync?.paypalPeriodEndAt) {
        toast.info(
          `PayPal billing schedule (${sync.paypalBillingTimezone ?? PAYPAL_TZ}): ${formatInTimezone(sync.paypalPeriodEndAt, sync.paypalBillingTimezone ?? PAYPAL_TZ)}`
        );
      }
      const paypalMessages = sync?.paypal?.messages ?? [];
      for (const msg of paypalMessages) {
        if (typeof msg === 'string' && sync?.paypal?.ok === false) {
          console.warn(msg);
          toast.warn(msg);
        } else {
          toast.info(typeof msg === 'string' ? msg : 'Unknown PayPal message');
          console.info(typeof msg === 'string' ? msg : 'Unknown PayPal message');
        }
      }
      setShowConfirmation(false);
      onOpenChange(false);
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      toast.error('Could not save subscription');
      console.error(err.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    setShowConfirmation(true);
  };

  const recordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }

    setSavingPayment(true);
    try {
      await axios.post(`/api/admin/subscriptions/${restaurantId}/payments`, {
        amount,
        currency: 'EUR',
        periodEnd: paymentPeriodEnd
          ? subscriptionDateInputToIso(paymentPeriodEnd, ADMIN_TZ)
          : null,
        notes: paymentNotes.trim() || null,
        setStatusActive: true,
      });
      toast.success('Payment recorded');
      setPaymentAmount('');
      setPaymentNotes('');
      const refreshed = await axios.get<{ data: PaymentRow[] }>(
        `/api/admin/subscriptions/${restaurantId}/payments`
      );
      setPayments(refreshed.data.data ?? []);
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      toast.error('Could not record payment');
      console.error(err.response?.data);
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Subscription — {restaurantName}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-1">
          <div className="grid gap-4 py-2 pr-4">
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="GROWTH">Growth</SelectItem>
                  <SelectItem value="SCALE">Scale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAST_DUE">Past due</SelectItem>
                  <SelectItem value="CANCELED">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Trial ends ({ADMIN_TZ})</Label>
              <Input
                type="datetime-local"
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Current period ends ({ADMIN_TZ})</Label>
              <Input
                type="datetime-local"
                value={currentPeriodEnd}
                onChange={(e) => setCurrentPeriodEnd(e.target.value)}
              />
              {periodEndPayPalPreview ? (
                <p className="text-xs text-muted-foreground">
                  PayPal billing ({PAYPAL_TZ}): {periodEndPayPalPreview}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Enter your local time above. The same clock time is applied for
                PayPal in {PAYPAL_TZ} (e.g. 9:00 AM here → 9:00 AM US Eastern).
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <textarea
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium">Record payment</p>
              <div className="grid gap-2">
                <Label>Amount (EUR)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="mt-2 grid gap-2">
                <Label>Expire on ({ADMIN_TZ})</Label>
                <Input
                  type="datetime-local"
                  value={paymentPeriodEnd}
                  onChange={(e) => setPaymentPeriodEnd(e.target.value)}
                />
                {paymentPeriodEndPayPalPreview ? (
                  <p className="text-xs text-muted-foreground">
                    PayPal billing ({PAYPAL_TZ}): {paymentPeriodEndPayPalPreview}
                  </p>
                ) : null}
              </div>
              <div className="mt-2 grid gap-2">
                <Label>Payment notes</Label>
                <textarea
                  className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
              <Button
                type="button"
                className="mt-3"
                disabled={savingPayment}
                onClick={() => void recordPayment()}
              >
                {savingPayment ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> <span>Recording...</span></> : <><Save className="h-4 w-4 mr-2" /> <span>Record Payment</span></>}
              </Button>
              {loadingPayments ? (
                <p className="mt-3 text-xs text-muted-foreground">Loading payment history…</p>
              ) : payments.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Recent payments</p>
                  <div className="max-h-40 space-y-1 overflow-auto text-xs">
                    {payments.map((p) => (
                      <div key={p.id} className="rounded border px-2 py-1">
                        <div className="font-medium">
                          {p.currency} {Number(p.amount).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-muted-foreground">
                          Transaction ID: <span className="font-mono">{p.id}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Paid: {formatInTimezone(p.paidAt, ADMIN_TZ)}
                        </div>
                        {p.periodEnd && (
                          <div className="text-muted-foreground">
                            Expires: {formatInTimezone(p.periodEnd, ADMIN_TZ)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No payments recorded yet.</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={handleSaveClick}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> <span>Saving...</span></> : <><Save className="h-4 w-4 mr-2" /> <span>Save</span></>}
          </Button>
        </DialogFooter>
        <SaveConfirmation
          open={showConfirmation}
          title="Save Subscription"
          description="Are you sure you want to save these subscription changes?"
          itemName={restaurantName}
          loading={saving}
          onConfirm={save}
          onCancel={() => setShowConfirmation(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
