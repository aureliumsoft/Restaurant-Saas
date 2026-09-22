import { z } from 'zod';

import { estimateDataUrlBytes, isAcceptedImageValue } from '@/lib/image-data-url';
import {
  parseBilingualInput,
  parseStoredBilingualText,
  serializeBilingualInput,
  serializeBilingualText,
} from '@/lib/menu/bilingual-text';

export const BLOG_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export function slugifyBlogTitle(title: string): string {
  const english =
    parseBilingualInput(title).en ||
    parseStoredBilingualText(title).en ||
    title;
  const base = english
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
    if (bytes > 3 * 1024 * 1024) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be ≤ 3MB`,
        path,
      });
    }
  }
}

const optionalCmsField = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''));

/** Persist editor `en &&&& es` (or already-stored JSON) into DB bilingual JSON. */
export function persistBlogBilingualField(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{')) {
    const parts = parseStoredBilingualText(trimmed);
    if (!parts.en && !parts.es) return '';
    return serializeBilingualText(parts);
  }
  return serializeBilingualInput(trimmed);
}

export const blogPostWriteSchema = z
  .object({
    /** Editor: `English &&&& Spanish` (or stored JSON). */
    title: z.string().trim().min(1, 'Title is required').max(500),
    imageUrl: z.string().max(5_500_000).optional().or(z.literal('')),
    shortDescription: z
      .string()
      .trim()
      .min(1, 'Short description is required')
      .max(1200),
    /** HTML EN body, or combined bilingual JSON / &&&& string. */
    contentHtml: z.string().trim().min(1, 'Blog detail is required').max(2_800_000),
    /** Optional Spanish HTML body when sending split EN/ES (admin form). */
    contentHtmlEs: optionalCmsField(2_800_000),
    status: z.enum(BLOG_STATUSES),
    slug: z.string().trim().max(100).optional().or(z.literal('')),
    seoTitle: optionalCmsField(500),
    seoDescription: optionalCmsField(1200),
    seoImageUrl: z.string().max(5_500_000).optional().or(z.literal('')),
    featured: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    const titleParts = parseBilingualInput(val.title);
    if (!titleParts.en) {
      ctx.addIssue({
        code: 'custom',
        message: 'English title (before &&&&) is required',
        path: ['title'],
      });
    }
    if (titleParts.en.length > 200) {
      ctx.addIssue({
        code: 'custom',
        message: 'English title must be ≤ 200 characters',
        path: ['title'],
      });
    }
    if (titleParts.es.length > 200) {
      ctx.addIssue({
        code: 'custom',
        message: 'Spanish title must be ≤ 200 characters',
        path: ['title'],
      });
    }

    const shortParts = parseBilingualInput(val.shortDescription);
    if (!shortParts.en) {
      ctx.addIssue({
        code: 'custom',
        message: 'English short description (before &&&&) is required',
        path: ['shortDescription'],
      });
    }
    if (shortParts.en.length > 500) {
      ctx.addIssue({
        code: 'custom',
        message: 'English short description must be ≤ 500 characters',
        path: ['shortDescription'],
      });
    }
    if (shortParts.es.length > 500) {
      ctx.addIssue({
        code: 'custom',
        message: 'Spanish short description must be ≤ 500 characters',
        path: ['shortDescription'],
      });
    }

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

/** Sanitize bilingual HTML payload (split EN/ES fields or one combined string). */
export function persistBlogBilingualHtml(
  contentHtml: string,
  contentHtmlEs?: string | null
): string {
  if (typeof contentHtmlEs === 'string') {
    return serializeBilingualText({
      en: sanitizeBlogHtml(contentHtml.trim()),
      es: sanitizeBlogHtml(contentHtmlEs.trim()),
    });
  }
  const trimmed = contentHtml.trim();
  if (trimmed.startsWith('{') || trimmed.includes('&&&&')) {
    const parts = parseStoredBilingualText(trimmed);
    return serializeBilingualText({
      en: sanitizeBlogHtml(parts.en),
      es: sanitizeBlogHtml(parts.es),
    });
  }
  return serializeBilingualText({
    en: sanitizeBlogHtml(trimmed),
    es: '',
  });
}
