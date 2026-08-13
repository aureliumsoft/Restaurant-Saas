import { z } from 'zod';

import { estimateDataUrlBytes, isAcceptedImageValue } from '@/lib/image-data-url';

export const BLOG_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export function slugifyBlogTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'post';
}

export function isBlogStatus(v: string): v is BlogStatus {
  return (BLOG_STATUSES as readonly string[]).includes(v);
}

function assertImage(label: string, raw: string, ctx: z.RefinementCtx, path: string[]) {
  const t = raw.trim();
  if (!t) return;
  if (!isAcceptedImageValue(t)) {
    ctx.addIssue({
      code: 'custom',
      message: `${label} must be an http(s) URL or base64 image`,
      path,
    });
    return;
  }
  if (t.startsWith('data:image/')) {
    const bytes = estimateDataUrlBytes(t);
    // ~2MB binary after encoding — compressed uploads stay well under this
    if (bytes > 3 * 1024 * 1024) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be ≤ 3MB`,
        path,
      });
    }
  }
}

export const blogPostWriteSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    // Base64 data URLs are ~4/3 of binary size; allow room for a few MB photo
    imageUrl: z.string().max(5_500_000).optional().or(z.literal('')),
    shortDescription: z
      .string()
      .trim()
      .min(1, 'Short description is required')
      .max(500),
    contentHtml: z.string().trim().min(1, 'Blog detail is required').max(2_800_000),
    status: z.enum(BLOG_STATUSES),
    slug: z.string().trim().max(100).optional().or(z.literal('')),
    seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
    seoDescription: z.string().trim().max(500).optional().or(z.literal('')),
    seoImageUrl: z.string().max(5_500_000).optional().or(z.literal('')),
    featured: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.imageUrl !== undefined && val.imageUrl !== '') {
      assertImage('Image', val.imageUrl, ctx, ['imageUrl']);
    }
    if (val.seoImageUrl !== undefined && val.seoImageUrl !== '') {
      assertImage('Google snippet photo', val.seoImageUrl, ctx, ['seoImageUrl']);
    }
  });

export type BlogPostWriteInput = z.infer<typeof blogPostWriteSchema>;

/** Strip dangerous tags for stored/displayed HTML (basic). */
export function sanitizeBlogHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
