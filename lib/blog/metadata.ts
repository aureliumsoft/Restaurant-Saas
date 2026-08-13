import type { Metadata } from 'next';

import { getBaseUrl as getSiteBaseUrl } from '@/lib/public-app-origin-server';

export type BlogSeoFields = {
  title: string;
  shortDescription: string;
  imageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImageUrl?: string | null;
  slug?: string;
};

function resolveOgImageAbsolute(
  image: string | null | undefined,
  baseUrl: string
): string | undefined {
  const raw = (image ?? '').trim();
  if (!raw) return undefined;
  // data URLs are unused by Google indexing crawlers for SERP thumbnails
  if (raw.startsWith('data:')) return undefined;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${baseUrl}${raw}`;
  return undefined;
}

/** Resolve snippet title, description, and image for Google / social cards. */
export function resolveBlogSeoSnippet(post: BlogSeoFields) {
  const title =
    (post.seoTitle ?? '').trim() || post.title.trim() || 'Foodluk Blog';
  const description =
    (post.seoDescription ?? '').trim() ||
    post.shortDescription.trim() ||
    'Read more on the Foodluk blog.';
  const image =
    (post.seoImageUrl ?? '').trim() || (post.imageUrl ?? '').trim() || null;
  return { title, description, image };
}

export function buildBlogPostMetadata(post: BlogSeoFields): Metadata {
  const baseUrl = getSiteBaseUrl();
  const snippet = resolveBlogSeoSnippet(post);
  const ogImage = resolveOgImageAbsolute(snippet.image, baseUrl);
  const path = post.slug ? `/blog/${post.slug}` : '/blog';
  const url = `${baseUrl}${path}`;

  return {
    title: `${snippet.title} | Foodluk Blog`,
    description: snippet.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: snippet.title,
      description: snippet.description,
      siteName: 'Foodluk',
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                alt: snippet.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: snippet.title,
      description: snippet.description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
