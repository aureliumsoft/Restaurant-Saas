import { z } from 'zod';

import {
  estimateDataUrlBytes,
  isAcceptedImageValue,
} from '@/lib/image-data-url';

const personalizeImageUrl = z
  .string()
  .max(2_800_000)
  .optional()
  .nullable()
  .or(z.literal(''));

const personalizeOptionSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    imageUrl: personalizeImageUrl,
    sortOrder: z.number().int().min(0).optional(),
  })
  .superRefine((val, ctx) => {
    const v = val.imageUrl;
    if (!v || !v.trim()) return;
    if (!isAcceptedImageValue(v)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Image must be an http/https URL or base64 image',
        path: ['imageUrl'],
      });
    } else if (
      v.startsWith('data:image/') &&
      estimateDataUrlBytes(v) > 2 * 1024 * 1024
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Image base64 must be <= 2MB',
        path: ['imageUrl'],
      });
    }
  });

export const syncPersonalizeGroupsSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        parentName: z.string().trim().min(1).max(120),
        maxItems: z.number().int().min(1).max(20),
        sortOrder: z.number().int().min(0).optional(),
        options: z.array(personalizeOptionSchema).min(1).max(50),
      })
    )
    .max(20),
});
