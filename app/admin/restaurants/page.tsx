'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRestaurantStorefrontLink } from '@/components/admin/admin-restaurant-storefront-link';
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
  AdminTableNumeric,
  AdminTableRow,
  AdminTableWrapper,
} from '@/components/admin/admin-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logoUrl: string | null;
  createdAt: string;
  owner: { id: string; name: string; email: string | null };
  subscription: {
    plan: string;
    status: string;
  } | null;
  _count: { orders: number; menuItems: number };
};

type MigrateResult = {
  scanned: number;
  migrated: number;
  failed: number;
};

export default function AdminRestaurantsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [migratingId, setMigratingId] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get('/api/admin/restaurants')
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  async function migrateImages(row: Row) {
    if (
      !window.confirm(
        t('admin.restaurants.migrateImagesConfirm', { name: row.name })
      )
    ) {
      return;
    }
    setMigratingId(row.id);
    try {
      const res = await axios.post<{ data: MigrateResult }>(
        `/api/admin/restaurants/${encodeURIComponent(row.id)}/migrate-images`,
        { dryRun: false },
        { timeout: 290_000 }
      );
      const data = res.data.data;
      toast.success(
        t('admin.restaurants.migrateImagesSuccess', {
          migrated: data.migrated,
          scanned: data.scanned,
          failed: data.failed,
        })
      );
    } catch (e) {
      const message =
        axios.isAxiosError(e) &&
        typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : t('admin.restaurants.migrateImagesFailed');
      toast.error(message);
    } finally {
      setMigratingId(null);
    }
  }

  if (loading) {
    return <Loader2 className="text-primary animate-spin text-center mx-auto" />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={t('admin.restaurants.eyebrow')}
        title={t('admin.restaurants.title')}
        description={t('admin.restaurants.description')}
      />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>{t('admin.restaurants.directoryTitle')}</CardTitle>
          <CardDescription>{t('admin.restaurants.directoryDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
          {rows.length === 0 ? (
            <AdminTableEmpty>{t('admin.restaurants.empty')}</AdminTableEmpty>
          ) : (
            <AdminTable minWidth={1080}>
              <AdminTableHeader>
                <AdminTableRow>
                  <AdminTableHead>{t('admin.restaurants.colRestaurant')}</AdminTableHead>
                  <AdminTableHead>{t('admin.restaurants.colSubdomain')}</AdminTableHead>
                  <AdminTableHead>{t('admin.restaurants.colOwner')}</AdminTableHead>
                  <AdminTableHead>{t('admin.restaurants.colPlan')}</AdminTableHead>
                  <AdminTableHead className="text-right">{t('admin.restaurants.colMenuItems')}</AdminTableHead>
                  <AdminTableHead className="text-right">{t('admin.restaurants.colOrders')}</AdminTableHead>
                  <AdminTableHead>{t('admin.restaurants.colCreated')}</AdminTableHead>
                  <AdminTableHead>{t('admin.restaurants.colActions')}</AdminTableHead>
                  <AdminTableHead className="w-12">
                    <span className="sr-only">{t('admin.restaurants.colStorefront')}</span>
                  </AdminTableHead>
                </AdminTableRow>
              </AdminTableHeader>
              <AdminTableBody>
                {rows.map((r) => (
                  <AdminTableRow key={r.id}>
                    <AdminTableCell>
                      <AdminTableLead title={r.name} subtitle={r.slug} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <AdminTableChip>{r.subdomain}</AdminTableChip>
                    </AdminTableCell>
                    <AdminTableCell className="max-w-[200px]">
                      <AdminTableMuted className="truncate block">
                        {r.owner.email ?? r.owner.name}
                      </AdminTableMuted>
                    </AdminTableCell>
                    <AdminTableCell>
                      {r.subscription ? (
                        <Badge variant="secondary" className="rounded-md font-medium">
                          {r.subscription.plan}
                        </Badge>
                      ) : (
                        <AdminTableMuted>—</AdminTableMuted>
                      )}
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <AdminTableNumeric>{r._count.menuItems}</AdminTableNumeric>
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <AdminTableNumeric>{r._count.orders}</AdminTableNumeric>
                    </AdminTableCell>
                    <AdminTableCell>
                      <AdminTableMuted>
                        {format(new Date(r.createdAt), 'MMM d, yyyy')}
                      </AdminTableMuted>
                    </AdminTableCell>
                    <AdminTableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={migratingId != null}
                        onClick={() => void migrateImages(r)}
                      >
                        {migratingId === r.id ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            {t('admin.restaurants.migrateImagesWorking')}
                          </>
                        ) : (
                          t('admin.restaurants.migrateImages')
                        )}
                      </Button>
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <AdminRestaurantStorefrontLink slug={r.slug} />
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
