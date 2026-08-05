'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  question: '',
  answer: '',
  status: 'PUBLISHED' as 'DRAFT' | 'PUBLISHED',
};

function reorderList(list: FaqItem[], fromId: string, toId: string): FaqItem[] {
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item, index) => ({ ...item, sortOrder: index }));
}

export default function AdminFaqsPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<{ data: FaqItem[] }>('/api/admin/faqs');
      const rows = [...(res.data.data ?? [])].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
      );
      setItems(rows);
    } catch {
      toast.error('Could not load FAQs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistOrder(next: FaqItem[]) {
    setReordering(true);
    const prev = items;
    setItems(next);
    try {
      const res = await axios.post<{ data: FaqItem[] }>(
        '/api/admin/faqs/reorder',
        { orderedIds: next.map((i) => i.id) }
      );
      const rows = [...(res.data.data ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      setItems(rows);
    } catch {
      setItems(prev);
      toast.error('Could not reorder FAQs.');
    } finally {
      setReordering(false);
      setDraggingId(null);
    }
  }

  function onDropReorder(targetId: string) {
    if (!draggingId || draggingId === targetId || reordering) {
      setDraggingId(null);
      return;
    }
    const next = reorderList(items, draggingId, targetId);
    void persistOrder(next);
  }

  function moveBy(id: string, delta: -1 | 1) {
    if (reordering) return;
    const index = items.findIndex((i) => i.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = reorderList(items, id, items[target].id);
    void persistOrder(next);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: FaqItem) {
    setEditingId(item.id);
    setForm({
      question: item.question,
      answer: item.answer,
      status: item.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Question and answer are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const existing = items.find((i) => i.id === editingId);
        await axios.patch(`/api/admin/faqs/${editingId}`, {
          question: form.question.trim(),
          answer: form.answer.trim(),
          sortOrder: existing?.sortOrder ?? 0,
          status: form.status,
        });
        toast.success('FAQ updated.');
      } else {
        await axios.post('/api/admin/faqs', {
          question: form.question.trim(),
          answer: form.answer.trim(),
          sortOrder: items.length,
          status: form.status,
        });
        toast.success('FAQ created.');
      }
      setDialogOpen(false);
      setLoading(true);
      await load();
    } catch {
      toast.error('Could not save FAQ.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: FaqItem) {
    const next = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(item.id);
    try {
      await axios.patch(`/api/admin/faqs/${item.id}`, { status: next });
      toast.success(
        next === 'PUBLISHED' ? 'FAQ published.' : 'FAQ set to draft.'
      );
      await load();
    } catch {
      toast.error('Could not update status.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setBusyId(deleteId);
    try {
      await axios.delete(`/api/admin/faqs/${deleteId}`);
      toast.success('FAQ deleted.');
      setDeleteId(null);
      await load();
    } catch {
      toast.error('Could not delete FAQ.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Content"
        title="FAQs"
        description="Drag items up or down to set the order on the landing page."
        actions={
          <div className="flex flex-wrap gap-2">
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
            <Button type="button" variant="default" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add FAQ
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
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              No FAQs yet
            </CardTitle>
            <CardDescription>
              Add FAQs here to replace the default marketing copy on the landing
              page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add FAQ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item, index) => (
            <Card
              key={item.id}
              draggable={!reordering}
              onDragStart={() => setDraggingId(item.id)}
              onDragEnd={() => {
                if (!reordering) setDraggingId(null);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onDropReorder(item.id);
              }}
              className={cn(
                adminCardClass,
                'overflow-hidden transition-colors',
                draggingId === item.id &&
                  'border-primary bg-muted/40 opacity-90',
                draggingId && draggingId !== item.id && 'border-dashed'
              )}
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <div
                      className="mt-0.5 flex shrink-0 cursor-grab items-center gap-1 text-muted-foreground active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      <div className="flex flex-col items-start">
                        <div className="flex flex-wrap items-center">
                        <GripVertical className="h-5 w-5" />
                          <span className="w-5 text-center text-xs font-semibold tabular-nums">
                            {index + 1}
                          </span>
                        </div>

                        <div className="flex flex-col items-start">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={reordering || index === 0}
                            title="Move up"
                            onClick={() => moveBy(item.id, -1)}
                            className="mt-2 px-0"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={reordering || index === items.length - 1}
                            title="Move down"
                            onClick={() => moveBy(item.id, 1)}
                            className="mb-2 px-0"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            item.status === 'PUBLISHED'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {item.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <CardTitle className="text-base leading-snug">
                        {item.question}
                      </CardTitle>
                      <CardDescription className="line-clamp-3 whitespace-pre-wrap">
                        {item.answer}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant={
                        item.status === 'PUBLISHED' ? 'secondary' : 'default'
                      }
                      disabled={busyId === item.id}
                      onClick={() => void toggleStatus(item)}
                    >
                      {busyId === item.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : item.status === 'PUBLISHED' ? (
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {item.status === 'PUBLISHED' ? 'Make draft' : 'Publish'}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={reordering}
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === item.id || reordering}
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
          {reordering ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving order…
            </p>
          ) : null}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="faq-question">Question</Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(e) =>
                  setForm((f) => ({ ...f, question: e.target.value }))
                }
                placeholder="How long does it take to go live?"
                maxLength={500}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="faq-answer">Answer</Label>
              <Textarea
                id="faq-answer"
                value={form.answer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, answer: e.target.value }))
                }
                placeholder="Most restaurants launch in under 15 minutes…"
                className="min-h-[140px]"
                maxLength={10_000}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="faq-status">Status</Label>
              <select
                id="faq-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
                  }))
                }
              >
                <option className="text-black" value="PUBLISHED">
                  Published
                </option>
                <option className="text-black" value="DRAFT">
                  Draft
                </option>
              </select>
              <p className="text-xs text-muted-foreground">
                Order is set by dragging cards on the list (up / down).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save FAQ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the FAQ from the landing page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
