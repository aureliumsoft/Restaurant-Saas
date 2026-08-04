import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';

import { db } from '@/lib/db';

type Props = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.blogPost.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { title: true, shortDescription: true },
  });
  if (!post) return { title: 'Blog | Foodluk' };
  return {
    title: `${post.title} | Foodluk Blog`,
    description: post.shortDescription,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await db.blogPost.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      title: true,
      imageUrl: true,
      shortDescription: true,
      contentHtml: true,
      publishedAt: true,
    },
  });

  if (!post) notFound();

  return (
    <div className="flex min-h-[100vh] flex-col bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      <article className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-28 sm:px-6">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center text-sm font-medium text-zinc-600 transition-colors hover:text-fire-500 dark:text-zinc-400 dark:hover:text-fire-400"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          All posts
        </Link>

        {post.publishedAt ? (
          <p className="text-sm font-medium uppercase tracking-wide text-fire-500">
            {format(new Date(post.publishedAt), 'MMMM d, yyyy')}
          </p>
        ) : null}

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          {post.shortDescription}
        </p>

        {post.imageUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="max-h-[420px] w-full object-cover"
            />
          </div>
        ) : null}

        <div
          className="prose prose-zinc mt-10 max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-a:text-fire-600 dark:prose-a:text-fire-400 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
    </div>
  );
}
