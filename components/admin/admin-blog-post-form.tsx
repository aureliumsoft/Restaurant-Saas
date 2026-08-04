'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Send, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { plainTextFromHtml } from '@/lib/blog/blog';
import { cn } from '@/lib/utils';

export type BlogPostFormValues = {
  title: string;
  imageUrl: string;
  shortDescription: string;
  contentHtml: string;
};

type BlogPostFormProps = {
  mode: 'create' | 'edit';
  postId?: string;
  initial?: BlogPostFormValues & { status?: string };
};

const empty: BlogPostFormValues = {
  title: '',
  imageUrl: '',
  shortDescription: '',
  contentHtml: '',
};

function snapshot(v: BlogPostFormValues) {
  return JSON.stringify({
    title: v.title.trim(),
    imageUrl: v.imageUrl.trim(),
    shortDescription: v.shortDescription.trim(),
    contentHtml: v.contentHtml.trim(),
  });
}

function flattenApiError(err: unknown): string {
  const e = err as {
    response?: { data?: { error?: unknown }; status?: number };
    message?: string;
  };
  const flat = e.response?.data?.error;
  if (typeof flat === 'string') return flat;
  if (flat && typeof flat === 'object') {
    const fe = (flat as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const formErrors = (flat as { formErrors?: string[] }).formErrors;
    const fromFields = fe
      ? Object.values(fe).flat().filter(Boolean).join(' ')
      : '';
    const fromForm = formErrors?.filter(Boolean).join(' ') ?? '';
    const msg = [fromFields, fromForm].filter(Boolean).join(' ');
    if (msg) return msg;
  }
  if (e.response?.status === 413) {
    return 'Image is too large for the server. Try a smaller photo.';
  }
  return e.message || 'Request failed';
}

export function AdminBlogPostForm({
  mode,
  postId,
  initial,
}: BlogPostFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<BlogPostFormValues>(initial ?? empty);
  const [baseline] = useState(() => snapshot(initial ?? empty));
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty = useMemo(() => snapshot(form) !== baseline, [form, baseline]);

  const {
    leaveOpen,
    leaveMessage,
    requestLeave,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  } = useUnsavedChangesGuard(isDirty, {
    message: 'You have unsaved blog changes. Leave this page without saving?',
  });

  useEffect(() => {
    if (!initial) return;
    setForm({
      title: initial.title,
      imageUrl: initial.imageUrl ?? '',
      shortDescription: initial.shortDescription,
      contentHtml: initial.contentHtml,
    });
    // Hydrate when loaded post fields change (string compare), not on new object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field deps
  }, [
    postId,
    initial?.title,
    initial?.imageUrl,
    initial?.shortDescription,
    initial?.contentHtml,
  ]);

  function setField<K extends keyof BlogPostFormValues>(
    key: K,
    value: BlogPostFormValues[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return false;
    }
    if (!form.shortDescription.trim()) {
      toast.error('Short description is required.');
      return false;
    }
    const detail = plainTextFromHtml(form.contentHtml);
    if (detail.length < 1) {
      toast.error('Blog detail is required.');
      return false;
    }
    return true;
  }

  async function save(status: 'DRAFT' | 'PUBLISHED') {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        title: form.title,
        imageUrl: form.imageUrl?.trim() ? form.imageUrl : '',
        shortDescription: form.shortDescription,
        contentHtml: form.contentHtml || '<p></p>',
        status,
      };
      const axiosOpts = {
        maxBodyLength: Infinity as number,
        maxContentLength: Infinity as number,
        timeout: 120_000,
      };
      if (mode === 'create') {
        const res = await axios.post<{ data: { id: string } }>(
          '/api/admin/blog',
          body,
          axiosOpts
        );
        toast.success(
          status === 'PUBLISHED' ? 'Blog published.' : 'Draft saved.'
        );
        allowNextNavigation();
        if (status === 'PUBLISHED') {
          router.push('/admin/blog');
        } else {
          router.replace(`/admin/blog/${res.data.data.id}`);
        }
      } else if (postId) {
        await axios.patch(`/api/admin/blog/${postId}`, body, axiosOpts);
        toast.success(
          status === 'PUBLISHED' ? 'Blog published.' : 'Draft saved.'
        );
        allowNextNavigation();
        router.push('/admin/blog');
      }
      router.refresh();
    } catch (e) {
      toast.error(flattenApiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function discardDraft() {
    setSaving(true);
    try {
      const status = initial?.status ?? 'DRAFT';
      if (mode === 'edit' && postId && status === 'DRAFT') {
        await axios.delete(`/api/admin/blog/${postId}`);
        toast.success('Draft discarded.');
      } else if (mode === 'edit' && postId && status === 'PUBLISHED') {
        toast.info('Changes discarded. Post was not deleted.');
      }
      allowNextNavigation();
      router.push('/admin/blog');
      router.refresh();
    } catch (e) {
      toast.error(flattenApiError(e));
    } finally {
      setSaving(false);
      setDiscardOpen(false);
    }
  }

  function goBack() {
    requestLeave(() => {
      router.push('/admin/blog');
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title={mode === 'create' ? 'Create blog post' : 'Edit blog post'}
        description="Write content for the public SaaS marketing blog."
        actions={
          <Button type="button" variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        }
      />

      <Card className={cn(adminCardClass)}>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="blog-title">Title</Label>
            <Input
              id="blog-title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Post title"
              maxLength={200}
            />
          </div>

          <Base64ImageUploadField
            label="Image"
            value={form.imageUrl}
            onChange={(v) => setField('imageUrl', v)}
            helperText="Cover image for cards and the public blog (upload or paste an image URL)."
            maxMb={8}
            maxEncodedMb={1.8}
          />

          <div className="grid gap-2">
            <Label htmlFor="blog-short">Short description</Label>
            <Textarea
              id="blog-short"
              value={form.shortDescription}
              onChange={(e) => setField('shortDescription', e.target.value)}
              placeholder="1–2 sentences shown on blog cards"
              maxLength={500}
              className="min-h-[88px]"
            />
          </div>

          <RichTextEditor
            id="blog-detail"
            label="Blog detail"
            value={form.contentHtml}
            onChange={(html) => setField('contentHtml', html)}
            helperText="Full article content (rich text)."
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={saving}
                onClick={() => void save('PUBLISHED')}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Publish
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void save('DRAFT')}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save draft
              </Button>
            </div>

            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => setDiscardOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Discard draft
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'edit' && initial?.status === 'DRAFT'
                ? 'This deletes the draft and cannot be undone.'
                : mode === 'edit'
                  ? 'Leave without saving. The published post will keep its last saved version.'
                  : 'Any unsaved content will be lost and you will return to the blog list.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={saving}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void discardDraft();
              }}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={leaveOpen}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>{leaveMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              <X className="mr-2 h-4 w-4" />
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeave}>
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
