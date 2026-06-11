import type { VariationLimitDraft } from '@/components/dashboard/menu-manager/recommendation-rule-form';

export type CategoryMinMaxDraft = {
  minItems: number;
  maxItems: number;
};

export const DEFAULT_CATEGORY_MIN_MAX: CategoryMinMaxDraft = {
  minItems: 1,
  maxItems: 3,
};

export const DEFAULT_FREE_QUANTITY = 1;

export function nextRecommendationSortOrderBase(
  groups: Array<{ sortOrder?: number | null }>
): number {
  if (groups.length === 0) return 0;
  return Math.max(0, ...groups.map((g) => g.sortOrder ?? 0)) + 1;
}

/** Persisted free tier for a category; null/0 = no free units (prices always shown). */
export function resolveCategoryFreeQuantity(
  values: Record<string, number | null | undefined>,
  categoryId: string
): number | null {
  if (!Object.prototype.hasOwnProperty.call(values, categoryId)) {
    return null;
  }
  const val = values[categoryId];
  if (val == null || val === 0) return val === 0 ? 0 : null;
  return Math.max(DEFAULT_FREE_QUANTITY, val);
}

/** Persisted free tier for a linked product recommendation. */
export function resolveProductFreeQuantity(
  values: Record<string, number | null | undefined>,
  productId: string
): number | null {
  if (!Object.prototype.hasOwnProperty.call(values, productId)) {
    return null;
  }
  const val = values[productId];
  if (val == null || val === 0) return val === 0 ? 0 : null;
  return Math.max(DEFAULT_FREE_QUANTITY, val);
}

export function defaultVariationLimitsForVariations(
  variations: Array<{ id: string }>
): VariationLimitDraft[] {
  return variations.map((v) => ({
    variationId: v.id,
    minItems: DEFAULT_CATEGORY_MIN_MAX.minItems,
    maxItems: DEFAULT_CATEGORY_MIN_MAX.maxItems,
  }));
}

export function variationLabel(
  variation: { name?: string | null; title?: string | null },
  fallback = 'Variation'
): string {
  return variation.title?.trim() || variation.name?.trim() || fallback;
}

export function categoryUsesVariationLimits(
  baseVariationCount: number,
  categoryVariationLimits: VariationLimitDraft[] | undefined
): boolean {
  return baseVariationCount > 0 && (categoryVariationLimits?.length ?? 0) > 0;
}
