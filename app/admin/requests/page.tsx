'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Copy, Loader2, Mail } from 'lucide-react';
import { toast } from 'react-toastify';

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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  buildDemoReplyEmailHtml,
  buildDemoReplyMailto,
} from '@/lib/demo-request-email';
import {
  DEMO_OWNER_EMAIL,
  DEMO_OWNER_PASSWORD,
} from '@/lib/demo-restaurant';
import { cn } from '@/lib/utils';

type RequestRow = {
  id: string;
  name: string;
  email: string;
  restaurantName: string;
  createdAt: string;
};

function DemoCredentialsNotice() {
  return (
    <Card className={cn(adminCardClass, 'border-sky-200/80 bg-sky-50/50 dark:border-sky-500/30 dark:bg-sky-950/20')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Demo restaurant credentials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Included automatically in reply emails to demo requesters.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </p>
            <p className="font-mono font-medium">{DEMO_OWNER_EMAIL}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Password
            </p>
            <p className="font-mono font-medium">{DEMO_OWNER_PASSWORD}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

  const copyHtmlTemplate = useCallback(async (row: RequestRow) => {
    const html = buildDemoReplyEmailHtml({
      name: row.name,
      email: row.email,
      restaurantName: row.restaurantName,
    });
    try {
      await navigator.clipboard.writeText(html);
      toast.success('HTML email template copied. Paste into your email client.');
    } catch {
      toast.error('Could not copy email template.');
    }
  }, []);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Management"
        title="Demo requests"
        description="All demo requests submitted from the public marketing site."
      />

      <DemoCredentialsNotice />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>Demo requests</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {loading ? (
              <Loader2 className="mx-auto animate-spin text-center text-primary" />
            ) : error ? (
              <p className="px-4 text-sm text-destructive">{error}</p>
            ) : rows.length === 0 ? (
              <AdminTableEmpty>No requests yet.</AdminTableEmpty>
            ) : (
              <AdminTable minWidth={720}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Contact</AdminTableHead>
                    <AdminTableHead>Restaurant</AdminTableHead>
                    <AdminTableHead>Requested</AdminTableHead>
                    <AdminTableHead className="text-right">Actions</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {rows.map((r) => {
                    const mailto = buildDemoReplyMailto({
                      name: r.name,
                      email: r.email,
                      restaurantName: r.restaurantName,
                    });

                    return (
                      <AdminTableRow key={r.id}>
                        <AdminTableCell>
                          <AdminTableLead
                            title={r.name}
                            subtitle={r.email}
                            accent="#0ea5e9"
                          />
                        </AdminTableCell>
                        <AdminTableCell>
                          <span className="font-medium">{r.restaurantName}</span>
                        </AdminTableCell>
                        <AdminTableCell>
                          <AdminTableMuted>
                            {format(new Date(r.createdAt), 'MMM d, yyyy · h:mm a')}
                          </AdminTableMuted>
                        </AdminTableCell>
                        <AdminTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              title="Email requester (includes sign-in link and demo credentials)"
                              asChild
                            >
                              <a href={mailto}>
                                <Mail className="h-4 w-4" />
                                <span className="sr-only">Email requester</span>
                              </a>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              title="Copy HTML email with sign-in button"
                              onClick={() => void copyHtmlTemplate(r)}
                            >
                              <Copy className="h-4 w-4" />
                              <span className="sr-only">Copy HTML email</span>
                            </Button>
                          </div>
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
    </div>
  );
}
