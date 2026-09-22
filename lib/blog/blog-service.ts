import { db } from '@/lib/db';
import {
  persistBlogBilingualField,
  persistBlogBilingualHtml,
  slugifyBlogTitle,
  type BlogPostWriteInput,
} from '@/lib/blog/blog';
import { parseBilingualInput } from '@/lib/menu/bilingual-text';

export async function ensureUniqueBlogSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  let candidate = base || 'post';
  let n = 0;
  for (;;) {
    const existing = await db.blogPost.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }
    n += 1;
    candidate = `${base.slice(0, 70)}-${n}`;
  }
}

export function mapBlogWritePayload(
  input: BlogPostWriteInput,
  slug: string,
  previousPublishedAt: Date | null
) {
  const image = (input.imageUrl ?? '').trim();
  const seoImage = (input.seoImageUrl ?? '').trim();
  const seoTitleRaw = (input.seoTitle ?? '').trim();
  const seoDescriptionRaw = (input.seoDescription ?? '').trim();
  const publishedAt =
    input.status === 'PUBLISHED'
      ? previousPublishedAt ?? new Date()
      : null;

  return {
    title: persistBlogBilingualField(input.title),
    slug,
    imageUrl: image || null,
    shortDescription: persistBlogBilingualField(input.shortDescription),
    contentHtml: persistBlogBilingualHtml(
      input.contentHtml,
      input.contentHtmlEs
    ),
    seoTitle: seoTitleRaw ? persistBlogBilingualField(seoTitleRaw) : null,
    seoDescription: seoDescriptionRaw
      ? persistBlogBilingualField(seoDescriptionRaw)
      : null,
    seoImageUrl: seoImage || null,
    featured: Boolean(input.featured),
    status: input.status,
    publishedAt,
  };
}

export async function resolveSlugForWrite(
  input: BlogPostWriteInput,
  excludeId?: string
): Promise<string> {
  const englishTitle =
    parseBilingualInput(input.title).en || input.title.trim();
  const base =
    (input.slug ?? '').trim() || slugifyBlogTitle(englishTitle);
  return ensureUniqueBlogSlug(
    slugifyBlogTitle(base) || slugifyBlogTitle(englishTitle),
    excludeId
  );
}
