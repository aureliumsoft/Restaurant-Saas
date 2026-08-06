'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';

export type DocModuleFormValues = {
  headingId: string;
  /** Optional free text; empty = page under heading only. */
  subHeadingName: string;
  name: string;
  shortDescription: string;
  contentHtml: string;
};

type HeadingOption = { id: string; name: string; slug: string };

type Props = {
  mode: 'create' | 'edit';
  moduleId?: string;
  initial?: DocModuleFormValues & { status?: string; sortOrder?: number };
};

const empty: DocModuleFormValues = {
  headingId: '',
  subHeadingName: '',
  name: '',
  shortDescription: '',
  contentHtml: '',
};

function snapshot(v: DocModuleFormValues & { status: string }) {
  return JSON.stringify({
    headingId: v.headingId,
    subHeadingName: v.subHeadingName.trim(),
    name: v.name.trim(),
    shortDescription: v.shortDescription.trim(),
    contentHtml: v.contentHtml.trim(),
    status: v.status,
  });
}

function plainFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenApiError(err: unknown): string {
  const e = err as {
    response?: { data?: { error?: unknown } };
    message?: string;
  };
  const flat = e.response?.data?.error;
  if (typeof flat === 'string') return flat;
  if (flat && typeof flat === 'object') {
    const fe = (flat as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const msg = fe ? Object.values(fe).flat().filter(Boolean).join(' ') : '';
    if (msg) return msg;
  }
  return e.message || 'Request failed';
}

export function AdminDocModuleForm({ mode, moduleId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<DocModuleFormValues>(initial ?? empty);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(
    initial?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED'
  );
  const [baseline] = useState(() =>
    snapshot({
      ...(initial ?? empty),
      status: initial?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    })
  );
  const [saving, setSaving] = useState(false);

  const [headings, setHeadings] = useState<HeadingOption[]>([]);
  const [loadingTaxonomy, setLoadingTaxonomy] = useState(true);

  const [headingDialogOpen, setHeadingDialogOpen] = useState(false);
  const [newHeadingName, setNewHeadingName] = useState('');
  const [creatingHeading, setCreatingHeading] = useState(false);

  const isDirty = useMemo(
    () => snapshot({ ...form, status }) !== baseline,
    [form, status, baseline]
  );

  const {
    leaveOpen,
    leaveMessage,
    requestLeave,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  } = useUnsavedChangesGuard(isDirty, {
    message:
      'You have unsaved documentation changes. Leave this page without saving?',
  });

  const loadHeadings = useCallback(async () => {
    const res = await axios.get<{ data: HeadingOption[] }>(
      '/api/admin/documentation-headings'
    );
    setHeadings(res.data.data ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadHeadings();
      } catch {
        if (!cancelled) toast.error('Could not load headings.');
      } finally {
        if (!cancelled) setLoadingTaxonomy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHeadings]);

  useEffect(() => {
    if (!initial) return;
    setForm({
      headingId: initial.headingId ?? '',
      subHeadingName: initial.subHeadingName ?? '',
      name: initial.name,
      shortDescription: initial.shortDescription,
      contentHtml: initial.contentHtml,
    });
    setStatus(initial.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate by field values
  }, [
    moduleId,
    initial?.headingId,
    initial?.subHeadingName,
    initial?.name,
    initial?.shortDescription,
    initial?.contentHtml,
    initial?.status,
  ]);

  function setField<K extends keyof DocModuleFormValues>(
    key: K,
    value: DocModuleFormValues[K]
  ) {
    setForm((f) => {
      if (key === 'headingId') {
        return {
          ...f,
          headingId: value as string,
          subHeadingName: '',
        };
      }
      return { ...f, [key]: value };
    });
  }

  function validate(): boolean {
    if (!form.headingId) {
      toast.error('Select a heading.');
      return false;
    }
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return false;
    }
    if (!form.shortDescription.trim()) {
      toast.error('Short description is required.');
      return false;
    }
    if (!plainFromHtml(form.contentHtml)) {
      toast.error('Detail content is required.');
      return false;
    }
    return true;
  }

  async function createHeading() {
    const name = newHeadingName.trim();
    if (!name) {
      toast.error('Heading name is required.');
      return;
    }
    setCreatingHeading(true);
    try {
      const res = await axios.post<{ data: HeadingOption }>(
        '/api/admin/documentation-headings',
        { name }
      );
      await loadHeadings();
      const created = res.data.data;
      setField('headingId', created.id);
      setNewHeadingName('');
      setHeadingDialogOpen(false);
      toast.success('Heading created.');
    } catch (e) {
      toast.error(flattenApiError(e));
    } finally {
      setCreatingHeading(false);
    }
  }

  async function save(nextStatus: 'DRAFT' | 'PUBLISHED') {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        shortDescription: form.shortDescription.trim(),
        contentHtml: form.contentHtml || '<p></p>',
        status: nextStatus,
        sortOrder: initial?.sortOrder ?? 0,
        headingId: form.headingId,
        subHeadingName: form.subHeadingName.trim(),
      };
      if (mode === 'create') {
        await axios.post('/api/admin/documentation', {
          ...body,
          sortOrder: undefined,
        });
      } else if (moduleId) {
        await axios.patch(`/api/admin/documentation/${moduleId}`, body);
      }
      toast.success(
        nextStatus === 'PUBLISHED' ? 'Page published.' : 'Draft saved.'
      );
      allowNextNavigation();
      router.push('/admin/documentation');
      router.refresh();
    } catch (e) {
      toast.error(flattenApiError(e));
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    requestLeave(() => {
      router.push('/admin/documentation');
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title={mode === 'create' ? 'Add documentation page' : 'Edit page'}
        description="Assign a heading (required) and an optional sub heading, then write the page. Leave sub heading empty to publish under /documentation/[heading] only."
        actions={
          <Button type="button" variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documentation
          </Button>
        }
      />

      <Card className={cn(adminCardClass)}>
        <CardContent className="space-y-5 pt-6">
          {loadingTaxonomy ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="doc-heading">Heading</Label>
                  <select
                    id="doc-heading"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.headingId}
                    onChange={(e) => setField('headingId', e.target.value)}
                  >
                    <option className="text-black" value="">
                      Select heading…
                    </option>
                    {headings.map((h) => (
                      <option className="text-black" key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewHeadingName('');
                    setHeadingDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New heading
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="doc-sub-heading">
                  Sub heading{' '}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="doc-sub-heading"
                  value={form.subHeadingName}
                  disabled={!form.headingId}
                  onChange={(e) => setField('subHeadingName', e.target.value)}
                  placeholder={
                    form.headingId
                      ? 'e.g. Install app — leave empty for heading-only page'
                      : 'Select a heading first'
                  }
                  maxLength={200}
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="doc-name">Title</Label>
            <Input
              id="doc-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Getting started with POS"
              maxLength={200}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-short">Short description</Label>
            <Textarea
              id="doc-short"
              value={form.shortDescription}
              onChange={(e) => setField('shortDescription', e.target.value)}
              placeholder="One or two lines under the title"
              className="min-h-[88px]"
              maxLength={1000}
            />
          </div>

          <RichTextEditor
            id="doc-detail"
            label="Detail"
            value={form.contentHtml}
            onChange={(html) => setField('contentHtml', html)}
            helperText="Full page body shown on the public documentation site."
          />

          <div className="grid gap-2">
            <Label htmlFor="doc-status">Status (for next save)</Label>
            <select
              id="doc-status"
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value === 'DRAFT' ? 'DRAFT' : 'PUBLISHED')
              }
            >
              <option className="text-black" value="PUBLISHED">
                Published
              </option>
              <option className="text-black" value="DRAFT">
                Draft
              </option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
            <div className="flex flex-wrap items-center gap-2">
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
                <Save className="mr-2 h-4 w-4" />
                Save draft
              </Button>
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={goBack}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Discard changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={headingDialogOpen} onOpenChange={setHeadingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create heading</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-heading-name">Name</Label>
            <Input
              id="new-heading-name"
              value={newHeadingName}
              onChange={(e) => setNewHeadingName(e.target.value)}
              placeholder="e.g. Getting Started"
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void createHeading();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Appears as a top-level item in the public docs sidebar.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setHeadingDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={creatingHeading}
              onClick={() => void createHeading()}
            >
              {creatingHeading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
