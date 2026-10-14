'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRICING_MODULE_ROWS } from '@/lib/pricing-comparison';
import { cn } from '@/lib/utils';

type RestaurantOption = {
  id: string;
  name: string;
  slug: string;
};

type CustomRequestRow = {
  id: string;
  name: string;
  email: string;
  restaurantName: string;
  restaurantId: string | null;
  restaurant: RestaurantOption | null;
  selectedModules: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewedAt: string | null;
  createdAt: string;
};

export function CustomPlanRequestsPanel() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CustomRequestRow[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [linkByRequest, setLinkByRequest] = useState<Record<string, string>>(
    {}
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const moduleLabel = useCallback(
    (id: string) => {
      const key = `marketingExtras.pricing.modules.${id}`;
      const translated = t(key);
      if (translated !== key) return translated;
      return PRICING_MODULE_ROWS.find((r) => r.id === id)?.label ?? id;
    },
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, restRes] = await Promise.all([
        axios.get<{ data: CustomRequestRow[] }>(
          '/api/admin/custom-plan-requests'
        ),
        axios.get<{ data: RestaurantOption[] }>('/api/admin/restaurants'),
      ]);
      setRows(reqRes.data.data ?? []);
      setRestaurants(
        (restRes.data.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
        }))
      );
      const links: Record<string, string> = {};
      for (const r of reqRes.data.data ?? []) {
        if (r.restaurantId) links[r.id] = r.restaurantId;
      }
      setLinkByRequest(links);
    } catch {
      setError(t('admin.subscriptions.custom.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(row: CustomRequestRow, action: 'accept' | 'reject') {
    const restaurantId = linkByRequest[row.id] || row.restaurantId || undefined;
    if (!restaurantId) {
      toast.error(t('admin.subscriptions.custom.selectRestaurantFirst'));
      return;
    }
    setBusyId(row.id);
    try {
      await axios.patch(`/api/admin/custom-plan-requests/${row.id}`, {
        action,
        restaurantId,
      });
      toast.success(
        action === 'accept'
          ? t('admin.subscriptions.custom.acceptSuccess')
          : t('admin.subscriptions.custom.rejectSuccess')
      );
      await load();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : t('admin.subscriptions.custom.actionFailed');
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  function statusBadge(status: CustomRequestRow['status']) {
    if (status === 'ACCEPTED') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
          {t('admin.subscriptions.custom.statusAccepted')}
        </Badge>
      );
    }
    if (status === 'REJECTED') {
      return (
        <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:text-red-400">
          {t('admin.subscriptions.custom.statusRejected')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/15 dark:text-amber-300">
        {t('admin.subscriptions.custom.statusPending')}
      </Badge>
    );
  }

  return (
    <Card
      id="custom-plans"
      className={cn(adminCardClass, 'min-w-0 max-w-full scroll-mt-8')}
    >
      <CardHeader>
        <CardTitle>{t('admin.subscriptions.custom.title')}</CardTitle>
        <CardDescription>
          {t('admin.subscriptions.custom.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 p-0">
        <AdminTableWrapper>
          {loading ? (
            <Loader2 className="mx-auto animate-spin text-center text-primary" />
          ) : error ? (
            <p className="px-4 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <AdminTableEmpty>
              {t('admin.subscriptions.custom.empty')}
            </AdminTableEmpty>
          ) : (
            <AdminTable minWidth={960}>
              <AdminTableHeader>
                <AdminTableRow>
                  <AdminTableHead>
                    {t('admin.subscriptions.custom.colContact')}
                  </AdminTableHead>
                  <AdminTableHead>
                    {t('admin.subscriptions.custom.colRestaurant')}
                  </AdminTableHead>
                  <AdminTableHead>
                    {t('admin.subscriptions.custom.colModules')}
                  </AdminTableHead>
                  <AdminTableHead>
                    {t('admin.subscriptions.custom.colStatus')}
                  </AdminTableHead>
                  <AdminTableHead>
                    {t('admin.subscriptions.custom.colRequested')}
                  </AdminTableHead>
                  <AdminTableHead className="text-right">
                    {t('admin.subscriptions.custom.colActions')}
                  </AdminTableHead>
                </AdminTableRow>
              </AdminTableHeader>
              <AdminTableBody>
                {rows.map((r) => {
                  const pending = r.status === 'PENDING';
                  const busy = busyId === r.id;
                  return (
                    <AdminTableRow key={r.id}>
                      <AdminTableCell>
                        <AdminTableLead
                          title={r.name}
                          subtitle={r.email}
                          accent="#7c3aed"
                        />
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="space-y-2">
                          <span className="font-medium">
                            {r.restaurant?.name ?? r.restaurantName}
                          </span>
                          {r.restaurant?.slug ? (
                            <AdminTableMuted>
                              /{r.restaurant.slug}
                            </AdminTableMuted>
                          ) : null}
                          {pending ? (
                            <Select
                              value={linkByRequest[r.id]}
                              onValueChange={(v) =>
                                setLinkByRequest((prev) => ({
                                  ...prev,
                                  [r.id]: v,
                                }))
                              }
                            >
                              <SelectTrigger className="mt-1 h-8 w-[220px] text-xs">
                                <SelectValue
                                  placeholder={t(
                                    'admin.subscriptions.custom.linkRestaurant'
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {restaurants.map((rest) => (
                                  <SelectItem key={rest.id} value={rest.id}>
                                    {rest.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex max-w-[240px] flex-wrap gap-1">
                          {r.selectedModules.length === 0 ? (
                            <AdminTableMuted>—</AdminTableMuted>
                          ) : (
                            r.selectedModules.slice(0, 8).map((id) => (
                              <Badge
                                key={id}
                                variant="outline"
                                className="text-[10px] font-normal"
                              >
                                {moduleLabel(id)}
                              </Badge>
                            ))
                          )}
                          {r.selectedModules.length > 8 ? (
                            <AdminTableMuted>
                              +{r.selectedModules.length - 8}{' '}
                              {t('admin.subscriptions.custom.more')}
                            </AdminTableMuted>
                          ) : null}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>{statusBadge(r.status)}</AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>
                          {format(
                            new Date(r.createdAt),
                            'MMM d, yyyy · h:mm a'
                          )}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        {pending ? (
                          <div className="inline-flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              className="bg-emerald-600 text-white hover:bg-emerald-500"
                              onClick={() => void decide(r, 'accept')}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="mr-1 h-4 w-4" />
                                  {t('admin.subscriptions.custom.accept')}
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-950/30"
                              onClick={() => void decide(r, 'reject')}
                            >
                              <X className="mr-1 h-4 w-4" />
                              {t('admin.subscriptions.custom.reject')}
                            </Button>
                          </div>
                        ) : (
                          <AdminTableMuted>
                            {r.reviewedAt
                              ? format(new Date(r.reviewedAt), 'MMM d, yyyy')
                              : '—'}
                          </AdminTableMuted>
                        )}
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })}
              </AdminTableBody>
            </AdminTable>
          )}
        </AdminTableWrapper>
      </CardContent>
    </Card>
  );
}
