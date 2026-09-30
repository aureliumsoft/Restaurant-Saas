import type { Metadata } from 'next';

import {
  PublicBlogList,
  type PublicBlogCard,
} from '@/components/marketing/public-blog-list';
import { PublicBlogIndexHeader } from '@/components/marketing/public-blog-chrome';
import { PublicBlogShell } from '@/components/marketing/public-blog-shell';
import {
  loadFeaturedBlogPosts,
  loadRecentBlogPosts,
} from '@/lib/blog/public-queries';
import { db } from '@/lib/db';
import { getServerUiLanguage } from '@/lib/i18n/server-ui-language';
import { resources } from '@/lib/i18n/resources';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerUiLanguage();
  const copy = resources[lang].translation.marketingExtras.blog;
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      type: 'website',
    },
  };
}

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
  const posts = (hasMore ? rows.slice(0, limit) : rows).map(
    (p) =>
      ({
        id: p.id,
        slug: p.slug,
        imageUrl: p.imageUrl,
        title: p.title,
        shortDescription: p.shortDescription,
        publishedAt: p.publishedAt?.toISOString() ?? null,
      }) satisfies PublicBlogCard
  );
  const nextCursor = hasMore ? posts[posts.length - 1]?.id ?? null : null;
  return { posts, nextCursor, hasMore };
}

export default async function BlogPage() {
  const [{ posts, nextCursor, hasMore }, featured, recent] = await Promise.all([
    loadFirstPage(),
    loadFeaturedBlogPosts(6),
    loadRecentBlogPosts(8),
  ]);

  return (
    <div className="flex min-h-[100vh] flex-col bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      <div className="mx-auto flex w-full flex-1 flex-col px-4 pb-20 pt-28 sm:px-6">
        <PublicBlogIndexHeader />

        <PublicBlogShell featured={featured} recent={recent}>
          <PublicBlogList
            initialPosts={posts}
            initialNextCursor={nextCursor}
            initialHasMore={hasMore}
          />
        </PublicBlogShell>
      </div>
    </div>
  );
}
