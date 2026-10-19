'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import { CustomPlanRequestsPanel } from '@/components/admin/custom-plan-requests-panel';
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableChip,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
  AdminTableLead,
  AdminTableMuted,
  AdminTableRow,
  AdminTableWrapper,
} from '@/components/admin/admin-table';
import { PlanEditDialog, type CatalogPlan } from '@/components/admin/plan-edit-dialog';
import { SubscriptionEditDialog } from '@/components/admin/subscription-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
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
  notes: string | null;
  customSelectedModules?: string[];
} | null;

type Row = {
  id: string;
  name: string;
  subdomain: string;
  owner: { email: string | null };
  subscription: Subscription;
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
  const uiLang = useUiLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Row | null>(null);
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<CatalogPlan | null>(null);

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
      .get<{ data: CatalogPlan[] }>('/api/admin/pricing-plans')
      .then((r) => setCatalogPlans(r.data.data ?? []))
      .catch(() => setCatalogPlans([]));
  }, []);

  useEffect(() => {
    load();
    loadCatalog();
  }, [load, loadCatalog]);

  const localizedCatalog = useMemo(
    () =>
      catalogPlans.map((p) => ({
        ...p,
        name: resolveBilingualText(p.name, uiLang),
        priceLabel: resolveBilingualText(p.priceLabel, uiLang),
        description: resolveBilingualText(p.description, uiLang),
      })),
    [catalogPlans, uiLang]
  );

  function planLabel(plan: string): string {
    const key = PLAN_I18N[plan.toUpperCase()];
    if (!key) return plan;
    const translated = t(key);
    return translated === key ? plan : translated;
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
          <CardDescription>
            {t('admin.subscriptions.plansStatusDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {rows.length === 0 ? (
              <AdminTableEmpty>
                {t('admin.subscriptions.noRestaurants')}
              </AdminTableEmpty>
            ) : (
              <AdminTable minWidth={960}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>
                      {t('admin.subscriptions.colRestaurant')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colSubdomain')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colOwner')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colPlan')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colStatus')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colPeriodEnds')}
                    </AdminTableHead>
                    <AdminTableHead className="w-24 text-right">
                      {t('admin.subscriptions.colEdit')}
                    </AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {rows.map((r) => (
                    <AdminTableRow key={r.id}>
                      <AdminTableCell>
                        <AdminTableLead title={r.name} />
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableChip>{r.subdomain}</AdminTableChip>
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[180px] whitespace-normal">
                        <AdminTableMuted className="block truncate">
                          {r.owner.email ?? '—'}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell>
                        {r.subscription ? (
                          <Badge
                            variant="secondary"
                            className="rounded-md font-medium"
                          >
                            {planLabel(r.subscription.plan)}
                          </Badge>
                        ) : (
                          <AdminTableMuted>
                            {t('admin.subscriptions.notSet')}
                          </AdminTableMuted>
                        )}
                      </AdminTableCell>
                      <AdminTableCell>
                        {r.subscription ? (
                          <Badge
                            variant={
                              r.subscription.status === 'ACTIVE'
                                ? 'default'
                                : r.subscription.status === 'TRIAL'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="rounded-md"
                          >
                            {r.subscription.status}
                          </Badge>
                        ) : (
                          <AdminTableMuted>—</AdminTableMuted>
                        )}
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>
                          {r.subscription?.status === 'TRIAL'
                            ? formatPeriodEnd(r.subscription.trialEndsAt)
                            : formatPeriodEnd(
                                r.subscription?.currentPeriodEnd ?? null
                              )}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() => setEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
          </AdminTableWrapper>
        </CardContent>
      </Card>

      <CustomPlanRequestsPanel />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>{t('admin.subscriptions.catalogTitle')}</CardTitle>
          <CardDescription>
            {t('admin.subscriptions.catalogDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {localizedCatalog.length === 0 ? (
              <AdminTableEmpty>
                {t('admin.subscriptions.noCatalog')}
              </AdminTableEmpty>
            ) : (
              <AdminTable minWidth={720}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>
                      {t('admin.subscriptions.colPlanKey')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colName')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colPrice')}
                    </AdminTableHead>
                    <AdminTableHead>
                      {t('admin.subscriptions.colDescription')}
                    </AdminTableHead>
                    <AdminTableHead className="w-24 text-right">
                      {t('admin.subscriptions.colEdit')}
                    </AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {localizedCatalog.map((p) => (
                    <AdminTableRow key={p.id}>
                      <AdminTableCell>
                        <Badge
                          variant="secondary"
                          className="rounded-md font-mono text-[11px]"
                        >
                          {p.plan}
                        </Badge>
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableLead title={p.name} accent="#7c3aed" />
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="font-semibold tabular-nums">
                          {p.priceLabel}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[320px] whitespace-normal">
                        <AdminTableMuted className="block truncate">
                          {p.description}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() =>
                            setEditingPlan(
                              catalogPlans.find((c) => c.id === p.id) ?? p
                            )
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
          </AdminTableWrapper>
        </CardContent>
      </Card>

      {edit && (
        <SubscriptionEditDialog
          open={!!edit}
          onOpenChange={(o) => {
            if (!o) setEdit(null);
          }}
          restaurantId={edit.id}
          restaurantName={edit.name}
          subscription={edit.subscription}
          onSaved={load}
        />
      )}

      <PlanEditDialog
        open={!!editingPlan}
        onOpenChange={(o) => {
          if (!o) setEditingPlan(null);
        }}
        plan={editingPlan}
        onSaved={loadCatalog}
      />
    </div>
  );
}
