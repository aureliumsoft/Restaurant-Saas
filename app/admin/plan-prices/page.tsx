'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Pencil } from 'lucide-react';
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
import { PlanEditDialog, type CatalogPlan } from '@/components/admin/plan-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { cn } from '@/lib/utils';

export default function AdminPlanPricesPage() {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<CatalogPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCatalog = useCallback(() => {
    setLoading(true);
    axios
      .get<{ data: CatalogPlan[] }>('/api/admin/pricing-plans')
      .then((r) => setCatalogPlans(r.data.data ?? []))
      .catch(() => setCatalogPlans([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const localizedCatalog = useMemo(
    () =>
      catalogPlans.map((plan) => ({
        ...plan,
        name: resolveBilingualText(plan.name, uiLang),
        priceLabel: resolveBilingualText(plan.priceLabel, uiLang),
        description: resolveBilingualText(plan.description, uiLang),
      })),
    [catalogPlans, uiLang]
  );

  if (editingPlan) {
    return (
      <PlanEditDialog
        open
        onOpenChange={(open) => {
          if (!open) setEditingPlan(null);
        }}
        plan={editingPlan}
        onSaved={loadCatalog}
      />
    );
  }

  if (loading) {
    return <Loader2 className="mx-auto animate-spin text-center text-primary" />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={t('admin.nav.groupBilling')}
        title={t('admin.nav.planPrices')}
        description={t('admin.subscriptions.catalogDescription')}
      />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>{t('admin.subscriptions.catalogTitle')}</CardTitle>
          <CardDescription>{t('admin.subscriptions.catalogKeepsRestaurants')}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {localizedCatalog.length === 0 ? (
              <AdminTableEmpty>{t('admin.subscriptions.noCatalog')}</AdminTableEmpty>
            ) : (
              <AdminTable minWidth={720}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>{t('admin.subscriptions.colPlanKey')}</AdminTableHead>
                    <AdminTableHead>{t('admin.subscriptions.colName')}</AdminTableHead>
                    <AdminTableHead>{t('admin.subscriptions.colPrice')}</AdminTableHead>
                    <AdminTableHead>{t('admin.subscriptions.colDescription')}</AdminTableHead>
                    <AdminTableHead className="w-24 text-right">
                      {t('admin.subscriptions.colEdit')}
                    </AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {localizedCatalog.map((plan) => (
                    <AdminTableRow key={plan.id}>
                      <AdminTableCell>
                        <Badge variant="secondary" className="rounded-md font-mono text-[11px]">
                          {plan.plan}
                        </Badge>
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableLead title={plan.name} accent="#7c3aed" />
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="font-semibold tabular-nums">{plan.priceLabel}</span>
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[320px] whitespace-normal">
                        <AdminTableMuted className="block truncate">{plan.description}</AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() =>
                            setEditingPlan(catalogPlans.find((item) => item.id === plan.id) ?? plan)
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

    </div>
  );
}
