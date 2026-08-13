'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  Copy,
  Eye,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  Send,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DeleteConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { plainTextFromHtml } from '@/lib/blog/blog';
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
  buttonTitle?: string | null;
  buttonLink?: string | null;
};

type CampaignDetail = CampaignRow & {
  htmlBody: string;
  textBody: string | null;
  createdAt: string;
};

type NewsletterPayload = {
  activeCount: number;
  campaignTotal: number;
  subscribers: SubscriberRow[];
  campaigns: CampaignRow[];
};

const EMPTY_EDITOR = '<p><br></p>';

function resetComposeFields() {
  return {
    subject: '',
    bodyHtml: EMPTY_EDITOR,
    buttonTitle: '',
    buttonLink: '',
  };
}

export default function AdminNewsletterPage() {
  const [data, setData] = useState<NewsletterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState(EMPTY_EDITOR);
  const [buttonTitle, setButtonTitle] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [composeFormKey, setComposeFormKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CampaignDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);
  const [campaignBusyId, setCampaignBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await axios.get<{ data: NewsletterPayload }>(
        '/api/admin/newsletter',
        { params: { _t: Date.now() } }
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

  const clearComposeForm = () => {
    const empty = resetComposeFields();
    setSubject(empty.subject);
    setBodyHtml(empty.bodyHtml);
    setButtonTitle(empty.buttonTitle);
    setButtonLink(empty.buttonLink);
    setComposeFormKey((k) => k + 1);
  };

  const prependCampaign = (row: CampaignRow) => {
    setData((prev) => {
      if (!prev) return prev;
      const campaigns = [
        row,
        ...prev.campaigns.filter((c) => c.id !== row.id),
      ].slice(0, 50);
      return { ...prev, campaigns };
    });
  };

  const requestSave = () => {
    const plain = plainTextFromHtml(bodyHtml);
    if (!subject.trim()) {
      toast.error('Enter a subject.');
      return;
    }
    if (plain.length < 10) {
      toast.error('Enter a message with at least a short paragraph.');
      return;
    }
    const titleTrim = buttonTitle.trim();
    const linkTrim = buttonLink.trim();
    if (titleTrim && !linkTrim) {
      toast.error('Enter a button link or clear the button title.');
      return;
    }
    if (linkTrim && !titleTrim) {
      toast.error('Enter a button title or clear the button link.');
      return;
    }
    if (linkTrim && !/^https?:\/\//i.test(linkTrim)) {
      toast.error('Button link must start with http:// or https://');
      return;
    }
    setShowSaveConfirmation(true);
  };

  const onSend = async () => {
    setSending(true);
    try {
      const plain = plainTextFromHtml(bodyHtml);
      const r = await axios.post<{
        data: CampaignRow & { errors?: string[] };
      }>('/api/admin/newsletter/send', {
        subject: subject.trim(),
        htmlBody: bodyHtml.trim() || '<p></p>',
        textBody: plain,
        buttonTitle: buttonTitle.trim() || '',
        buttonLink: buttonLink.trim() || '',
      });

      const created = r.data.data;

      if (created.recipientCount === 0) {
        toast.success('Message saved. New subscribers will receive it by email.');
      } else {
        toast.success(
          `Saved and sent to ${created.successCount} of ${created.recipientCount} subscribers.`
        );
      }
      if (created.errors?.length) {
        toast.warn(created.errors[0]);
      }

      setShowSaveConfirmation(false);
      clearComposeForm();
      prependCampaign({
        id: created.id,
        subject: created.subject,
        recipientCount: created.recipientCount,
        successCount: created.successCount,
        failureCount: created.failureCount,
        sentByEmail: null,
        sentAt: created.sentAt,
        status: created.status,
        buttonTitle: buttonTitle.trim() || null,
        buttonLink: buttonLink.trim() || null,
      });
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

  const openPreview = async (id: string) => {
    setPreviewLoading(true);
    setPreview(null);
    setCampaignBusyId(id);
    try {
      const res = await axios.get<{ data: CampaignDetail }>(
        `/api/admin/newsletter/campaigns/${id}`
      );
      setPreview(res.data.data);
    } catch {
      toast.error('Could not load message preview.');
    } finally {
      setPreviewLoading(false);
      setCampaignBusyId(null);
    }
  };

  const loadIntoCompose = async (id: string) => {
    setCampaignBusyId(id);
    try {
      const res = await axios.get<{ data: CampaignDetail }>(
        `/api/admin/newsletter/campaigns/${id}`
      );
      const c = res.data.data;
      setSubject(c.subject);
      setBodyHtml(c.htmlBody?.trim() || EMPTY_EDITOR);
      setButtonTitle(c.buttonTitle ?? '');
      setButtonLink(c.buttonLink ?? '');
      setComposeFormKey((k) => k + 1);
      toast.success('Message loaded into the compose form.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error('Could not load message.');
    } finally {
      setCampaignBusyId(null);
    }
  };

  const confirmDeleteCampaign = async () => {
    if (!deleteCampaignId) return;
    setDeletingCampaign(true);
    try {
      await axios.delete(
        `/api/admin/newsletter/campaigns/${deleteCampaignId}`
      );
      toast.success('Message deleted.');
      setDeleteCampaignId(null);
      await load();
    } catch {
      toast.error('Could not delete message.');
    } finally {
      setDeletingCampaign(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'SENT') {
      return <Badge variant="default">Sent</Badge>;
    }
    if (status === 'SAVED') {
      return <Badge variant="secondary">Saved</Badge>;
    }
    if (status === 'FAILED') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
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
              {loading ? '—' : (data?.campaignTotal ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className={adminCardClass} key={composeFormKey}>
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
          <RichTextEditor
            key={`newsletter-body-${composeFormKey}`}
            id="newsletter-body"
            label="Message"
            value={bodyHtml}
            onChange={setBodyHtml}
            helperText="Rich text is sent as HTML in the email. Formatting (bold, lists, links) appears as you compose it."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newsletter-button-title">Button title</Label>
              <Input
                id="newsletter-button-title"
                value={buttonTitle}
                onChange={(e) => setButtonTitle(e.target.value)}
                placeholder="Read more"
                maxLength={120}
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newsletter-button-link">Button link</Label>
              <Input
                id="newsletter-button-link"
                value={buttonLink}
                onChange={(e) => setButtonLink(e.target.value)}
                placeholder="https://foodluk.com/pricing"
                maxLength={2048}
                disabled={sending}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Optional call-to-action button shown below the message in the email.
            Saving stores this as the latest newsletter, emails every active
            subscriber, and sends this message automatically to anyone who
            subscribes later.
          </p>
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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Saved &amp; sent messages</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <AdminTableWrapper>
            {loading ? (
              <Loader2 className="mx-auto animate-spin text-center text-primary" />
            ) : !data?.campaigns.length ? (
              <AdminTableEmpty>No messages saved yet.</AdminTableEmpty>
            ) : (
              <AdminTable minWidth={860}>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Subject</AdminTableHead>
                    <AdminTableHead>Status</AdminTableHead>
                    <AdminTableHead>Delivered</AdminTableHead>
                    <AdminTableHead>Sent</AdminTableHead>
                    <AdminTableHead>By</AdminTableHead>
                    <AdminTableHead className="text-right">Actions</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {data.campaigns.map((c) => (
                    <AdminTableRow key={c.id}>
                      <AdminTableCell>
                        <span className="font-medium">{c.subject}</span>
                        {c.buttonTitle ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Button: {c.buttonTitle}
                          </p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell>{statusBadge(c.status)}</AdminTableCell>
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
                      <AdminTableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Preview"
                            disabled={campaignBusyId === c.id}
                            onClick={() => void openPreview(c.id)}
                          >
                            {campaignBusyId === c.id && previewLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Load into compose form"
                            disabled={campaignBusyId === c.id}
                            onClick={() => void loadIntoCompose(c.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            title="Delete"
                            disabled={campaignBusyId === c.id}
                            onClick={() => setDeleteCampaignId(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
          </AdminTableWrapper>
        </CardContent>
      </Card>

      <Dialog
        open={previewLoading || Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
            setPreviewLoading(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.subject ?? 'Message preview'}</DialogTitle>
          </DialogHeader>
          {previewLoading && !preview ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {statusBadge(preview.status)}
                <span>
                  {format(new Date(preview.sentAt), 'MMM d, yyyy · h:mm a')}
                </span>
                <span>
                  Delivered {preview.successCount}/{preview.recipientCount}
                </span>
              </div>
              <div
                className="prose prose-sm max-w-none dark:prose-invert [&_ol]:list-decimal [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: preview.htmlBody }}
              />
              {preview.buttonTitle && preview.buttonLink ? (
                <div className="pt-2">
                  <span className="inline-block rounded-lg bg-fire-500 px-4 py-2 text-sm font-semibold text-white">
                    {preview.buttonTitle}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {preview.buttonLink}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        open={deleteCampaignId != null}
        title="Delete saved message"
        description="This removes the message from history. It does not undo emails already sent."
        loading={deletingCampaign}
        confirmText="Delete"
        onConfirm={() => void confirmDeleteCampaign()}
        onCancel={() => {
          if (!deletingCampaign) setDeleteCampaignId(null);
        }}
      />
    </div>
  );
}
