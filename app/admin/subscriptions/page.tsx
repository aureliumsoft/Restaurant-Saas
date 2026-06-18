'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Pencil } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
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
} | null;

type Row = {
  id: string;
  name: string;
  subdomain: string;
  owner: { email: string | null };
  subscription: Subscription;
};

const ADMIN_TZ = getClientSubscriptionAdminTimezone();

function formatPeriodEnd(iso: string | null | undefined): string {
  return formatInTimezone(iso, ADMIN_TZ);
}

export default function AdminSubscriptionsPage() {
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

  if (loading) {
    return (
      <Loader2 className="text-primary animate-spin text-center mx-auto" />
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Management"
        title="Subscriptions"
        description="Plans, trial periods, expiry dates, and payment logs per restaurant."
      />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>Plans &amp; status</CardTitle>
          <CardDescription>
            Edit trial windows and plan tiers for each tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
          {rows.length === 0 ? (
            <AdminTableEmpty>No restaurants yet.</AdminTableEmpty>
          ) : (
            <AdminTable minWidth={960}>
              <AdminTableHeader>
                <AdminTableRow>
                  <AdminTableHead>Restaurant</AdminTableHead>
                  <AdminTableHead>Subdomain</AdminTableHead>
                  <AdminTableHead>Owner</AdminTableHead>
                  <AdminTableHead>Plan</AdminTableHead>
                  <AdminTableHead>Status</AdminTableHead>
                  <AdminTableHead>Period ends</AdminTableHead>
                  <AdminTableHead className="w-24 text-right">Edit</AdminTableHead>
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
                      <AdminTableMuted className="truncate block">
                        {r.owner.email ?? '—'}
                      </AdminTableMuted>
                    </AdminTableCell>
                    <AdminTableCell>
                      {r.subscription ? (
                        <Badge variant="secondary" className="rounded-md font-medium">
                          {r.subscription.plan}
                        </Badge>
                      ) : (
                        <AdminTableMuted>Not set</AdminTableMuted>
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
                          : formatPeriodEnd(r.subscription?.currentPeriodEnd ?? null)}
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

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>Pricing catalog (3 fixed plans)</CardTitle>
          <CardDescription>
            Admin can update name, price, description, and features for Starter,
            Growth, and Scale.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
          {catalogPlans.length === 0 ? (
            <AdminTableEmpty>No pricing plans found.</AdminTableEmpty>
          ) : (
            <AdminTable minWidth={720}>
              <AdminTableHeader>
                <AdminTableRow>
                  <AdminTableHead>Plan Key</AdminTableHead>
                  <AdminTableHead>Name</AdminTableHead>
                  <AdminTableHead>Price</AdminTableHead>
                  <AdminTableHead>Description</AdminTableHead>
                  <AdminTableHead className="w-24 text-right">Edit</AdminTableHead>
                </AdminTableRow>
              </AdminTableHeader>
              <AdminTableBody>
                {catalogPlans.map((p) => (
                  <AdminTableRow key={p.id}>
                    <AdminTableCell>
                      <Badge variant="secondary" className="rounded-md font-mono text-[11px]">
                        {p.plan}
                      </Badge>
                    </AdminTableCell>
                    <AdminTableCell>
                      <AdminTableLead title={p.name} accent="#7c3aed" />
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className="font-semibold tabular-nums">{p.priceLabel}</span>
                    </AdminTableCell>
                    <AdminTableCell className="max-w-[320px] whitespace-normal">
                      <AdminTableMuted className="truncate block">{p.description}</AdminTableMuted>
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => setEditingPlan(p)}
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
