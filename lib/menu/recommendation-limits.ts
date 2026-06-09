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

/** Chargeable units after freeQuantity (QUANTITY mode). */
export function chargeableUnitsForOption(
  quantity: number,
  freeQuantity: number | null | undefined
): number {
  const free = Math.max(0, freeQuantity ?? 0);
  return Math.max(0, quantity - free);
}

/**
 * QUANTITY groups with a free tier: hide picker prices until the guest adds at
 * least `freeQuantity` of one option (e.g. 1 free → first + shows all prices).
 */
export function shouldShowQuantityGroupPickerPrices(
  selectedIds: string[],
  freeQuantity: number | null | undefined
): boolean {
  if (selectedIds.length === 0) return false;

  const free = Math.max(0, freeQuantity ?? 0);
  if (free === 0) return true;

  const qtyByOption = new Map<string, number>();
  for (const id of selectedIds) {
    qtyByOption.set(id, (qtyByOption.get(id) ?? 0) + 1);
  }
  for (const qty of qtyByOption.values()) {
    if (qty >= free) return true;
  }
  return false;
}
