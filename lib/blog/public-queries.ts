import { resolveBlogPostCms } from '@/lib/blog/resolve-public-blog';
import { db } from '@/lib/db';
import type { UiLanguage } from '@/lib/i18n/resources';

export type PublicBlogSidebarCard = {
  id: string;
  /** Raw bilingual JSON / &&&& — resolve in the client for live language switch. */
  title: string;
  slug: string;
  imageUrl: string | null;
  shortDescription: string;
  publishedAt: string | null;
  featured: boolean;
};

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  imageUrl: true,
  shortDescription: true,
  publishedAt: true,
  featured: true,
} as const;

function mapCard(p: {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  shortDescription: string;
  publishedAt: Date | null;
  featured: boolean;
}): PublicBlogSidebarCard {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    imageUrl: p.imageUrl,
    shortDescription: p.shortDescription,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    featured: p.featured,
  };
}

export async function loadFeaturedBlogPosts(
  limit = 6,
  _lang?: UiLanguage
): Promise<PublicBlogSidebarCard[]> {
  const rows = await db.blogPost.findMany({
    where: { status: 'PUBLISHED', featured: true },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(mapCard);
}

export async function loadRecentBlogPosts(
  limit = 6,
  excludeSlug?: string,
  _lang?: UiLanguage
): Promise<PublicBlogSidebarCard[]> {
  const rows = await db.blogPost.findMany({
    where: {
      status: 'PUBLISHED',
      ...(excludeSlug ? { slug: { not: excludeSlug } } : {}),
    },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(mapCard);
}

/** Resolve bilingual card fields for a fixed language (metadata / SSR). */
export function localizeBlogSidebarCard(
  card: PublicBlogSidebarCard,
  lang: UiLanguage
): PublicBlogSidebarCard {
  const localized = resolveBlogPostCms(
    {
      title: card.title,
      shortDescription: card.shortDescription,
    },
    lang
  );
  return {
    ...card,
    title: localized.title,
    shortDescription: localized.shortDescription,
  };
}
