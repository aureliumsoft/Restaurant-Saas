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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getCustomSelectablePricingRows,
  toPricingModuleIds,
} from '@/lib/entitlements/pricing-module-ids';
import {
  subscriptionDateInputToIso,
  utcToDatetimeLocalInTimezone,
  getClientSubscriptionAdminTimezone,
} from '@/lib/subscription-timezone-client';

const PLANS = ['FREE', 'BASIC', 'GROWTH', 'SCALE', 'PRO', 'CUSTOM'] as const;
const ADMIN_TZ = getClientSubscriptionAdminTimezone();
const MODULE_ROWS = getCustomSelectablePricingRows();

export type ChangePlanSubscription = {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  agreedPrice?: number | null;
  customSelectedModules?: string[];
} | null;

type CatalogPrice = {
  plan: string;
  price: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName: string;
  subscription: ChangePlanSubscription;
  catalog: CatalogPrice[];
  onSaved: () => void;
};

function dateInputValue(iso: string | null | undefined): string {
  const local = utcToDatetimeLocalInTimezone(iso ?? null, ADMIN_TZ);
  return local ? local.slice(0, 10) : '';
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  subscription,
  catalog,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState('FREE');
  const [price, setPrice] = useState('');
  const [until, setUntil] = useState('');
  const [modules, setModules] = useState<string[]>([]);
  const [priceError, setPriceError] = useState('');
  const [dateError, setDateError] = useState('');
  const [saving, setSaving] = useState(false);

  const standard = catalog.find((item) => item.plan === plan)?.price;

  useEffect(() => {
    if (!open) return;
    const nextPlan = subscription?.plan ?? 'FREE';
    const catalogPrice = catalog.find((item) => item.plan === nextPlan)?.price;
    const agreed = subscription?.agreedPrice;
    setPlan(nextPlan);
    setPrice(String(agreed ?? catalogPrice ?? ''));
    setUntil(dateInputValue(subscription?.currentPeriodEnd));
    setModules(toPricingModuleIds(subscription?.customSelectedModules ?? []));
    setPriceError('');
    setDateError('');
  }, [open, subscription, catalog]);

  function onPlanChange(next: string) {
    setPlan(next);
    const catalogPrice = catalog.find((item) => item.plan === next)?.price;
    const samePlan = next === (subscription?.plan ?? 'FREE');
    const agreed = subscription?.agreedPrice;
    setPrice(String(samePlan && agreed != null ? agreed : catalogPrice ?? ''));
    setPriceError('');
  }

  async function save() {
    const amount = price.trim();
    const parsed = Number(amount);
    const badPrice = !amount || !Number.isInteger(parsed) || parsed < 0;
    const badDate = !until;
    setPriceError(badPrice ? t('admin.subscriptions.priceRequired') : '');
    setDateError(badDate ? t('admin.subscriptions.dateRequired') : '');
    if (badPrice || badDate) return;

    const periodEnd = subscriptionDateInputToIso(`${until}T23:59`, ADMIN_TZ);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: ADMIN_TZ });

    setSaving(true);
    try {
      await axios.patch(`/api/admin/subscriptions/${restaurantId}`, {
        plan,
        status: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
        agreedPrice: parsed,
        customSelectedModules: plan === 'CUSTOM' ? modules : [],
      });
      if (parsed > 0) {
        await axios.post(`/api/admin/subscriptions/${restaurantId}/payments`, {
          amount: parsed,
          currency: 'EUR',
          paidAt: subscriptionDateInputToIso(`${today}T12:00`, ADMIN_TZ),
          periodEnd,
          setStatusActive: true,
          notes: 'Plan activation',
        });
      }
      toast.success(t('admin.subscriptions.planSaved'));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t('admin.subscriptions.planSaveFailed'));
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
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.subscriptions.changePlan')}</h1>
        <p className="text-sm text-muted-foreground">
          {restaurantName}. {t('admin.subscriptions.planOnlyHint')}
        </p>
      </div>
      <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="change-plan">{t('admin.subscriptions.colPlan')}</Label>
            <Select value={plan} onValueChange={onPlanChange}>
              <SelectTrigger id="change-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`admin.subscriptions.plans.${key}`)}
                    {catalog.find((item) => item.plan === key)
                      ? ` · €${catalog.find((item) => item.plan === key)?.price}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="change-price">{t('admin.subscriptions.priceForRestaurant')}</Label>
            <Input
              id="change-price"
              inputMode="numeric"
              value={price}
              aria-invalid={Boolean(priceError)}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceError('');
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t('admin.subscriptions.standardPriceHint', {
                price: standard == null ? '—' : `€${standard}`,
              })}
            </p>
            {priceError ? <p className="text-sm text-destructive">{priceError}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="change-until">{t('admin.subscriptions.paidUntil')}</Label>
            <Input
              id="change-until"
              type="date"
              value={until}
              aria-invalid={Boolean(dateError)}
              onChange={(e) => {
                setUntil(e.target.value);
                setDateError('');
              }}
            />
            {dateError ? <p className="text-sm text-destructive">{dateError}</p> : null}
          </div>
          {plan === 'CUSTOM' ? (
            <div className="grid gap-2">
              <Label>{t('admin.subscriptions.customModules')}</Label>
              <div className="grid max-h-40 gap-2 overflow-y-auto">
                {MODULE_ROWS.map((row) => (
                  <label key={row.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={modules.includes(row.id)}
                      onChange={(e) => {
                        setModules((current) =>
                          e.target.checked
                            ? [...current, row.id]
                            : current.filter((id) => id !== row.id)
                        );
                      }}
                    />
                    {row.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
      </div>
      <Button type="button" className="w-full" onClick={() => void save()} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('admin.subscriptions.saving')}
          </>
        ) : (
          t('admin.subscriptions.savePlan')
        )}
      </Button>
    </div>
  );
}
