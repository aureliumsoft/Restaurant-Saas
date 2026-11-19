'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableLead,
  AdminTableMuted,
  AdminTableRow,
  AdminTableWrapper,
} from '@/components/admin/admin-table';
import {
  ChangePlanDialog,
  type ChangePlanSubscription,
} from '@/components/admin/change-plan-dialog';
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  formatInTimezone,
  getClientSubscriptionAdminTimezone,
} from '@/lib/subscription-timezone-client';
import { cn } from '@/lib/utils';

type Subscription = {
  id: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  agreedPrice?: number | null;
  customSelectedModules?: string[];
} | null;

type Row = {
  id: string;
  name: string;
  subscription: Subscription;
};

type CatalogPrice = {
  plan: string;
  price: number;
};

const ADMIN_TZ = getClientSubscriptionAdminTimezone();

const PLAN_I18N: Record<string, string> = {
  FREE: 'admin.subscriptions.plans.FREE',
  BASIC: 'admin.subscriptions.plans.BASIC',
  GROWTH: 'admin.subscriptions.plans.GROWTH',
  SCALE: 'admin.subscriptions.plans.SCALE',
  PRO: 'admin.subscriptions.plans.PRO',
  CUSTOM: 'admin.subscriptions.plans.CUSTOM',
};

function formatPeriodEnd(iso: string | null | undefined): string {
  return formatInTimezone(iso, ADMIN_TZ);
}

export default function AdminSubscriptionsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [catalog, setCatalog] = useState<CatalogPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [planRow, setPlanRow] = useState<Row | null>(null);
  const [payRow, setPayRow] = useState<Row | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get('/api/admin/restaurants')
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const loadCatalog = useCallback(() => {
    axios
      .get<{ data: CatalogPrice[] }>('/api/admin/pricing-plans')
      .then((r) => setCatalog(r.data.data ?? []))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    load();
    loadCatalog();
  }, [load, loadCatalog]);

  function planLabel(plan: string): string {
    const key = PLAN_I18N[plan.toUpperCase()];
    if (!key) return plan;
    const translated = t(key);
    return translated === key ? plan : translated;
  }

  function standardPrice(plan: string | undefined): number | null {
    if (!plan) return null;
    const match = catalog.find((item) => item.plan === plan);
    return match ? match.price : null;
  }

  function priceLabel(subscription: Subscription): string {
    if (!subscription) return '—';
    const standard = standardPrice(subscription.plan);
    const agreed = subscription.agreedPrice;
    if (agreed == null) return standard == null ? '—' : `€${standard}`;
    if (standard != null && agreed !== standard) {
      return t('admin.subscriptions.priceInstead', {
        price: `€${agreed}`,
        standard: `€${standard}`,
      });
    }
    return `€${agreed}`;
  }

  function suggestedAmount(subscription: Subscription): string {
    if (!subscription) return '';
    if (subscription.agreedPrice != null) return String(subscription.agreedPrice);
    const standard = standardPrice(subscription.plan);
    return standard == null ? '' : String(standard);
  }

  const filtered = rows.filter((row) => {
    const plan = row.subscription?.plan ?? '';
    const status = row.subscription?.status ?? '';
    const haystack = `${row.name} ${plan} ${status}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  if (planRow) {
    return (
      <ChangePlanDialog
        open
        onOpenChange={(open) => {
          if (!open) setPlanRow(null);
        }}
        restaurantId={planRow.id}
        restaurantName={planRow.name}
        subscription={planRow.subscription as ChangePlanSubscription}
        catalog={catalog}
        onSaved={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  if (payRow) {
    return (
      <RecordPaymentDialog
        open
        onOpenChange={(open) => {
          if (!open) setPayRow(null);
        }}
        restaurantId={payRow.id}
        restaurantName={payRow.name}
        suggestedAmount={suggestedAmount(payRow.subscription)}
        onSaved={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  if (selected) {
    const status = selected.subscription?.status ?? t('admin.subscriptions.notSet');
    const until =
      selected.subscription?.status === 'TRIAL'
        ? formatPeriodEnd(selected.subscription.trialEndsAt)
        : formatPeriodEnd(selected.subscription?.currentPeriodEnd ?? null);
    return (
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 text-muted-foreground"
            onClick={() => setSelected(null)}
          >
            {t('admin.subscriptions.backToRestaurants')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{selected.name}</h1>
          <p className="text-sm text-muted-foreground">
            {status}
            {' · '}
            {selected.subscription ? planLabel(selected.subscription.plan) : t('admin.subscriptions.notSet')}
            {' · '}
            {priceLabel(selected.subscription)}
            {until && until !== '—' ? ` · ${until}` : ''}
          </p>
        </div>
        <div className="grid gap-2">
          <Button type="button" onClick={() => setPlanRow(selected)}>
            {t('admin.subscriptions.changePlan')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setPayRow(selected)}>
            {t('admin.subscriptions.recordPayment')}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <Loader2 className="mx-auto animate-spin text-center text-primary" />
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={t('admin.subscriptions.eyebrow')}
        title={t('admin.subscriptions.title')}
        description={t('admin.subscriptions.description')}
      />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>{t('admin.subscriptions.plansStatusTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <Input
            type="search"
            value={query}
            placeholder={t('admin.subscriptions.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <AdminTableWrapper>
            {filtered.length === 0 ? (
              <AdminTableEmpty>
                {t('admin.subscriptions.noRestaurants')}
              </AdminTableEmpty>
            ) : (
              <AdminTable minWidth={960}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>{t('admin.subscriptions.colRestaurant')}</AdminTableHead>
                    <AdminTableHead>{t('admin.subscriptions.colPlan')}</AdminTableHead>
                    <AdminTableHead>{t('admin.subscriptions.colPrice')}</AdminTableHead>
                    <AdminTableHead>{t('admin.subscriptions.paidUntil')}</AdminTableHead>
                    <AdminTableHead>{t('admin.subscriptions.colStatus')}</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {filtered.map((row) => (
                    <AdminTableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(row)}
                    >
                      <AdminTableCell>
                        <AdminTableLead title={row.name} />
                      </AdminTableCell>
                      <AdminTableCell>
                        {row.subscription ? (
                          <Badge variant="secondary" className="rounded-md font-medium">
                            {planLabel(row.subscription.plan)}
                          </Badge>
                        ) : (
                          <AdminTableMuted>{t('admin.subscriptions.notSet')}</AdminTableMuted>
                        )}
                      </AdminTableCell>
                      <AdminTableCell>{priceLabel(row.subscription)}</AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>
                          {row.subscription?.status === 'TRIAL'
                            ? formatPeriodEnd(row.subscription.trialEndsAt)
                            : formatPeriodEnd(row.subscription?.currentPeriodEnd ?? null)}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell>
                        {row.subscription ? (
                          <Badge
                            variant={
                              row.subscription.status === 'ACTIVE'
                                ? 'default'
                                : row.subscription.status === 'TRIAL'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="rounded-md"
                          >
                            {row.subscription.status}
                          </Badge>
                        ) : (
                          <AdminTableMuted>—</AdminTableMuted>
                        )}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
          </AdminTableWrapper>
        </CardContent>
      </Card>

    </div>
  );
}
