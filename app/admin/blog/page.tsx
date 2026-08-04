'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format } from 'date-fns';
import {
  Eye,
  FileText,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
import { cn } from '@/lib/utils';

type BlogListItem = {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  shortDescription: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
};

type BlogDetail = BlogListItem & {
  contentHtml: string;
};

export default function AdminBlogListPage() {
  const [posts, setPosts] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BlogDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await axios.get<{ data: BlogListItem[] }>('/api/admin/blog');
      setPosts(res.data.data ?? []);
    } catch {
      setError('Could not load blog posts.');
      toast.error('Could not load blog posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPreview(id: string) {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await axios.get<{ data: BlogDetail }>(
        `/api/admin/blog/${id}`
      );
      setPreview(res.data.data);
    } catch {
      toast.error('Could not load post preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function toggleStatus(post: BlogListItem) {
    const next = post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(post.id);
    try {
      const res = await axios.get<{ data: BlogDetail }>(
        `/api/admin/blog/${post.id}`
      );
      const full = res.data.data;
      await axios.patch(`/api/admin/blog/${post.id}`, {
        title: full.title,
        imageUrl: full.imageUrl ?? '',
        shortDescription: full.shortDescription,
        contentHtml: full.contentHtml,
        status: next,
      });
      toast.success(
        next === 'PUBLISHED' ? 'Post published.' : 'Moved to draft.'
      );
      await load();
      if (preview?.id === post.id) {
        setPreview((p) =>
          p
            ? {
                ...p,
                status: next,
                publishedAt:
                  next === 'PUBLISHED'
                    ? p.publishedAt ?? new Date().toISOString()
                    : null,
              }
            : p
        );
      }
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
      await axios.delete(`/api/admin/blog/${deleteId}`);
      toast.success('Post deleted.');
      if (preview?.id === deleteId) setPreview(null);
      setDeleteId(null);
      await load();
    } catch {
      toast.error('Could not delete post.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Content"
        title="Blog posts"
        description="Create and publish articles for the public Foodluk blog."
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
            <Button type="button" asChild>
              <Link href="/admin/blog/new">
                <Plus className="mr-2 h-4 w-4" />
                Add blog
              </Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : posts.length === 0 ? (
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-muted-foreground" />
              No posts yet
            </CardTitle>
            <CardDescription>
              Create your first blog post for the SaaS marketing site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" asChild>
              <Link href="/admin/blog/new">
                <Plus className="mr-2 h-4 w-4" />
                Add blog
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <Card
              key={post.id}
              className={cn(
                adminCardClass,
                'flex h-full flex-col overflow-hidden transition-all hover:shadow-md'
              )}
            >
              <button
                type="button"
                className="group flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => void openPreview(post.id)}
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <FileText className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                </div>
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={
                        post.status === 'PUBLISHED' ? 'default' : 'secondary'
                      }
                    >
                      {post.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(post.updatedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <CardTitle className="line-clamp-2 text-lg leading-snug">
                    {post.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3">
                    {post.shortDescription.slice(0, 50)}...
                  </CardDescription>
                </CardHeader>
              </button>
              <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 pt-4 justify-between">
                <Button
                  type="button"
                  variant={
                    post.status === 'PUBLISHED' ? 'secondary' : 'default'
                  }
                  disabled={busyId === post.id}
                  onClick={() => void toggleStatus(post)}
                >
                  {busyId === post.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : post.status === 'PUBLISHED' ? (
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {post.status === 'PUBLISHED' ? 'Make Draft' : 'Publish'}
                </Button>

                <div className="flex items-center">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    asChild
                    disabled={busyId === post.id}
                  >
                    <Link href={`/admin/blog/${post.id}`}>
                      <Pencil className=" h-4 w-4" />
                    </Link>
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === post.id}
                    onClick={() => setDeleteId(post.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

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
          {previewLoading && !preview ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : preview ? (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">{preview.title}</DialogTitle>
              </DialogHeader>
              {preview.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.imageUrl}
                  alt=""
                  className="-mx-1 max-h-64 w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl bg-muted">
                  <FileText className="h-12 w-12 text-muted-foreground opacity-40" />
                </div>
              )}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      preview.status === 'PUBLISHED' ? 'default' : 'secondary'
                    }
                  >
                    {preview.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {preview.title}
                </h2>
                <p className="text-base text-muted-foreground">
                  {preview.shortDescription}
                </p>
                <div
                  className={cn(
                    'prose prose-sm max-w-none border-t border-border/60 pt-4 dark:prose-invert',
                    '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6'
                  )}
                  dangerouslySetInnerHTML={{ __html: preview.contentHtml }}
                />
                <p className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
                  Publish date:{' '}
                  {preview.publishedAt
                    ? format(
                        new Date(preview.publishedAt),
                        'MMMM d, yyyy · HH:mm'
                      )
                    : 'Not published yet'}
                </p>
              </div>
            </>
          ) : null}
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
            <AlertDialogTitle>Delete blog post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the post. This cannot be undone.
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
