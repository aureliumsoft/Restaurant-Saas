'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Loader2, Mail, Trash2, Send } from 'lucide-react';
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
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type SubscriberRow = {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
};

type CampaignRow = {
  id: string;
  subject: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  sentByEmail: string | null;
  sentAt: string;
  status: string;
};

type NewsletterPayload = {
  activeCount: number;
  subscribers: SubscriberRow[];
  campaigns: CampaignRow[];
};

export default function AdminNewsletterPage() {
  const [data, setData] = useState<NewsletterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await axios.get<{ data: NewsletterPayload }>(
        '/api/admin/newsletter'
      );
      setData(r.data.data);
    } catch {
      setError('Could not load newsletter data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeSubscribers =
    data?.subscribers.filter((s) => !s.unsubscribedAt) ?? [];
  const inactiveSubscribers =
    data?.subscribers.filter((s) => s.unsubscribedAt) ?? [];

  const requestSave = () => {
    if (!subject.trim() || body.trim().length < 10) {
      toast.error('Enter a subject and a message (at least a short paragraph).');
      return;
    }
    setShowSaveConfirmation(true);
  };

  const onSend = async () => {
    setSending(true);
    try {
      // Convert plain text / simple line breaks to HTML paragraphs.
      const htmlBody = body
        .split(/\n{2,}/)
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
        .join('\n');

      const r = await axios.post<{
        data: CampaignRow & { errors?: string[] };
      }>('/api/admin/newsletter/send', {
        subject: subject.trim(),
        htmlBody,
        textBody: body.trim(),
      });

      if (r.data.data.recipientCount === 0) {
        toast.success('Message saved. New subscribers will receive it by email.');
      } else {
        toast.success(
          `Saved and sent to ${r.data.data.successCount} of ${r.data.data.recipientCount} subscribers.`
        );
      }
      if (r.data.data.errors?.length) {
        toast.warn(r.data.data.errors[0]);
      }
      setSubject('');
      setBody('');
      setShowSaveConfirmation(false);
      await load();
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && typeof e.response?.data?.error === 'string'
          ? e.response.data.error
          : 'Failed to save and send newsletter.';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const onUnsubscribe = async (id: string) => {
    const confirmed = window.confirm('Remove this subscriber from the list?');
    if (!confirmed) return;
    setRemovingId(id);
    try {
      await axios.delete(`/api/admin/newsletter/${id}`);
      toast.success('Subscriber removed.');
      await load();
    } catch {
      toast.error('Could not remove subscriber.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Management"
        title="Newsletter"
        description="Save a message to the database, email all subscribers, and auto-send the latest message when someone new subscribes."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={adminCardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {loading ? '—' : (data?.activeCount ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unsubscribed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {loading ? '—' : inactiveSubscribers.length}
            </p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {loading ? '—' : (data?.campaigns.length ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Compose, save &amp; send
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newsletter-subject">Subject</Label>
            <Input
              id="newsletter-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's new at Foodluk"
              maxLength={200}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newsletter-body">Message</Label>
            <Textarea
              id="newsletter-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your update. Use a blank line between paragraphs."
              rows={8}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">
              Saving stores this as the latest newsletter, emails every active
              subscriber, and sends this message automatically to anyone who
              subscribes later.
            </p>
          </div>
          <Button
            type="button"
            onClick={requestSave}
            disabled={sending || loading}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving &amp; sending…
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {(data?.activeCount ?? 0) === 0
                  ? 'Save message'
                  : `Save & send to ${data?.activeCount ?? 0} subscribers`}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <SaveConfirmation
        open={showSaveConfirmation}
        title={
          (data?.activeCount ?? 0) === 0
            ? 'Save newsletter message'
            : 'Save & send newsletter'
        }
        description={
          (data?.activeCount ?? 0) === 0
            ? 'No active subscribers yet. This message will be stored and emailed automatically when someone new subscribes.'
            : `This message will be saved and emailed to ${data?.activeCount ?? 0} active subscriber(s). Continue?`
        }
        itemName={subject.trim() || undefined}
        loading={sending}
        confirmText={
          (data?.activeCount ?? 0) === 0 ? 'Save message' : 'Save & send'
        }
        onConfirm={() => void onSend()}
        onCancel={() => {
          if (!sending) setShowSaveConfirmation(false);
        }}
      />
      <Card className={cn(adminCardClass, 'min-w-0 max-w-full')}>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {loading ? (
              <Loader2 className="mx-auto animate-spin text-center text-primary" />
            ) : error ? (
              <p className="px-4 text-sm text-destructive">{error}</p>
            ) : activeSubscribers.length === 0 ? (
              <AdminTableEmpty>
                No active subscribers yet. They will appear when people sign up
                from the site footer.
              </AdminTableEmpty>
            ) : (
              <AdminTable minWidth={720}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Subscriber</AdminTableHead>
                    <AdminTableHead>Source</AdminTableHead>
                    <AdminTableHead>Joined</AdminTableHead>
                    <AdminTableHead className="text-right">Actions</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {activeSubscribers.map((s) => (
                    <AdminTableRow key={s.id}>
                      <AdminTableCell>
                        <AdminTableLead
                          title={s.name?.trim() || s.email}
                          subtitle={s.name ? s.email : undefined}
                          accent="#f97316"
                        />
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>{s.source ?? '—'}</AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>
                          {format(new Date(s.createdAt), 'MMM d, yyyy · h:mm a')}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="rounded-lg text-destructive hover:bg-destructive/10"
                          title="Unsubscribe"
                          disabled={removingId === s.id}
                          onClick={() => void onUnsubscribe(s.id)}
                        >
                          {removingId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Unsubscribe</span>
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
          <CardTitle>Saved &amp; sent messages</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {loading ? (
              <Loader2 className="mx-auto animate-spin text-center text-primary" />
            ) : !data?.campaigns.length ? (
              <AdminTableEmpty>No messages saved yet.</AdminTableEmpty>
            ) : (
              <AdminTable minWidth={720}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Subject</AdminTableHead>
                    <AdminTableHead>Delivered</AdminTableHead>
                    <AdminTableHead>Sent</AdminTableHead>
                    <AdminTableHead>By</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {data.campaigns.map((c) => (
                    <AdminTableRow key={c.id}>
                      <AdminTableCell>
                        <span className="font-medium">{c.subject}</span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>
                          {c.successCount}/{c.recipientCount}
                          {c.failureCount > 0
                            ? ` (${c.failureCount} failed)`
                            : ''}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>
                          {format(new Date(c.sentAt), 'MMM d, yyyy · h:mm a')}
                        </AdminTableMuted>
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminTableMuted>{c.sentByEmail ?? '—'}</AdminTableMuted>
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
