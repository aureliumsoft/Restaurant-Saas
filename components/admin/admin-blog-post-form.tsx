'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Send, Star, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { AdminCmsLocaleTabs } from '@/components/admin/admin-cms-locale-tabs';
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
import {
  bilingualInputFromStored,
  parseBilingualInput,
  parseStoredBilingualText,
} from '@/lib/menu/bilingual-text';
import { cn } from '@/lib/utils';

export type BlogPostFormValues = {
  /** Editor: `English &&&& Spanish` */
  title: string;
  imageUrl: string;
  /** Editor: `English &&&& Spanish` */
  shortDescription: string;
  contentHtml: string;
  contentHtmlEs: string;
  /** Editor: `English &&&& Spanish` */
  seoTitle: string;
  /** Editor: `English &&&& Spanish` */
  seoDescription: string;
  seoImageUrl: string;
  featured: boolean;
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
  contentHtmlEs: '',
  seoTitle: '',
  seoDescription: '',
  seoImageUrl: '',
  featured: false,
};

function snapshot(v: BlogPostFormValues) {
  return JSON.stringify({
    title: v.title.trim(),
    imageUrl: v.imageUrl.trim(),
    shortDescription: v.shortDescription.trim(),
    contentHtml: v.contentHtml.trim(),
    contentHtmlEs: v.contentHtmlEs.trim(),
    seoTitle: v.seoTitle.trim(),
    seoDescription: v.seoDescription.trim(),
    seoImageUrl: v.seoImageUrl.trim(),
    featured: Boolean(v.featured),
  });
}

function flattenApiError(
  err: unknown,
  t: (key: string) => string
): string {
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
    return t('admin.blogForm.imageTooLargeError');
  }
  return e.message || t('admin.blogForm.requestFailed');
}

/** Hydrate form from DB row (bilingual JSON / &&&& in primary columns). */
export function blogFormFromStored(post: {
  title: string;
  imageUrl?: string | null;
  shortDescription: string;
  contentHtml: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImageUrl?: string | null;
  featured?: boolean;
  status?: string;
}): BlogPostFormValues & { status?: string } {
  const html = parseStoredBilingualText(post.contentHtml);
  return {
    title: bilingualInputFromStored(post.title),
    imageUrl: post.imageUrl ?? '',
    shortDescription: bilingualInputFromStored(post.shortDescription),
    contentHtml: html.en,
    contentHtmlEs: html.es,
    seoTitle: bilingualInputFromStored(post.seoTitle),
    seoDescription: bilingualInputFromStored(post.seoDescription),
    seoImageUrl: post.seoImageUrl ?? '',
    featured: Boolean(post.featured),
    status: post.status,
  };
}

export function AdminBlogPostForm({
  mode,
  postId,
  initial,
}: BlogPostFormProps) {
  const { t } = useTranslation();
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
    message: t('admin.blogForm.unsavedGuardMessage'),
  });

  useEffect(() => {
    if (!initial) return;
    setForm({
      title: initial.title,
      imageUrl: initial.imageUrl ?? '',
      shortDescription: initial.shortDescription,
      contentHtml: initial.contentHtml,
      contentHtmlEs: initial.contentHtmlEs ?? '',
      seoTitle: initial.seoTitle ?? '',
      seoDescription: initial.seoDescription ?? '',
      seoImageUrl: initial.seoImageUrl ?? '',
      featured: Boolean(initial.featured),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field deps
  }, [
    postId,
    initial?.title,
    initial?.imageUrl,
    initial?.shortDescription,
    initial?.contentHtml,
    initial?.contentHtmlEs,
    initial?.seoTitle,
    initial?.seoDescription,
    initial?.seoImageUrl,
    initial?.featured,
  ]);

  function setField<K extends keyof BlogPostFormValues>(
    key: K,
    value: BlogPostFormValues[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const titleEn = parseBilingualInput(form.title).en;
    if (!titleEn) {
      toast.error(t('admin.blogForm.validateTitleRequired'));
      return false;
    }
    const shortEn = parseBilingualInput(form.shortDescription).en;
    if (!shortEn) {
      toast.error(t('admin.blogForm.validateShortRequired'));
      return false;
    }
    const detail = plainTextFromHtml(form.contentHtml);
    if (detail.length < 1) {
      toast.error(t('admin.blogForm.validateDetailRequired'));
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
        contentHtmlEs: form.contentHtmlEs?.trim() ? form.contentHtmlEs : '',
        seoTitle: form.seoTitle?.trim() ? form.seoTitle : '',
        seoDescription: form.seoDescription?.trim() ? form.seoDescription : '',
        seoImageUrl: form.seoImageUrl?.trim() ? form.seoImageUrl : '',
        featured: Boolean(form.featured),
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
          status === 'PUBLISHED'
            ? t('admin.blogForm.toastPublished')
            : t('admin.blogForm.toastDraftSaved')
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
          status === 'PUBLISHED'
            ? t('admin.blogForm.toastPublished')
            : t('admin.blogForm.toastDraftSaved')
        );
        allowNextNavigation();
        router.push('/admin/blog');
      }
      router.refresh();
    } catch (e) {
      toast.error(flattenApiError(e, t));
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
        toast.success(t('admin.blogForm.toastDiscarded'));
      } else if (mode === 'edit' && postId && status === 'PUBLISHED') {
        toast.info(t('admin.blogForm.toastDiscardedNoDelete'));
      }
      allowNextNavigation();
      router.push('/admin/blog');
      router.refresh();
    } catch (e) {
      toast.error(flattenApiError(e, t));
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
        eyebrow={t('admin.blogPage.eyebrow')}
        title={mode === 'create' ? t('admin.blogForm.createTitle') : t('admin.blogForm.editTitle')}
        description={t('admin.blogForm.description')}
        actions={
          <Button type="button" variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('admin.blogForm.backToBlogs')}
          </Button>
        }
      />

      <Card className={cn(adminCardClass)}>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="blog-title">{t('admin.blogForm.titleLabel')}</Label>
            <Input
              id="blog-title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder={t('admin.blogForm.titlePlaceholder')}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {t('admin.blogForm.bilingualHint')}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="blog-short">{t('admin.blogForm.shortDescLabel')}</Label>
            <Textarea
              id="blog-short"
              value={form.shortDescription}
              onChange={(e) => setField('shortDescription', e.target.value)}
              placeholder={t('admin.blogForm.shortDescPlaceholder')}
              maxLength={1200}
              className="min-h-[88px]"
            />
            <p className="text-xs text-muted-foreground">
              {t('admin.blogForm.bilingualHint')}
            </p>
          </div>

          <AdminCmsLocaleTabs
            labelsNs="admin.blog"
            english={
              <RichTextEditor
                id="blog-detail"
                label={t('admin.blogForm.detailEnglishLabel')}
                value={form.contentHtml}
                onChange={(html) => setField('contentHtml', html)}
                helperText={t('admin.blogForm.detailEnglishHelper')}
              />
            }
            spanish={
              <RichTextEditor
                id="blog-detail-es"
                label={t('admin.blogForm.detailSpanishLabel')}
                value={form.contentHtmlEs}
                onChange={(html) => setField('contentHtmlEs', html)}
                helperText={t('admin.blogForm.detailSpanishHelper')}
              />
            }
          />

          <Base64ImageUploadField
            label={t('admin.blogForm.imageLabel')}
            value={form.imageUrl}
            onChange={(v) => setField('imageUrl', v)}
            helperText={t('admin.blogForm.imageHelper')}
            maxMb={8}
            maxEncodedMb={1.8}
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={form.featured}
              onChange={(e) => setField('featured', e.target.checked)}
            />
            <span className="space-y-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Star className="h-4 w-4 text-fire-500" />
                {t('admin.blogForm.featuredLabel')}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t('admin.blogForm.featuredHelper')}
              </span>
            </span>
          </label>

          <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
            <div>
              <p className="text-sm font-semibold">{t('admin.blogForm.seoTagsTitle')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin.blogForm.seoTagsHelper')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="blog-seo-title">
                {t('admin.blogForm.seoTitleLabel')}
              </Label>
              <Input
                id="blog-seo-title"
                value={form.seoTitle}
                onChange={(e) => setField('seoTitle', e.target.value)}
                placeholder={t('admin.blogForm.seoTitlePlaceholder')}
                maxLength={500}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blog-seo-desc">
                {t('admin.blogForm.seoDescLabel')}
              </Label>
              <Textarea
                id="blog-seo-desc"
                value={form.seoDescription}
                onChange={(e) => setField('seoDescription', e.target.value)}
                placeholder={t('admin.blogForm.seoDescPlaceholder')}
                maxLength={1200}
                className="min-h-[88px]"
              />
            </div>

            <Base64ImageUploadField
              label={t('admin.blogForm.seoImageLabel')}
              value={form.seoImageUrl}
              onChange={(v) => setField('seoImageUrl', v)}
              helperText={t('admin.blogForm.seoImageHelper')}
              maxMb={8}
              maxEncodedMb={1.8}
            />
          </div>

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
                    {t('admin.blogForm.saving')}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t('admin.blogForm.publish')}
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
                {t('admin.blogForm.saveDraft')}
              </Button>
            </div>

            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => setDiscardOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('admin.blogForm.discardDraft')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.blogForm.discardDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'edit' && initial?.status === 'DRAFT'
                ? t('admin.blogForm.discardDialogDescDraft')
                : mode === 'edit'
                  ? t('admin.blogForm.discardDialogDescEditPublished')
                  : t('admin.blogForm.discardDialogDescCreate')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={saving}>
              {t('admin.blogForm.keepEditing')}
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
              {t('admin.blogForm.discardDraft')}
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
            <AlertDialogTitle>{t('admin.blogForm.unsavedChangesTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{leaveMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              <X className="mr-2 h-4 w-4" />
              {t('admin.blogForm.keepEditing')}
            </AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeave}>
              {t('admin.blogForm.leaveWithoutSaving')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
