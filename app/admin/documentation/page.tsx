'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
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
import { cn } from '@/lib/utils';

type DocModule = {
  id: string;
  name: string;
  shortDescription: string;
  contentHtml: string;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  heading?: { id: string; name: string; slug: string } | null;
  subHeading?: {
    id: string;
    name: string;
    slug: string;
    headingId: string;
  } | null;
};

function reorderList(
  list: DocModule[],
  fromId: string,
  toId: string
): DocModule[] {
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item, index) => ({ ...item, sortOrder: index }));
}

export default function AdminDocumentationPage() {
  const [items, setItems] = useState<DocModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<{ data: DocModule[] }>(
        '/api/admin/documentation'
      );
      const rows = [...(res.data.data ?? [])].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
      );
      setItems(rows);
    } catch {
      toast.error('Could not load documentation modules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistOrder(next: DocModule[]) {
    setReordering(true);
    const prev = items;
    setItems(next);
    try {
      const res = await axios.post<{ data: DocModule[] }>(
        '/api/admin/documentation/reorder',
        { orderedIds: next.map((i) => i.id) }
      );
      setItems(
        [...(res.data.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
      );
    } catch {
      setItems(prev);
      toast.error('Could not reorder modules.');
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
    void persistOrder(reorderList(items, draggingId, targetId));
  }

  function moveBy(id: string, delta: -1 | 1) {
    if (reordering) return;
    const index = items.findIndex((i) => i.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= items.length) return;
    void persistOrder(reorderList(items, id, items[target].id));
  }

  async function toggleStatus(item: DocModule) {
    const next = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(item.id);
    try {
      await axios.patch(`/api/admin/documentation/${item.id}`, {
        status: next,
      });
      toast.success(
        next === 'PUBLISHED' ? 'Module published.' : 'Module set to draft.'
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
      await axios.delete(`/api/admin/documentation/${deleteId}`);
      toast.success('Module deleted.');
      setDeleteId(null);
      await load();
    } catch {
      toast.error('Could not delete module.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Content"
        title="Documentation"
        description="Pages for the public /documentation site. Group them under headings and sub headings (sidebar navigation)."
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
            <Button type="button" asChild>
              <Link href="/admin/documentation/new">
                <Plus className="mr-2 h-4 w-4" />
                Add page
              </Link>
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
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              No modules yet
            </CardTitle>
            <CardDescription>
              Create documentation pages with a heading and sub heading for the
              public sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" asChild>
              <Link href="/admin/documentation/new">
                <Plus className="mr-2 h-4 w-4" />
                Add page
              </Link>
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
                      <div className="flex flex-col items-start justify-start gap-1">
                        <div className="flex items-start justify-start gap-1">
                          <GripVertical className="h-5 w-5" />
                          <span className="w-5 text-center text-xs font-semibold tabular-nums">
                            {index + 1}
                          </span>
                        </div>

                        <div className="flex flex-col items-start justify-start gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={reordering || index === 0}
                            title="Move up"
                            onClick={() => moveBy(item.id, -1)}
                            className="mt-2 p-0"
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
                            className="mb-2 p-0"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Badge
                        variant={
                          item.status === 'PUBLISHED' ? 'default' : 'secondary'
                        }
                      >
                        {item.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </Badge>
                      <CardTitle className="text-base leading-snug">
                        {item.name}
                      </CardTitle>
                      {(item.heading || item.subHeading) && (
                        <p className="text-xs text-muted-foreground">
                          {[item.heading?.name, item.subHeading?.name]
                            .filter(Boolean)
                            .join(' → ')}
                        </p>
                      )}
                      <CardDescription className="line-clamp-2">
                        {item.shortDescription}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant={
                        item.status === 'PUBLISHED' ? 'secondary' : 'default'
                      }
                      disabled={busyId === item.id || reordering}
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
                    <Button type="button" size="icon" variant="ghost" asChild>
                      <Link href={`/admin/documentation/${item.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
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

      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the page from the public documentation site.
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
