'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

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

export default function AdminRestaurantsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/api/admin/restaurants')
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Loader2 className="text-primary animate-spin text-center mx-auto" />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Management"
        title="Restaurants"
        description="All tenant restaurants, owners, and catalog activity."
      />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>Subdomain, owner, and catalog size.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
          {rows.length === 0 ? (
            <AdminTableEmpty>No restaurants yet.</AdminTableEmpty>
          ) : (
            <AdminTable minWidth={920}>
              <AdminTableHeader>
                <AdminTableRow>
                  <AdminTableHead>Restaurant</AdminTableHead>
                  <AdminTableHead>Subdomain</AdminTableHead>
                  <AdminTableHead>Owner</AdminTableHead>
                  <AdminTableHead>Plan</AdminTableHead>
                  <AdminTableHead className="text-right">Menu items</AdminTableHead>
                  <AdminTableHead className="text-right">Orders</AdminTableHead>
                  <AdminTableHead>Created</AdminTableHead>
                  <AdminTableHead className="w-12">
                    <span className="sr-only">Storefront</span>
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
