'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import {
  CalendarClock,
  CreditCard,
  Loader2,
  Puzzle,
  Receipt,
  Save,
  StickyNote,
  Wallet,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { adminInsetClass } from '@/components/admin/admin-surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  getCustomSelectablePricingRows,
  toPricingModuleIds,
} from '@/lib/entitlements/pricing-module-ids';
import { cn } from '@/lib/utils';
import {
  formatInTimezone,
  getClientPayPalBillingTimezone,
  getClientSubscriptionAdminTimezone,
  mirrorWallClockToTimezone,
  parseDatetimeLocalInTimezone,
  subscriptionDateInputToIso,
  utcToDatetimeLocalInTimezone,
} from '@/lib/subscription-timezone-client';

type Sub = {
  id: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  notes: string | null;
  paypalSubscriptionId?: string | null;
  customSelectedModules?: string[];
} | null;

const CUSTOM_MODULE_ROWS = getCustomSelectablePricingRows();

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

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  TRIAL: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  PAST_DUE: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  CANCELED: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
};

const fieldInputClass =
  'h-10 rounded-xl border-0 bg-zinc-100/90 shadow-none focus-visible:ring-2 focus-visible:ring-fire-500/30 dark:bg-zinc-800/60';

const textareaClass =
  'flex min-h-[80px] w-full resize-y rounded-xl border-0 bg-zinc-100/90 px-3 py-2.5 text-sm shadow-none ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-500/30 dark:bg-zinc-800/60';

function formatPayPalPreview(localValue: string): string | null {
  const parsed = parseDatetimeLocalInTimezone(localValue, ADMIN_TZ);
  if (!parsed) return null;
  const mirrored = mirrorWallClockToTimezone(parsed, ADMIN_TZ, PAYPAL_TZ);
  return formatInTimezone(mirrored.toISOString(), PAYPAL_TZ);
}

function FormField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
  accent = '#ed6e40',
}: {
  icon: typeof CreditCard;
  title: string;
  description?: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl p-4 sm:p-5', adminInsetClass)}>
      <div className="mb-4 flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function PayPalHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-sky-500/8 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground dark:bg-sky-500/10">
      {children}
    </div>
  );
}

export function SubscriptionEditDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  subscription,
  onSaved,
}: Props) {
  const { t, i18n } = useTranslation();
  const te = (key: string, opts?: Record<string, unknown>) =>
    t(`admin.subscriptions.edit.${key}`, opts);
  const planLabel = (key: string) =>
    t(`admin.subscriptions.plans.${key}`, { defaultValue: key });
  const statusLabel = (s: string) => {
    switch (s) {
      case 'TRIAL':
        return te('statusTrial');
      case 'ACTIVE':
        return te('statusActive');
      case 'PAST_DUE':
        return te('statusPastDue');
      case 'CANCELED':
        return te('statusCanceled');
      default:
        return s.replace('_', ' ');
    }
  };
  const moduleLabel = (id: string, fallback: string) =>
    te(`modules.${id}`, { defaultValue: fallback });

  const [plan, setPlan] = useState('FREE');
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
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setPlan(subscription?.plan ?? 'FREE');
    setStatus(subscription?.status ?? 'TRIAL');
    setTrialEndsAt(utcToDatetimeLocalInTimezone(subscription?.trialEndsAt ?? null, ADMIN_TZ));
    setCurrentPeriodEnd(
      utcToDatetimeLocalInTimezone(subscription?.currentPeriodEnd ?? null, ADMIN_TZ)
    );
    setNotes(subscription?.notes ?? '');
    setSelectedModules(
      new Set(toPricingModuleIds(subscription?.customSelectedModules ?? []))
    );
    setPaymentAmount('');
    setPaymentPeriodEnd(
      utcToDatetimeLocalInTimezone(subscription?.currentPeriodEnd ?? null, ADMIN_TZ)
    );
    setPaymentNotes('');
    setPayments([]);
  }, [open, subscription]);

  const toggleModule = (id: string, next: boolean) => {
    setSelectedModules((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

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

  const numberLocale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-IE';

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
        customSelectedModules: plan === 'CUSTOM' ? [...selectedModules] : [],
      });
      toast.success(te('saveSuccess'));
      const sync = res.data?.sync;
      if (sync?.periodEndChanged) {
        toast.info(te('periodEndSaved'));
      }
      if (sync?.paymentPeriodEndUpdated) {
        toast.info(te('paymentPeriodUpdated'));
      }
      if (sync?.paypalPeriodEndAt) {
        const tz = sync.paypalBillingTimezone ?? PAYPAL_TZ;
        toast.info(
          te('paypalSchedule', {
            tz,
            value: formatInTimezone(sync.paypalPeriodEndAt, tz),
          })
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
      toast.error(te('saveError'));
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
      toast.error(te('invalidAmount'));
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
      toast.success(te('paymentRecorded'));
      setPaymentAmount('');
      setPaymentNotes('');
      const refreshed = await axios.get<{ data: PaymentRow[] }>(
        `/api/admin/subscriptions/${restaurantId}/payments`
      );
      setPayments(refreshed.data.data ?? []);
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      toast.error(te('paymentRecordError'));
      console.error(err.response?.data);
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
        <DialogHeader className="space-y-4 border-0 px-6 pb-4 pt-6 text-left">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-fire-500/12 text-lg font-semibold text-fire-600 dark:text-fire-400">
              {restaurantName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-xl font-bold tracking-tight">
                {restaurantName}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {te('description')}
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge
                  variant="secondary"
                  className={cn('rounded-md font-medium', STATUS_STYLES[status])}
                >
                  {statusLabel(status)}
                </Badge>
                <Badge variant="secondary" className="rounded-md font-medium">
                  {planLabel(plan)}
                </Badge>
                {subscription?.paypalSubscriptionId ? (
                  <Badge variant="secondary" className="rounded-md font-mono text-[10px]">
                    {te('paypalLinked')}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid gap-4">
            <SectionPanel
              icon={CreditCard}
              title={te('planStatusTitle')}
              description={te('planStatusDescription')}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={te('plan')}>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger className={fieldInputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FREE">{planLabel('FREE')}</SelectItem>
                      <SelectItem value="BASIC">{planLabel('BASIC')}</SelectItem>
                      <SelectItem value="GROWTH">{planLabel('GROWTH')}</SelectItem>
                      <SelectItem value="SCALE">{planLabel('SCALE')}</SelectItem>
                      <SelectItem value="PRO">{planLabel('PRO')}</SelectItem>
                      <SelectItem value="CUSTOM">{planLabel('CUSTOM')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={te('status')}>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={fieldInputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRIAL">{te('statusTrial')}</SelectItem>
                      <SelectItem value="ACTIVE">{te('statusActive')}</SelectItem>
                      <SelectItem value="PAST_DUE">{te('statusPastDue')}</SelectItem>
                      <SelectItem value="CANCELED">{te('statusCanceled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </SectionPanel>

            {plan === 'CUSTOM' ? (
              <SectionPanel
                icon={Puzzle}
                title={te('customModulesTitle')}
                description={te('customModulesDescription')}
                accent="#8b5cf6"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {CUSTOM_MODULE_ROWS.map((row) => {
                    const checked = selectedModules.has(row.id);
                    const isSelection = row.byPlan.CUSTOM === 'selection';
                    return (
                      <label
                        key={row.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition',
                          checked
                            ? 'bg-violet-500/10 dark:bg-violet-500/15'
                            : 'bg-white/60 dark:bg-zinc-900/40'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-border accent-violet-600"
                          checked={checked}
                          onChange={(e) => toggleModule(row.id, e.target.checked)}
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span className="block text-sm font-medium leading-snug">
                            {moduleLabel(row.id, row.label)}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {isSelection
                              ? checked
                                ? te('fullAccess')
                                : te('lockedUntilChecked')
                              : checked
                                ? te('unlockedToFull')
                                : te('basicLimitedAccess')}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {te('selectedCount', { count: selectedModules.size })}
                </p>
              </SectionPanel>
            ) : null}

            <SectionPanel
              icon={CalendarClock}
              title={te('billingDatesTitle')}
              description={te('billingDatesDescription', { tz: ADMIN_TZ })}
              accent="#3b82f6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={te('trialEnds', { tz: ADMIN_TZ })}>
                  <Input
                    type="datetime-local"
                    className={fieldInputClass}
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                  />
                </FormField>
                <FormField
                  label={te('periodEnds', { tz: ADMIN_TZ })}
                  hint={
                    periodEndPayPalPreview
                      ? te('paypalBillingHint', {
                          tz: PAYPAL_TZ,
                          value: periodEndPayPalPreview,
                        })
                      : undefined
                  }
                >
                  <Input
                    type="datetime-local"
                    className={fieldInputClass}
                    value={currentPeriodEnd}
                    onChange={(e) => setCurrentPeriodEnd(e.target.value)}
                  />
                </FormField>
              </div>
              <PayPalHint>{te('paypalClockHint', { tz: PAYPAL_TZ })}</PayPalHint>
            </SectionPanel>

            <SectionPanel
              icon={StickyNote}
              title={te('notesTitle')}
              description={te('notesDescription')}
              accent="#64748b"
            >
              <FormField label={te('notes')}>
                <textarea
                  className={textareaClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={te('notesPlaceholder')}
                />
              </FormField>
            </SectionPanel>

            <SectionPanel
              icon={Wallet}
              title={te('recordPaymentTitle')}
              description={te('recordPaymentDescription')}
              accent="#10b981"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={te('amountEur')}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      €
                    </span>
                    <Input
                      inputMode="decimal"
                      placeholder="0.00"
                      className={cn(fieldInputClass, 'pl-7')}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                </FormField>
                <FormField
                  label={te('expireOn', { tz: ADMIN_TZ })}
                  hint={
                    paymentPeriodEndPayPalPreview
                      ? te('paypalHint', {
                          tz: PAYPAL_TZ,
                          value: paymentPeriodEndPayPalPreview,
                        })
                      : undefined
                  }
                >
                  <Input
                    type="datetime-local"
                    className={fieldInputClass}
                    value={paymentPeriodEnd}
                    onChange={(e) => setPaymentPeriodEnd(e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label={te('paymentNotes')} className="mt-4">
                <textarea
                  className={cn(textareaClass, 'min-h-[64px]')}
                  rows={2}
                  placeholder={te('paymentNotesPlaceholder')}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </FormField>
              <Button
                type="button"
                className="mt-4 w-full rounded-xl sm:w-auto"
                disabled={savingPayment}
                onClick={() => void recordPayment()}
              >
                {savingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {te('recording')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {te('recordPayment')}
                  </>
                )}
              </Button>
            </SectionPanel>

            <SectionPanel
              icon={Receipt}
              title={te('paymentHistoryTitle')}
              description={
                loadingPayments
                  ? te('loading')
                  : te('paymentCount', { count: payments.length })
              }
              accent="#7c3aed"
            >
              {loadingPayments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : payments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {te('noPayments')}
                </p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start justify-between gap-3 rounded-xl bg-white/70 px-3 py-2.5 dark:bg-zinc-900/50"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold tabular-nums text-foreground">
                          {p.currency}{' '}
                          {Number(p.amount).toLocaleString(numberLocale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {te('paidAt', {
                            when: formatInTimezone(p.paidAt, ADMIN_TZ),
                          })}
                        </p>
                        {p.periodEnd ? (
                          <p className="text-[11px] text-muted-foreground">
                            {te('expiresAt', {
                              when: formatInTimezone(p.periodEnd, ADMIN_TZ),
                            })}
                          </p>
                        ) : null}
                        {p.notes ? (
                          <p className="truncate text-[11px] italic text-muted-foreground">
                            {p.notes}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                        {p.id.slice(0, 8)}…
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionPanel>
          </div>
        </div>

        <DialogFooter className="gap-2 border-0 bg-zinc-50/80 px-6 py-4 dark:bg-zinc-900/50 sm:gap-3">
          <Button
            variant="ghost"
            type="button"
            className="rounded-xl"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {te('cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={saving}
            onClick={handleSaveClick}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {te('saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {te('saveChanges')}
              </>
            )}
          </Button>
        </DialogFooter>

        <SaveConfirmation
          open={showConfirmation}
          title={te('saveConfirmTitle')}
          description={te('saveConfirmDescription')}
          itemName={restaurantName}
          loading={saving}
          onConfirm={save}
          onCancel={() => setShowConfirmation(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
