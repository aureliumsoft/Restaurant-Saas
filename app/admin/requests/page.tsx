'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DemoRequestEmailDialog } from '@/components/admin/demo-request-email-dialog';
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
  const { t } = useTranslation();
  return (
    <Card className={cn(adminCardClass, 'border-sky-200/80 bg-sky-50/50 dark:border-sky-500/30 dark:bg-sky-950/20')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('admin.requests.demoCredsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          {t('admin.requests.demoCredsDescription')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('admin.requests.emailLabel')}
            </p>
            <p className="font-mono font-medium">{DEMO_OWNER_EMAIL}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('admin.requests.passwordLabel')}
            </p>
            <p className="font-mono font-medium">{DEMO_OWNER_PASSWORD}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminRequestsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailRequest, setEmailRequest] = useState<RequestRow | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    axios
      .get<{ data: RequestRow[] }>('/api/admin/requests')
      .then((r) => {
        if (mounted) setRows(r.data.data ?? []);
      })
      .catch(() => {
        if (mounted) setError(t('admin.requests.loadError'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const openEmailDialog = (row: RequestRow) => {
    setEmailRequest(row);
    setEmailDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={t('admin.requests.eyebrow')}
        title={t('admin.requests.title')}
        description={t('admin.requests.description')}
      />

      <DemoCredentialsNotice />

      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>{t('admin.requests.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {loading ? (
              <Loader2 className="mx-auto animate-spin text-center text-primary" />
            ) : error ? (
              <p className="px-4 text-sm text-destructive">{error}</p>
            ) : rows.length === 0 ? (
              <AdminTableEmpty>{t('admin.requests.empty')}</AdminTableEmpty>
            ) : (
              <AdminTable minWidth={720}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>{t('admin.requests.colContact')}</AdminTableHead>
                    <AdminTableHead>{t('admin.requests.colRestaurant')}</AdminTableHead>
                    <AdminTableHead>{t('admin.requests.colRequested')}</AdminTableHead>
                    <AdminTableHead className="text-right">{t('admin.requests.colActions')}</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {rows.map((r) => (
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
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          title={t('admin.requests.previewSendTitle')}
                          onClick={() => openEmailDialog(r)}
                        >
                          <Mail className="h-4 w-4" />
                          <span className="sr-only">{t('admin.requests.emailRequesterSr')}</span>
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

      <DemoRequestEmailDialog
        request={emailRequest}
        open={emailDialogOpen}
        onOpenChange={(open) => {
          setEmailDialogOpen(open);
          if (!open) setEmailRequest(null);
        }}
      />
    </div>
  );
}
