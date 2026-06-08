import { z } from 'zod';

import { estimateDataUrlBytes, isAcceptedImageValue } from '@/lib/image-data-url';
import { zOptionalText, zPositiveNumber, zRequiredText, zUuid } from '@/lib/validation/fields';

function imageRefine(
  val: { imageUrl?: string | null; variations?: { imageUrl?: string | null }[] },
  ctx: z.RefinementCtx
) {
  const check = (
    label: string,
    v: string | null | undefined,
    path: (string | number)[]
  ) => {
    if (!v || !v.trim()) return;
    if (!isAcceptedImageValue(v)) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be an http/https URL or base64 image`,
        path,
      });
      return;
    }
    if (
      v.startsWith('data:image/') &&
      estimateDataUrlBytes(v) > 2 * 1024 * 1024
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} base64 image must be <= 2MB`,
        path,
      });
    }
  };
  check('Image', val.imageUrl, ['imageUrl']);
  (val.variations ?? []).forEach((v, i) =>
    check('Variation image', v.imageUrl, ['variations', i, 'imageUrl'])
  );
}

export const menuItemCreateSchema = z
  .object({
    name: zRequiredText(200, 'Name'),
    description: zOptionalText(2000),
    categoryId: zUuid(),
    imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal('')),
    price: zPositiveNumber(),
    salePrice: zPositiveNumber().optional().nullable(),
    variations: z
      .array(
        z.object({
          name: zRequiredText(120, 'Variation name'),
          imageUrl: z
            .string()
            .max(2_800_000)
            .optional()
            .nullable()
            .or(z.literal('')),
          swatchHex: z
            .string()
            .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
            .optional()
            .nullable()
            .or(z.literal('')),
          priceDelta: z.number().finite().optional(),
        })
      )
      .max(50)
      .optional(),
  })
  .superRefine(imageRefine);

const categoryImageUrl = z
  .string()
  .max(2_800_000)
  .optional()
  .nullable()
  .or(z.literal(''));

export const menuCategoryCreateSchema = z
  .object({
    name: zRequiredText(120, 'Category name'),
    sortOrder: z.number().int().min(0).optional(),
    showInFront: z.boolean().optional(),
    imageUrl: categoryImageUrl,
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
      return;
    }
    if (
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

export const menuCategoryPatchSchema = z
  .object({
    name: zRequiredText(120, 'Category name').optional(),
    sortOrder: z.number().int().min(0).optional(),
    showInFront: z.boolean().optional(),
    imageUrl: categoryImageUrl,
  })
  .superRefine((val, ctx) => {
    const v = val.imageUrl;
    if (v === undefined || v === null || !v.trim()) return;
    if (!isAcceptedImageValue(v)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Image must be an http/https URL or base64 image',
        path: ['imageUrl'],
      });
      return;
    }
    if (
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
