'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  BookOpen,
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

export default function AdminDocumentationPage() {
  const [items, setItems] = useState<DocModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<{ data: DocModule[] }>(
        '/api/admin/documentation'
      );
      const rows = [...(res.data.data ?? [])].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)
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
        description="Pages for the public documentation site. Order of headings and sub headings is managed under Headings."
        actions={
          <div className="flex flex-wrap gap-2">
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
            <Button type="button" variant="secondary" asChild>
              <Link href="/admin/documentation/headings">
                <BookOpen className="mr-2 h-4 w-4" />
                Headings
              </Link>
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
              Create documentation pages with a heading and optional sub heading
              for the public sidebar.
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
          {items.map((item) => (
            <Card key={item.id} className={cn(adminCardClass, 'overflow-hidden')}>
              <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
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
                      disabled={busyId === item.id}
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
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
