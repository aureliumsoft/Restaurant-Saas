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
