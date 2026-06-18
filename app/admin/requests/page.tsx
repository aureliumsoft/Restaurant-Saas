'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type RequestRow = {
  id: string;
  name: string;
  email: string;
  restaurantName: string;
  createdAt: string;
};

export default function AdminRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    axios
      .get<{ data: RequestRow[] }>('/api/admin/requests')
      .then((r) => {
        if (mounted) setRows(r.data.data ?? []);
      })
      .catch(() => {
        if (mounted) setError('Could not load demo requests.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Management"
        title="Demo requests"
        description="All demo requests submitted from the public marketing site."
      />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>Demo requests</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
          {loading ? (
            <Loader2 className="text-primary animate-spin text-center mx-auto" />
          ) : error ? (
            <p className="px-4 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <AdminTableEmpty>No requests yet.</AdminTableEmpty>
          ) : (
            <AdminTable minWidth={600}>
              <AdminTableHeader>
                <AdminTableRow>
                  <AdminTableHead>Contact</AdminTableHead>
                  <AdminTableHead>Restaurant</AdminTableHead>
                  <AdminTableHead>Requested</AdminTableHead>
                </AdminTableRow>
              </AdminTableHeader>
              <AdminTableBody>
                {rows.map((r) => (
                  <AdminTableRow key={r.id}>
                    <AdminTableCell>
                      <AdminTableLead title={r.name} subtitle={r.email} accent="#0ea5e9" />
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className="font-medium">{r.restaurantName}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <AdminTableMuted>
                        {format(new Date(r.createdAt), 'MMM d, yyyy · h:mm a')}
                      </AdminTableMuted>
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
