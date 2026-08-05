import { z } from 'zod';

export const DOC_MODULE_STATUSES = ['DRAFT', 'PUBLISHED'] as const;

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
