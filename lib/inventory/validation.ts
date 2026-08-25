import { z } from 'zod';

import { estimateDataUrlBytes, isAcceptedImageValue } from '@/lib/image-data-url';

export const INGREDIENT_UNIT_VALUES = ['PCS', 'G', 'KG', 'ML', 'L'] as const;

function imageCheck(
  v: string | null | undefined,
  ctx: z.RefinementCtx,
  path: (string | number)[]
) {
  if (!v || !v.trim()) return;
  if (!isAcceptedImageValue(v)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Photo must be an http/https URL or base64 image',
      path,
    });
    return;
  }
  if (v.startsWith('data:image/') && estimateDataUrlBytes(v) > 2 * 1024 * 1024) {
    ctx.addIssue({
      code: 'custom',
      message: 'Photo must be <= 2MB',
      path,
    });
  }
}

export const ingredientUnitSchema = z.enum(INGREDIENT_UNIT_VALUES);

export const ingredientCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    quantity: z.number().finite().min(0).default(0),
    unit: ingredientUnitSchema.optional().default('PCS'),
    isMajor: z.boolean().optional().default(false),
    imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal('')),
    sku: z.string().trim().max(80).optional().nullable(),
    minQuantity: z.number().finite().min(0).optional().nullable(),
  })
  .superRefine((val, ctx) => imageCheck(val.imageUrl, ctx, ['imageUrl']));

export const ingredientPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    quantity: z.number().finite().min(0).optional(),
    unit: ingredientUnitSchema.optional(),
    isMajor: z.boolean().optional(),
    imageUrl: z.string().max(2_800_000).optional().nullable().or(z.literal('')),
    sku: z.string().trim().max(80).optional().nullable(),
    minQuantity: z.number().finite().min(0).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .superRefine((val, ctx) => imageCheck(val.imageUrl, ctx, ['imageUrl']));

export const recipeRowSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().finite().positive(),
  restaurantVariationId: z.string().uuid().optional().nullable(),
});

export const stockEntryCreateSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().finite().positive(),
  reason: z.string().trim().min(1, 'Reason is required').max(2000),
  menuItemId: z.string().uuid().optional().nullable(),
  restaurantVariationId: z.string().uuid().optional().nullable(),
});
