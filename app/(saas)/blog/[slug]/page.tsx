import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicBlogArticle } from '@/components/marketing/public-blog-article';
import { PublicBlogShell } from '@/components/marketing/public-blog-shell';
import { buildBlogPostMetadata } from '@/lib/blog/metadata';
import {
  loadFeaturedBlogPosts,
  loadRecentBlogPosts,
} from '@/lib/blog/public-queries';
import { resolveBlogPostCms } from '@/lib/blog/resolve-public-blog';
import { db } from '@/lib/db';
import { resources } from '@/lib/i18n/resources';
import { getServerUiLanguage } from '@/lib/i18n/server-ui-language';

type Props = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getServerUiLanguage();
  const post = await db.blogPost.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      title: true,
      shortDescription: true,
      imageUrl: true,
      seoTitle: true,
      seoDescription: true,
      seoImageUrl: true,
      slug: true,
    },
  });
  if (!post) {
    return { title: resources[lang].translation.marketingExtras.blog.metaTitle };
  }
  const localized = resolveBlogPostCms(post, lang);
  return buildBlogPostMetadata({
    ...post,
    title: localized.title,
    shortDescription: localized.shortDescription,
    seoTitle: localized.seoTitle,
    seoDescription: localized.seoDescription,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [row, featured, recent] = await Promise.all([
    db.blogPost.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        title: true,
        imageUrl: true,
        shortDescription: true,
        contentHtml: true,
        publishedAt: true,
      },
    }),
    loadFeaturedBlogPosts(6),
    loadRecentBlogPosts(8, slug),
  ]);

  if (!row) notFound();

  return (
    <div className="flex min-h-[100vh] flex-col bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-black dark:to-zinc-950">
      <div className="mx-auto w-full flex-1 px-4 pb-20 pt-28 sm:px-6">
        <PublicBlogShell featured={featured} recent={recent}>
          <PublicBlogArticle
            title={row.title}
            shortDescription={row.shortDescription}
            contentHtml={row.contentHtml}
            imageUrl={row.imageUrl}
            publishedAt={row.publishedAt?.toISOString() ?? null}
          />
        </PublicBlogShell>
      </div>
    </div>
  );
}
