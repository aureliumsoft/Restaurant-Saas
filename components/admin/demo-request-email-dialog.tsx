'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  buildDemoReplyEmailHtml,
  DEMO_REPLY_EMAIL_SUBJECT,
} from '@/lib/demo-request-email';
import { getPublicAppOrigin } from '@/lib/public-app-origin';
import { apiErrorMessage } from '@/lib/api-error-message';

export type DemoRequestEmailRow = {
  id: string;
  name: string;
  email: string;
  restaurantName: string;
};

type Props = {
  request: DemoRequestEmailRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
};

export function DemoRequestEmailDialog({
  request,
  open,
  onOpenChange,
  onSent,
}: Props) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);

  const emailHtml = useMemo(() => {
    if (!request) return '';
    return buildDemoReplyEmailHtml(
      {
        name: request.name,
        email: request.email,
        restaurantName: request.restaurantName,
      },
      getPublicAppOrigin()
    );
  }, [request]);

  const handleSend = async () => {
    if (!request || sending) return;
    setSending(true);
    try {
      await axios.post(`/api/admin/requests/${request.id}/email`);
      toast.success(t('admin.demoEmail.sentSuccess', { email: request.email }));
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      const msg = apiErrorMessage(
        error,
        t('admin.demoEmail.sendError')
      );
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  if (!open || !request) return null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-0 text-muted-foreground"
          disabled={sending}
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mail className="h-5 w-5 text-muted-foreground" />
          {t('admin.demoEmail.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.demoEmail.description')}
        </p>
      </div>

      <div className="space-y-4">
            <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('admin.demoEmail.to')}
                </dt>
                <dd className="mt-0.5 font-medium">{request.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('admin.demoEmail.subject')}
                </dt>
                <dd className="mt-0.5 font-medium">{DEMO_REPLY_EMAIL_SUBJECT}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('admin.demoEmail.recipient')}
                </dt>
                <dd className="mt-0.5">
                  {request.name} · {request.restaurantName}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('admin.demoEmail.preview')}
              </p>
              <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-950">
                <iframe
                  title={t('admin.demoEmail.previewIframeTitle')}
                  srcDoc={emailHtml}
                  className="h-[min(420px,50vh)] w-full border-0 bg-white"
                  sandbox=""
                />
              </div>
            </div>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={sending}
        onClick={() => void handleSend()}
      >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('admin.demoEmail.sending')}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t('admin.demoEmail.send')}
              </>
            )}
      </Button>
    </div>
  );
}
