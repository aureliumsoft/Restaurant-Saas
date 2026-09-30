'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, RefreshCcw } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
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
import { SearchField } from '@/components/ui/search-field';
import { TablePagination } from '@/components/ui/table-pagination';
import {
  formatInTimezone,
  getClientSubscriptionAdminTimezone,
} from '@/lib/subscription-timezone-client';
import { cn } from '@/lib/utils';

type AdminTxnRow = {
  id: string;
  kind: 'SUBSCRIPTION';
  amount: number;
  currency: string;
  paidAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  notes: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantSubdomain: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
};

const PAGE_SIZE = 20;
const ADMIN_TZ = getClientSubscriptionAdminTimezone();

export default function AdminTransactionsPage() {
  const [rows, setRows] = useState<AdminTxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{
        data: AdminTxnRow[];
        meta: { total: number; totalPages: number; page: number };
      }>('/api/admin/transactions', {
        params: {
          q: appliedQ || undefined,
          page,
          limit: PAGE_SIZE,
        },
      });
      setRows(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
      setTotalPages(res.data.meta?.totalPages ?? 1);
      setPage(res.data.meta?.page ?? page);
    } catch {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [appliedQ, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="SaaS transactions"
        description="Subscription and registration billing payments across restaurants. Restaurant order and inventory transactions stay in each restaurant dashboard."
      />

      <Card className={cn(adminCardClass)}>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Subscription payments</CardTitle>
            <CardDescription>
              {total.toLocaleString()} payment{total === 1 ? '' : 's'}
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <SearchField
              className="min-w-[220px] flex-1"
              value={q}
              onChange={setQ}
              onSearch={() => {
                setPage(1);
                setAppliedQ(q.trim());
              }}
              onClear={() => {
                setQ('');
                setAppliedQ('');
                setPage(1);
              }}
              appliedValue={appliedQ}
              placeholder="Search restaurant, notes, currency…"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void load()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <AdminTableEmpty>
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </AdminTableEmpty>
          ) : rows.length === 0 ? (
            <AdminTableEmpty>No subscription payments found.</AdminTableEmpty>
          ) : (
            <AdminTableWrapper>
              <AdminTable>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Paid at</AdminTableHead>
                    <AdminTableHead>Restaurant</AdminTableHead>
                    <AdminTableHead>Type</AdminTableHead>
                    <AdminTableHead>Plan</AdminTableHead>
                    <AdminTableHead>Period</AdminTableHead>
                    <AdminTableHead className="text-right">Amount</AdminTableHead>
                    <AdminTableHead>Notes</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {rows.map((row) => (
                    <AdminTableRow key={row.id}>
                      <AdminTableCell className="whitespace-nowrap tabular-nums">
                        {formatInTimezone(row.paidAt, ADMIN_TZ)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="font-medium">{row.restaurantName}</div>
                        {row.restaurantSubdomain ? (
                          <AdminTableMuted>
                            {row.restaurantSubdomain}
                          </AdminTableMuted>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell>
                        <Badge variant="secondary">Subscription</Badge>
                      </AdminTableCell>
                      <AdminTableCell>
                        {row.plan ?? '—'}
                        {row.subscriptionStatus ? (
                          <AdminTableMuted>
                            {row.subscriptionStatus}
                          </AdminTableMuted>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell className="text-xs text-muted-foreground">
                        {row.periodStart || row.periodEnd
                          ? `${formatInTimezone(row.periodStart, ADMIN_TZ)} → ${formatInTimezone(row.periodEnd, ADMIN_TZ)}`
                          : '—'}
                      </AdminTableCell>
                      <AdminTableCell className="text-right tabular-nums font-medium">
                        {row.amount.toLocaleString(undefined, {
                          style: 'currency',
                          currency: row.currency || 'EUR',
                        })}
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.notes ?? '—'}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            </AdminTableWrapper>
          )}

          <TablePagination
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total,
              totalPages,
            }}
            page={page}
            onPageChange={setPage}
            loading={loading}
            hideWhenSinglePage={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
