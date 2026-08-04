import { db } from '@/lib/db';
import {
  sanitizeBlogHtml,
  slugifyBlogTitle,
  type BlogPostWriteInput,
} from '@/lib/blog/blog';

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
  const publishedAt =
    input.status === 'PUBLISHED'
      ? previousPublishedAt ?? new Date()
      : null;

  return {
    title: input.title.trim(),
    slug,
    imageUrl: image || null,
    shortDescription: input.shortDescription.trim(),
    contentHtml: sanitizeBlogHtml(input.contentHtml.trim()),
    status: input.status,
    publishedAt,
  };
}

export async function resolveSlugForWrite(
  input: BlogPostWriteInput,
  excludeId?: string
): Promise<string> {
  const base = (input.slug ?? '').trim() || slugifyBlogTitle(input.title);
  return ensureUniqueBlogSlug(slugifyBlogTitle(base) || slugifyBlogTitle(input.title), excludeId);
}
