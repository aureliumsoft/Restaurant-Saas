'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
      toast.success(`Email sent to ${request.email}.`);
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      const msg = apiErrorMessage(
        error,
        'Could not send email. Check SMTP settings in .env.'
      );
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-2 border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Send demo access email
          </DialogTitle>
          <DialogDescription>
            Review the email below, then send it via SMTP to the requester.
          </DialogDescription>
        </DialogHeader>

        {request ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  To
                </dt>
                <dd className="mt-0.5 font-medium">{request.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Subject
                </dt>
                <dd className="mt-0.5 font-medium">{DEMO_REPLY_EMAIL_SUBJECT}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recipient
                </dt>
                <dd className="mt-0.5">
                  {request.name} · {request.restaurantName}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email preview
              </p>
              <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-950">
                <iframe
                  title="Demo request email preview"
                  srcDoc={emailHtml}
                  className="h-[min(420px,50vh)] w-full border-0 bg-white"
                  sandbox=""
                />
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!request || sending}
            onClick={() => void handleSend()}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
