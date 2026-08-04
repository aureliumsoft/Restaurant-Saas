import type { Metadata } from 'next';

import {
  PublicBlogList,
  type PublicBlogCard,
} from '@/components/marketing/public-blog-list';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Blog | Foodluk',
  description: 'News, product updates, and restaurant industry tips from Foodluk.',
};

export const dynamic = 'force-dynamic';

async function loadFirstPage() {
  const limit = 9;
  const rows = await db.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      title: true,
      slug: true,
      imageUrl: true,
      shortDescription: true,
      publishedAt: true,
    },
  });
  const hasMore = rows.length > limit;
  const posts = (hasMore ? rows.slice(0, limit) : rows).map((p) => ({
    ...p,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  })) satisfies PublicBlogCard[];
  const nextCursor = hasMore ? posts[posts.length - 1]?.id ?? null : null;
  return { posts, nextCursor, hasMore };
}

export default async function BlogPage() {
  const { posts, nextCursor, hasMore } = await loadFirstPage();

  return (
    <div className="flex min-h-[100vh] flex-col bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-20 pt-28 sm:px-6">
        <header className="mb-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-fire-500">
            Blog
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Ideas for modern restaurants
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Product updates, growth tips, and stories from the Foodluk platform.
          </p>
        </header>

        <PublicBlogList
          initialPosts={posts}
          initialNextCursor={nextCursor}
          initialHasMore={hasMore}
        />
      </div>
    </div>
  );
}
