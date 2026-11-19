import { z } from 'zod';

import { db } from '@/lib/db';
import {
  BILINGUAL_SEPARATOR,
  parseBilingualInput,
  parseStoredBilingualText,
  serializeBilingualText,
  type BilingualText,
} from '@/lib/menu/bilingual-text';

export const DOC_MODULE_STATUSES = ['DRAFT', 'PUBLISHED'] as const;

/**
 * English and Spanish are separate editor fields.
 * `nameEs` omitted keeps legacy `&&&&` / JSON payloads in `name`.
 * `nameEs` present (including '') is the Spanish field and wins.
 */
export function docNameParts(
  name: string,
  nameEs?: string | null
): BilingualText {
  const raw = (name ?? '').trim();
  const hasExplicitEs = nameEs !== undefined && nameEs !== null;

  if (hasExplicitEs) {
    const es = nameEs.trim();
    if (raw.startsWith('{')) {
      return { en: parseStoredBilingualText(raw).en, es };
    }
    if (raw.includes(BILINGUAL_SEPARATOR)) {
      return { en: parseBilingualInput(raw).en, es };
    }
    return { en: raw, es };
  }

  if (!raw) return { en: '', es: '' };
  if (raw.startsWith('{')) return parseStoredBilingualText(raw);
  return parseBilingualInput(raw);
}

/** Persist separate English + Spanish (or a legacy `&&&&` / JSON name) as `{en,es}`. */
export function persistDocBilingualName(
  raw: string,
  nameEs?: string | null
): string {
  const parts = docNameParts(raw, nameEs);
  if (!parts.en && !parts.es) return '';
  return serializeBilingualText(parts);
}

export function slugifyDocLabel(raw: string, nameEs?: string | null): string {
  const english = docNameParts(raw, nameEs).en || raw;
  const base = english
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `item-${Date.now().toString(36)}`;
}

const optionalCmsField = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''));

function assertBilingualName(
  name: string,
  nameEs: string | undefined,
  ctx: z.RefinementCtx
) {
  const parts = docNameParts(name, nameEs);
  if (!parts.en) {
    ctx.addIssue({
      code: 'custom',
      message: 'English name is required',
      path: ['name'],
    });
  }
  if (parts.en.length > 200) {
    ctx.addIssue({
      code: 'custom',
      message: 'English name must be ≤ 200 characters',
      path: ['name'],
    });
  }
  if (parts.es.length > 200) {
    ctx.addIssue({
      code: 'custom',
      message: 'Spanish name must be ≤ 200 characters',
      path: ['nameEs'],
    });
  }
}

const documentationHeadingWriteBase = z.object({
  /** English name. Legacy rows may still send `English &&&& Spanish` or JSON. */
  name: z.string().trim().min(1, 'Name is required').max(500),
  /** Spanish name. Omit only for legacy single-field payloads. */
  nameEs: optionalCmsField(200),
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

export const documentationHeadingWriteSchema =
  documentationHeadingWriteBase.superRefine((val, ctx) => {
    assertBilingualName(val.name, val.nameEs, ctx);
  });

export const documentationHeadingPatchSchema =
  documentationHeadingWriteBase.partial().superRefine((val, ctx) => {
    if (val.name !== undefined) assertBilingualName(val.name, val.nameEs, ctx);
  });

const documentationSubHeadingWriteBase = z.object({
  headingId: z.string().trim().min(1, 'Heading is required'),
  /** English name. Legacy rows may still send `English &&&& Spanish` or JSON. */
  name: z.string().trim().min(1, 'Name is required').max(500),
  /** Spanish name. Omit only for legacy single-field payloads. */
  nameEs: optionalCmsField(200),
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

export const documentationSubHeadingWriteSchema =
  documentationSubHeadingWriteBase.superRefine((val, ctx) => {
    assertBilingualName(val.name, val.nameEs, ctx);
  });

export const documentationSubHeadingPatchSchema =
  documentationSubHeadingWriteBase.partial().superRefine((val, ctx) => {
    if (val.name !== undefined) assertBilingualName(val.name, val.nameEs, ctx);
  });

export const documentationModuleWriteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  nameEs: optionalCmsField(200),
  shortDescription: z
    .string()
    .trim()
    .min(1, 'Short description is required')
    .max(1000),
  shortDescriptionEs: optionalCmsField(1000),
  contentHtml: z.string().trim().min(1, 'Detail is required').max(2_800_000),
  contentHtmlEs: optionalCmsField(2_800_000),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(DOC_MODULE_STATUSES).optional(),
  headingId: z.string().trim().min(1).nullable().optional(),
  subHeadingId: z.string().trim().min(1).nullable().optional(),
  /** Optional English sub heading; resolved/created on write when set. */
  subHeadingName: z.string().trim().max(500).optional(),
  /** Optional Spanish sub heading, paired with `subHeadingName`. */
  subHeadingNameEs: z.string().trim().max(200).optional(),
});

export type DocumentationModuleWriteInput = z.infer<
  typeof documentationModuleWriteSchema
>;

export function nullIfBlankCms(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed || null;
}

/** Blank rich text (`<p><br></p>`, empty tags) is stored as null so the other language can be used. */
export function nullIfEmptyDocHtml(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const plain = trimmed
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain ? trimmed : null;
}

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
  /** Spanish name saved with `subHeadingName`. */
  subHeadingNameEs?: string | null;
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
    const nameEs = (opts.subHeadingNameEs ?? '').trim();
    if (!name) {
      if (nameEs) {
        return {
          ok: false,
          error: 'English sub heading is required',
          status: 400,
        };
      }
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
    const persistedName = persistDocBilingualName(name, opts.subHeadingNameEs);
    const slug = slugifyDocLabel(name, opts.subHeadingNameEs);
    const english = docNameParts(name, opts.subHeadingNameEs).en || name;
    let sub = await db.documentationSubHeading.findFirst({
      where: {
        headingId,
        OR: [
          { slug },
          { name: { equals: persistedName, mode: 'insensitive' } },
          { name: { equals: english, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
    if (!sub) {
      try {
        sub = await db.documentationSubHeading.create({
          data: {
            headingId,
            name: persistedName,
            slug,
            status: 'PUBLISHED',
          },
          select: { id: true, name: true },
        });
      } catch {
        sub = await db.documentationSubHeading.findFirst({
          where: { headingId, slug },
          select: { id: true, name: true },
        });
        if (!sub) {
          return {
            ok: false,
            error: 'Could not create sub heading',
            status: 500,
          };
        }
      }
    } else if (sub.name !== persistedName) {
      await db.documentationSubHeading.update({
        where: { id: sub.id },
        data: { name: persistedName },
      });
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
