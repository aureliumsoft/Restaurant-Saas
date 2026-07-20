import { z } from 'zod';

export const variationLimitSchema = z.object({
  variationId: z.string().uuid(),
  minItems: z.number().int().min(0),
  maxItems: z.number().int().min(1),
});

export const recommendationGroupBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    sourceType: z.enum(['CATEGORY', 'PRODUCT']).default('CATEGORY'),
    selectionType: z.enum(['SINGLE', 'MULTIPLE']),
    multipleMode: z.enum(['CHECKBOX', 'QUANTITY']).optional(),
    required: z.boolean().optional(),
    linkedCategoryId: z.string().uuid().optional(),
    defaultLinkedMenuItemId: z.string().uuid().nullable().optional(),
    defaultLinkedRestaurantVariationId: z.string().uuid().nullable().optional(),
    linkedProductId: z.string().uuid().optional(),
    productCategoryIds: z.array(z.string().uuid()).optional(),
    sortOrder: z.number().int().min(0).optional(),
    minItems: z.number().int().min(0).nullable().optional(),
    maxItems: z.number().int().min(1).nullable().optional(),
    freeQuantity: z.number().int().min(0).nullable().optional(),
    variationLimits: z.array(variationLimitSchema).optional(),
    useVariationPricing: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === 'CATEGORY' && !data.linkedCategoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'linkedCategoryId is required for category recommendations',
        path: ['linkedCategoryId'],
      });
    }
    if (data.sourceType === 'PRODUCT' && data.defaultLinkedMenuItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'defaultLinkedMenuItemId must not be set for product recommendations',
        path: ['defaultLinkedMenuItemId'],
      });
    }
    if (data.sourceType === 'PRODUCT' && data.defaultLinkedRestaurantVariationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'defaultLinkedRestaurantVariationId must not be set for product recommendations',
        path: ['defaultLinkedRestaurantVariationId'],
      });
    }
    if (
      data.useVariationPricing &&
      data.defaultLinkedRestaurantVariationId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Choose either variation pricing or a fixed default variation, not both',
        path: ['defaultLinkedRestaurantVariationId'],
      });
    }
    if (data.sourceType === 'PRODUCT' && !data.linkedProductId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'linkedProductId is required for product recommendations',
        path: ['linkedProductId'],
      });
    }
    if (
      data.sourceType === 'PRODUCT' &&
      (!data.productCategoryIds || data.productCategoryIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one category for product recommendations',
        path: ['productCategoryIds'],
      });
    }
    if (data.sourceType === 'CATEGORY' && data.linkedProductId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'linkedProductId must not be set for category recommendations',
        path: ['linkedProductId'],
      });
    }
    if (data.sourceType === 'PRODUCT' && data.linkedCategoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'linkedCategoryId must not be set for product recommendations',
        path: ['linkedCategoryId'],
      });
    }

    if (data.selectionType === 'SINGLE') {
      if (data.multipleMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'multipleMode applies only to MULTIPLE selection',
          path: ['multipleMode'],
        });
      }
      return;
    }

    if (!data.multipleMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'multipleMode is required for MULTIPLE selection',
        path: ['multipleMode'],
      });
    }

    const hasVariationLimits =
      data.variationLimits != null && data.variationLimits.length > 0;

    if (!hasVariationLimits) {
      if (data.minItems == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'minItems is required when variation limits are not set',
          path: ['minItems'],
        });
      }
      if (data.maxItems == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maxItems is required when variation limits are not set',
          path: ['maxItems'],
        });
      }
    }

    if (
      data.minItems != null &&
      data.maxItems != null &&
      data.maxItems < data.minItems
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxItems must be >= minItems',
        path: ['maxItems'],
      });
    }

    for (const row of data.variationLimits ?? []) {
      if (row.maxItems < row.minItems) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each variation maxItems must be >= minItems',
          path: ['variationLimits'],
        });
        break;
      }
    }

  });

export type RecommendationGroupBody = z.infer<typeof recommendationGroupBodySchema>;
