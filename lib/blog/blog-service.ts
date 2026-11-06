import { db } from '@/lib/db';
import {
  sanitizeBlogHtml,
  slugifyBlogTitle,
  type BlogPostWriteInput,
} from '@/lib/blog/blog';
import { normalizeBlogLanguageFlags } from '@/lib/blog/blog-language';

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
  const language = normalizeBlogLanguageFlags(input);

  return {
    title: input.title.trim(),
    slug,
    imageUrl: image || null,
    shortDescription: input.shortDescription.trim(),
    contentHtml: sanitizeBlogHtml(input.contentHtml.trim()),
    seoTitle: seoTitleRaw || null,
    seoDescription: seoDescriptionRaw || null,
    seoImageUrl: seoImage || null,
    featured: Boolean(input.featured),
    english: language.english,
    spanish: language.spanish,
    status: input.status,
    publishedAt,
  };
}

export async function resolveSlugForWrite(
  input: BlogPostWriteInput,
  excludeId?: string
): Promise<string> {
  const title = input.title.trim();
  const base = (input.slug ?? '').trim() || slugifyBlogTitle(title);
  return ensureUniqueBlogSlug(
    slugifyBlogTitle(base) || slugifyBlogTitle(title),
    excludeId
  );
}
