'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

import { AdminBlogPostForm } from '@/components/admin/admin-blog-post-form';

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
        if (!cancelled) toast.error('Could not load blog post.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <p className="text-sm text-muted-foreground">Blog post not found.</p>
    );
  }

  return (
    <AdminBlogPostForm
      mode="edit"
      postId={post.id}
      initial={{
        title: post.title,
        imageUrl: post.imageUrl ?? '',
        shortDescription: post.shortDescription,
        contentHtml: post.contentHtml,
        seoTitle: post.seoTitle ?? '',
        seoDescription: post.seoDescription ?? '',
        seoImageUrl: post.seoImageUrl ?? '',
        featured: Boolean(post.featured),
        status: post.status,
      }}
    />
  );
}
