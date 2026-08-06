import { z } from 'zod';

import { db } from '@/lib/db';

export const DOC_MODULE_STATUSES = ['DRAFT', 'PUBLISHED'] as const;

export function slugifyDocLabel(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `item-${Date.now().toString(36)}`;
}

export const documentationHeadingWriteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug')
    .optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(DOC_MODULE_STATUSES).optional(),
});

export const documentationSubHeadingWriteSchema = z.object({
  headingId: z.string().trim().min(1, 'Heading is required'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug')
    .optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(DOC_MODULE_STATUSES).optional(),
});

export const documentationModuleWriteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  shortDescription: z
    .string()
    .trim()
    .min(1, 'Short description is required')
    .max(1000),
  contentHtml: z.string().trim().min(1, 'Detail is required').max(2_800_000),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(DOC_MODULE_STATUSES).optional(),
  headingId: z.string().trim().min(1).nullable().optional(),
  subHeadingId: z.string().trim().min(1).nullable().optional(),
  /** Optional free-text sub heading; resolved/created on write when set. */
  subHeadingName: z.string().trim().max(200).optional(),
});

export type DocumentationModuleWriteInput = z.infer<
  typeof documentationModuleWriteSchema
>;

export function sanitizeDocHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export const documentationModuleInclude = {
  heading: { select: { id: true, name: true, slug: true } },
  subHeading: { select: { id: true, name: true, slug: true, headingId: true } },
} as const;

/**
 * Resolve heading (+ optional sub heading name/id) for create/update.
 * Empty subHeadingName → page lives only under the heading.
 */
export async function resolveDocumentationLinks(opts: {
  headingId?: string | null;
  subHeadingId?: string | null;
  /** When provided (including ''), overrides id-based sub link. */
  subHeadingName?: string | null;
}): Promise<
  | { ok: true; headingId: string | null; subHeadingId: string | null }
  | { ok: false; error: string; status: number }
> {
  let headingId =
    opts.headingId === undefined ? undefined : opts.headingId?.trim() || null;

  if (headingId) {
    const heading = await db.documentationHeading.findUnique({
      where: { id: headingId },
      select: { id: true },
    });
    if (!heading) {
      return { ok: false, error: 'Heading not found', status: 404 };
    }
  }

  if (opts.subHeadingName !== undefined) {
    const name = (opts.subHeadingName ?? '').trim();
    if (!name) {
      return {
        ok: true,
        headingId: headingId ?? null,
        subHeadingId: null,
      };
    }
    if (!headingId) {
      return {
        ok: false,
        error: 'Heading is required when setting a sub heading',
        status: 400,
      };
    }
    const slug = slugifyDocLabel(name);
    let sub = await db.documentationSubHeading.findFirst({
      where: {
        headingId,
        OR: [{ slug }, { name: { equals: name, mode: 'insensitive' } }],
      },
      select: { id: true },
    });
    if (!sub) {
      try {
        sub = await db.documentationSubHeading.create({
          data: {
            headingId,
            name,
            slug,
            status: 'PUBLISHED',
          },
          select: { id: true },
        });
      } catch {
        sub = await db.documentationSubHeading.findFirst({
          where: { headingId, slug },
          select: { id: true },
        });
        if (!sub) {
          return {
            ok: false,
            error: 'Could not create sub heading',
            status: 500,
          };
        }
      }
    }
    return { ok: true, headingId, subHeadingId: sub.id };
  }

  let subHeadingId =
    opts.subHeadingId === undefined
      ? undefined
      : opts.subHeadingId?.trim() || null;

  if (subHeadingId) {
    const sub = await db.documentationSubHeading.findUnique({
      where: { id: subHeadingId },
      select: { id: true, headingId: true },
    });
    if (!sub) {
      return { ok: false, error: 'Sub heading not found', status: 404 };
    }
    if (headingId && headingId !== sub.headingId) {
      return {
        ok: false,
        error: 'Sub heading does not belong to the selected heading',
        status: 400,
      };
    }
    headingId = sub.headingId;
  }

  return {
    ok: true,
    headingId: headingId ?? null,
    subHeadingId: subHeadingId ?? null,
  };
}
