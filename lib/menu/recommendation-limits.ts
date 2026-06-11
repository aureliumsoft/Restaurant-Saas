export type VariationLimitRow = {
  variationId: string;
  minItems: number;
  maxItems: number;
};

export type RecommendationLimitInput = {
  selectionType: 'SINGLE' | 'MULTIPLE';
  minItems: number | null;
  maxItems: number | null;
  variationLimits?: VariationLimitRow[];
};

/** Effective min/max for a group given the guest's chosen base-product variation. */
export function getRecommendationLimits(
  group: RecommendationLimitInput,
  selectedVariationId: string | null | undefined
): { minItems: number; maxItems: number } {
  if (group.selectionType === 'SINGLE') {
    return { minItems: 1, maxItems: 1 };
  }

  if (selectedVariationId && group.variationLimits?.length) {
    const row = group.variationLimits.find(
      (v) => v.variationId === selectedVariationId
    );
    if (row) {
      return { minItems: row.minItems, maxItems: row.maxItems };
    }
  }

  return {
    minItems: group.minItems ?? 0,
    maxItems: group.maxItems ?? 99,
  };
}

export function totalSelectedUnits(selectedIds: string[]): number {
  return selectedIds.length;
}

/** Whether QUANTITY mode applies a free tier (null/0 = none, prices always visible). */
export function hasQuantityFreeTier(
  freeQuantity: number | null | undefined
): boolean {
  return freeQuantity != null && freeQuantity > 0;
}

/** Chargeable units after freeQuantity (QUANTITY mode). */
export function chargeableUnitsForOption(
  quantity: number,
  freeQuantity: number | null | undefined
): number {
  if (!hasQuantityFreeTier(freeQuantity)) return quantity;
  return Math.max(0, quantity - freeQuantity!);
}

/**
 * QUANTITY picker price labels: no free tier → always show; with free tier →
 * show once the guest has selected at least `freeQuantity` units in the group.
 */
export function shouldShowQuantityGroupPickerPrices(
  selectedIds: string[],
  freeQuantity: number | null | undefined
): boolean {
  if (!hasQuantityFreeTier(freeQuantity)) return true;
  if (selectedIds.length === 0) return false;
  return totalSelectedUnits(selectedIds) >= freeQuantity!;
}
