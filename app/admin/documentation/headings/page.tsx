'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FolderTree,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { adminCardClass } from '@/components/admin/admin-surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  formatDocAdminName,
  splitStoredDocName,
} from '@/lib/documentation/labels';

type SubHeadingRow = {
  id: string;
  headingId: string;
  name: string;
  slug: string;
  sortOrder: number;
  status: string;
  _count?: { pages: number };
};

type HeadingRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  status: string;
  subHeadings: SubHeadingRow[];
  _count?: { subHeadings: number; pages: number };
};

type EditTarget =
  | { kind: 'heading'; item: HeadingRow }
  | { kind: 'sub'; item: SubHeadingRow; headingName: string }
  | null;

type DeleteTarget =
  | { kind: 'heading'; id: string; name: string }
  | { kind: 'sub'; id: string; name: string }
  | null;

function flattenApiError(err: unknown, t: (key: string) => string): string {
  const e = err as {
    response?: { data?: { error?: unknown } };
    message?: string;
  };
  const flat = e.response?.data?.error;
  if (typeof flat === 'string') return flat;
  return e.message || t('admin.docsForm.requestFailed');
}

function DocNameFields({
  idPrefix,
  name,
  nameEs,
  onName,
  onNameEs,
  onSubmit,
}: {
  idPrefix: string;
  name: string;
  nameEs: string;
  onName: (value: string) => void;
  onNameEs: (value: string) => void;
  onSubmit?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>{t('admin.docsForm.nameEnLabel')}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={t('admin.docsForm.newHeadingPlaceholder')}
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name-es`}>
          {t('admin.docsForm.nameEsLabel')}
        </Label>
        <Input
          id={`${idPrefix}-name-es`}
          value={nameEs}
          onChange={(e) => onNameEs(e.target.value)}
          placeholder={t('admin.docsForm.nameEsPlaceholder')}
          maxLength={200}
        />
      </div>
    </>
  );
}

function reorderByIds<T extends { id: string; sortOrder: number }>(
  list: T[],
  fromId: string,
  toId: string
): T[] {
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item, index) => ({ ...item, sortOrder: index }));
}

export default function AdminDocumentationHeadingsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<HeadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingHeadingId, setDraggingHeadingId] = useState<string | null>(
    null
  );
  const [draggingSub, setDraggingSub] = useState<{
    headingId: string;
    id: string;
  } | null>(null);

  const [createHeadingOpen, setCreateHeadingOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [createSubHeadingId, setCreateSubHeadingId] = useState('');
  const [newName, setNewName] = useState('');
  const [newNameEs, setNewNameEs] = useState('');
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editName, setEditName] = useState('');
  const [editNameEs, setEditNameEs] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<{ data: HeadingRow[] }>(
        '/api/admin/documentation-headings'
      );
      setItems(res.data.data ?? []);
    } catch {
      toast.error(t('admin.docsForm.loadHeadingsError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistHeadingOrder(next: HeadingRow[]) {
    setReordering(true);
    const prev = items;
    setItems(next);
    try {
      const res = await axios.post<{ data: HeadingRow[] }>(
        '/api/admin/documentation-headings/reorder',
        { orderedIds: next.map((i) => i.id) }
      );
      setItems(res.data.data ?? next);
    } catch {
      setItems(prev);
      toast.error(t('admin.docsHeadings.reorderHeadingsError'));
    } finally {
      setReordering(false);
      setDraggingHeadingId(null);
    }
  }

  async function persistSubOrder(
    headingId: string,
    nextSubs: SubHeadingRow[]
  ) {
    setReordering(true);
    const prev = items;
    setItems((rows) =>
      rows.map((h) =>
        h.id === headingId ? { ...h, subHeadings: nextSubs } : h
      )
    );
    try {
      const res = await axios.post<{ data: SubHeadingRow[] }>(
        '/api/admin/documentation-sub-headings/reorder',
        {
          headingId,
          orderedIds: nextSubs.map((s) => s.id),
        }
      );
      setItems((rows) =>
        rows.map((h) =>
          h.id === headingId
            ? { ...h, subHeadings: res.data.data ?? nextSubs }
            : h
        )
      );
    } catch {
      setItems(prev);
      toast.error(t('admin.docsHeadings.reorderSubHeadingsError'));
    } finally {
      setReordering(false);
      setDraggingSub(null);
    }
  }

  function moveHeadingBy(id: string, delta: -1 | 1) {
    if (reordering) return;
    const index = items.findIndex((i) => i.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= items.length) return;
    void persistHeadingOrder(
      reorderByIds(items, id, items[target].id)
    );
  }

  function moveSubBy(headingId: string, id: string, delta: -1 | 1) {
    if (reordering) return;
    const heading = items.find((h) => h.id === headingId);
    if (!heading) return;
    const index = heading.subHeadings.findIndex((s) => s.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= heading.subHeadings.length)
      return;
    void persistSubOrder(
      headingId,
      reorderByIds(
        heading.subHeadings,
        id,
        heading.subHeadings[target].id
      )
    );
  }

  function onDropHeading(targetId: string) {
    if (!draggingHeadingId || draggingHeadingId === targetId || reordering) {
      setDraggingHeadingId(null);
      return;
    }
    void persistHeadingOrder(
      reorderByIds(items, draggingHeadingId, targetId)
    );
  }

  function onDropSub(headingId: string, targetId: string) {
    if (
      !draggingSub ||
      draggingSub.headingId !== headingId ||
      draggingSub.id === targetId ||
      reordering
    ) {
      setDraggingSub(null);
      return;
    }
    const heading = items.find((h) => h.id === headingId);
    if (!heading) {
      setDraggingSub(null);
      return;
    }
    void persistSubOrder(
      headingId,
      reorderByIds(heading.subHeadings, draggingSub.id, targetId)
    );
  }

  function resetNewNames() {
    setNewName('');
    setNewNameEs('');
  }

  async function createHeading() {
    const name = newName.trim();
    if (!name) {
      toast.error(t('admin.docsHeadings.englishNameRequired'));
      return;
    }
    setCreating(true);
    try {
      await axios.post('/api/admin/documentation-headings', {
        name,
        nameEs: newNameEs.trim(),
      });
      toast.success(t('admin.docsHeadings.headingCreatedToast'));
      setCreateHeadingOpen(false);
      resetNewNames();
      await load();
    } catch (e) {
      toast.error(flattenApiError(e, t));
    } finally {
      setCreating(false);
    }
  }

  async function createSubHeading() {
    const name = newName.trim();
    if (!createSubHeadingId) {
      toast.error(t('admin.docsForm.validateHeadingRequired'));
      return;
    }
    if (!name) {
      toast.error(t('admin.docsHeadings.englishNameRequired'));
      return;
    }
    setCreating(true);
    try {
      await axios.post('/api/admin/documentation-sub-headings', {
        headingId: createSubHeadingId,
        name,
        nameEs: newNameEs.trim(),
      });
      toast.success(t('admin.docsHeadings.subHeadingCreatedToast'));
      setCreateSubOpen(false);
      resetNewNames();
      setCreateSubHeadingId('');
      await load();
    } catch (e) {
      toast.error(flattenApiError(e, t));
    } finally {
      setCreating(false);
    }
  }

  function openEditHeading(item: HeadingRow) {
    const parts = splitStoredDocName(item.name);
    setEditTarget({ kind: 'heading', item });
    setEditName(parts.en);
    setEditNameEs(parts.es);
    setEditSlug(item.slug);
  }

  function openEditSub(item: SubHeadingRow, headingName: string) {
    const parts = splitStoredDocName(item.name);
    setEditTarget({
      kind: 'sub',
      item,
      headingName: formatDocAdminName(headingName),
    });
    setEditName(parts.en);
    setEditNameEs(parts.es);
    setEditSlug(item.slug);
  }

  async function saveEdit() {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) {
      toast.error(t('admin.docsHeadings.englishNameRequired'));
      return;
    }
    setSavingEdit(true);
    try {
      const body: { name: string; nameEs: string; slug?: string } = {
        name,
        nameEs: editNameEs.trim(),
      };
      const slug = editSlug.trim();
      if (slug) body.slug = slug;
      if (editTarget.kind === 'heading') {
        await axios.patch(
          `/api/admin/documentation-headings/${editTarget.item.id}`,
          body
        );
        toast.success(t('admin.docsHeadings.headingUpdatedToast'));
      } else {
        await axios.patch(
          `/api/admin/documentation-sub-headings/${editTarget.item.id}`,
          body
        );
        toast.success(t('admin.docsHeadings.subHeadingUpdatedToast'));
      }
      setEditTarget(null);
      await load();
    } catch (e) {
      toast.error(flattenApiError(e, t));
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleHeadingStatus(item: HeadingRow) {
    const next = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(item.id);
    try {
      await axios.patch(`/api/admin/documentation-headings/${item.id}`, {
        status: next,
      });
      toast.success(
        next === 'PUBLISHED'
          ? t('admin.docsHeadings.headingPublishedToast')
          : t('admin.docsHeadings.headingDraftedToast')
      );
      await load();
    } catch {
      toast.error(t('admin.docsPage.statusUpdateError'));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSubStatus(item: SubHeadingRow) {
    const next = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(item.id);
    try {
      await axios.patch(`/api/admin/documentation-sub-headings/${item.id}`, {
        status: next,
      });
      toast.success(
        next === 'PUBLISHED'
          ? t('admin.docsHeadings.subHeadingPublishedToast')
          : t('admin.docsHeadings.subHeadingDraftedToast')
      );
      await load();
    } catch {
      toast.error(t('admin.docsPage.statusUpdateError'));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      if (deleteTarget.kind === 'heading') {
        await axios.delete(
          `/api/admin/documentation-headings/${deleteTarget.id}`
        );
        toast.success(t('admin.docsHeadings.headingDeletedToast'));
      } else {
        await axios.delete(
          `/api/admin/documentation-sub-headings/${deleteTarget.id}`
        );
        toast.success(t('admin.docsHeadings.subHeadingDeletedToast'));
      }
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error(t('admin.docsHeadings.deleteError'));
    } finally {
      setBusyId(null);
    }
  }

  if (createHeadingOpen) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 text-muted-foreground"
            disabled={creating}
            onClick={() => setCreateHeadingOpen(false)}
          >
            {t('cancel')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('admin.docsHeadings.addHeading')}
          </h1>
        </div>
        <DocNameFields
          idPrefix="new-heading"
          name={newName}
          nameEs={newNameEs}
          onName={setNewName}
          onNameEs={setNewNameEs}
          onSubmit={() => void createHeading()}
        />
        <Button
          type="button"
          className="w-full"
          disabled={creating}
          onClick={() => void createHeading()}
        >
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('admin.docsForm.create')}
        </Button>
      </div>
    );
  }

  if (createSubOpen) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 text-muted-foreground"
            disabled={creating}
            onClick={() => setCreateSubOpen(false)}
          >
            {t('cancel')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('admin.docsHeadings.addSubheadingDialogTitle')}
          </h1>
        </div>
        <div className="grid gap-2">
          <Label>{t('admin.docsHeadings.underHeading')}</Label>
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {formatDocAdminName(
              items.find((h) => h.id === createSubHeadingId)?.name ?? ''
            ) || '—'}
          </p>
        </div>
        <DocNameFields
          idPrefix="new-sub"
          name={newName}
          nameEs={newNameEs}
          onName={setNewName}
          onNameEs={setNewNameEs}
          onSubmit={() => void createSubHeading()}
        />
        <Button
          type="button"
          className="w-full"
          disabled={creating}
          onClick={() => void createSubHeading()}
        >
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('admin.docsForm.create')}
        </Button>
      </div>
    );
  }

  if (editTarget) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 text-muted-foreground"
            disabled={savingEdit}
            onClick={() => setEditTarget(null)}
          >
            {t('cancel')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {editTarget.kind === 'sub'
              ? t('admin.docsHeadings.editSubHeading')
              : t('admin.docsHeadings.editHeading')}
          </h1>
          {editTarget.kind === 'sub' ? (
            <p className="text-sm text-muted-foreground">
              {t('admin.docsHeadings.underHeadingName', { name: editTarget.headingName })}
            </p>
          ) : null}
        </div>
        <DocNameFields
          idPrefix="edit"
          name={editName}
          nameEs={editNameEs}
          onName={setEditName}
          onNameEs={setEditNameEs}
        />
        <div className="grid gap-2">
          <Label htmlFor="edit-slug">{t('admin.docsHeadings.slugLabel')}</Label>
          <Input
            id="edit-slug"
            value={editSlug}
            onChange={(e) => setEditSlug(e.target.value)}
            maxLength={100}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {t('admin.docsHeadings.slugHelper')}
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={savingEdit}
          onClick={() => void saveEdit()}
        >
          {savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('admin.docsHeadings.save')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={t('admin.docsPage.eyebrow')}
        title={t('admin.docsHeadings.title')}
        description={t('admin.docsHeadings.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link href="/admin/documentation">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('admin.docsHeadings.backToPages')}
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={loading || reordering}
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                resetNewNames();
                setCreateHeadingOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.docsHeadings.addHeading')}
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="h-5 w-5 text-muted-foreground" />
              {t('admin.docsHeadings.emptyTitle')}
            </CardTitle>
            <CardDescription>
              {t('admin.docsHeadings.emptyDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={() => {
                resetNewNames();
                setCreateHeadingOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.docsHeadings.addHeading')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((heading, headingIndex) => (
            <Card
              key={heading.id}
              draggable={!reordering}
              onDragStart={() => setDraggingHeadingId(heading.id)}
              onDragEnd={() => {
                if (!reordering) setDraggingHeadingId(null);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onDropHeading(heading.id);
              }}
              className={cn(
                adminCardClass,
                draggingHeadingId === heading.id &&
                  'border-primary bg-muted/40 opacity-90',
                draggingHeadingId &&
                  draggingHeadingId !== heading.id &&
                  'border-dashed'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <div
                      className="mt-0.5 flex shrink-0 cursor-grab flex-col items-center gap-1 text-muted-foreground active:cursor-grabbing"
                      title={t('admin.docsHeadings.dragReorderHeading')}
                    >
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-5 w-5" />
                        <span className="w-5 text-center text-xs font-semibold tabular-nums">
                          {headingIndex + 1}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={reordering || headingIndex === 0}
                        title={t('admin.docsHeadings.moveUp')}
                        onClick={() => moveHeadingBy(heading.id, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={
                          reordering || headingIndex === items.length - 1
                        }
                        title={t('admin.docsHeadings.moveDown')}
                        onClick={() => moveHeadingBy(heading.id, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {formatDocAdminName(heading.name)}
                        </CardTitle>
                        <Badge
                          variant={
                            heading.status === 'PUBLISHED'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {heading.status === 'PUBLISHED'
                            ? t('admin.docsPage.statusPublished')
                            : t('admin.docsPage.statusDraft')}
                        </Badge>
                      </div>
                      <CardDescription className="font-mono text-xs">
                        {heading._count ? (
                          <>
                            {' '}
                            · {t('admin.docsHeadings.subCount', { count: heading._count.subHeadings })} ·{' '}
                            {t('admin.docsHeadings.pageCount', { count: heading._count.pages })}
                          </>
                        ) : null}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="default"
                      disabled={busyId === heading.id || reordering}
                      onClick={() => {
                        setCreateSubHeadingId(heading.id);
                        resetNewNames();
                        setCreateSubOpen(true);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {t('admin.docsHeadings.addSubheading')}
                    </Button>

                    <Button
                      type="button"
                      variant={
                        heading.status === 'PUBLISHED' ? 'secondary' : 'default'
                      }
                      disabled={busyId === heading.id || reordering}
                      onClick={() => void toggleHeadingStatus(heading)}
                    >
                      {heading.status === 'PUBLISHED' ? (
                        <>
                          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                          {t('admin.docsPage.statusDraft')}
                        </>
                      ) : (
                        <>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          {t('admin.docsPage.publish')}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={busyId === heading.id || reordering}
                      onClick={() => openEditHeading(heading)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={busyId === heading.id || reordering}
                      className="text-destructive"
                      onClick={() =>
                        setDeleteTarget({
                          kind: 'heading',
                          id: heading.id,
                          name: formatDocAdminName(heading.name),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {heading.subHeadings.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    {t('admin.docsHeadings.noSubHeadings')}
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-md border border-border/70">
                    {heading.subHeadings.map((sub, subIndex) => (
                      <li
                        key={sub.id}
                        draggable={!reordering}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggingSub({
                            headingId: heading.id,
                            id: sub.id,
                          });
                        }}
                        onDragEnd={() => {
                          if (!reordering) setDraggingSub(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDropSub(heading.id, sub.id);
                        }}
                        className={cn(
                          'flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
                          draggingSub?.id === sub.id &&
                            'bg-muted/40 opacity-90',
                          draggingSub &&
                            draggingSub.headingId === heading.id &&
                            draggingSub.id !== sub.id &&
                            'border-dashed'
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <div
                            className="flex shrink-0 cursor-grab flex-col items-center gap-0.5 text-muted-foreground active:cursor-grabbing"
                            title={t('admin.docsHeadings.dragReorderSubHeading')}
                          >
                            <div className="flex items-center gap-1">
                              <GripVertical className="h-4 w-4" />
                              <span className="w-4 text-center text-[10px] font-semibold tabular-nums">
                                {subIndex + 1}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              disabled={reordering || subIndex === 0}
                              title={t('admin.docsHeadings.moveUp')}
                              onClick={() =>
                                moveSubBy(heading.id, sub.id, -1)
                              }
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              disabled={
                                reordering ||
                                subIndex === heading.subHeadings.length - 1
                              }
                              title={t('admin.docsHeadings.moveDown')}
                              onClick={() =>
                                moveSubBy(heading.id, sub.id, 1)
                              }
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">
                                {formatDocAdminName(sub.name)}
                              </p>
                              <Badge
                                variant={
                                  sub.status === 'PUBLISHED'
                                    ? 'default'
                                    : 'secondary'
                                }
                                className="text-[10px]"
                              >
                                {sub.status === 'PUBLISHED'
                                  ? t('admin.docsPage.statusPublished')
                                  : t('admin.docsPage.statusDraft')}
                              </Badge>
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              {typeof sub._count?.pages === 'number'
                                ? ` · ${t('admin.docsHeadings.pageCount', { count: sub._count.pages })}`
                                : null}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            type="button"
                            variant={
                              sub.status === 'PUBLISHED'
                                ? 'secondary'
                                : 'default'
                            }
                            disabled={busyId === sub.id || reordering}
                            onClick={() => void toggleSubStatus(sub)}
                          >
                            {sub.status === 'PUBLISHED' ? (
                              <>
                                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                                {t('admin.docsPage.statusDraft')}
                              </>
                            ) : (
                              <>
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                                {t('admin.docsPage.publish')}
                              </>
                            )}
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={busyId === sub.id || reordering}
                            onClick={() => openEditSub(sub, heading.name)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={busyId === sub.id || reordering}
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'sub',
                                id: sub.id,
                                name: formatDocAdminName(sub.name),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
          {reordering ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('admin.docsHeadings.savingOrder')}
            </p>
          ) : null}
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === 'sub'
                ? t('admin.docsHeadings.deleteSubHeadingTitle')
                : t('admin.docsHeadings.deleteHeadingTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'heading'
                ? t('admin.docsHeadings.deleteHeadingDescription', { name: deleteTarget.name })
                : t('admin.docsHeadings.deleteSubHeadingDescription', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              {t('admin.docsPage.deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
