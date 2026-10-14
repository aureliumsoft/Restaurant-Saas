'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import {
  AdminBlogPostForm,
  blogFormFromStored,
} from '@/components/admin/admin-blog-post-form';

type PostDto = {
  id: string;
  title: string;
  imageUrl: string | null;
  shortDescription: string;
  contentHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImageUrl: string | null;
  featured: boolean;
  status: string;
};

export default function AdminBlogEditPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [post, setPost] = useState<PostDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ data: PostDto }>(`/api/admin/blog/${id}`);
        if (!cancelled) setPost(res.data.data);
      } catch {
        if (!cancelled) toast.error(t('admin.blogPage.loadPostError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <p className="text-sm text-muted-foreground">{t('admin.blogPage.postNotFound')}</p>
    );
  }

  return (
    <AdminBlogPostForm
      mode="edit"
      postId={post.id}
      initial={blogFormFromStored(post)}
    />
  );
}
