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

/**
 * Chargeable units for one option in isolation (same option qty only).
 * Prefer `chargeableUnitsForOptionInGroup` when multiple options share a category.
 */
export function chargeableUnitsForOption(
  quantity: number,
  freeQuantity: number | null | undefined
): number {
  if (!hasQuantityFreeTier(freeQuantity)) return quantity;
  return Math.max(0, quantity - freeQuantity!);
}

/**
 * QUANTITY groups: first `freeQuantity` units across the whole group are free
 * (selection order). Returns chargeable unit count per option id.
 */
export function chargeableUnitsByOptionInGroup(
  selectedIds: string[],
  freeQuantity: number | null | undefined
): Map<string, number> {
  const chargeable = new Map<string, number>();
  if (!hasQuantityFreeTier(freeQuantity)) {
    for (const id of selectedIds) {
      chargeable.set(id, (chargeable.get(id) ?? 0) + 1);
    }
    return chargeable;
  }

  let freeRemaining = freeQuantity!;
  for (const id of selectedIds) {
    if (freeRemaining > 0) {
      freeRemaining -= 1;
    } else {
      chargeable.set(id, (chargeable.get(id) ?? 0) + 1);
    }
  }
  return chargeable;
}

export function chargeableUnitsForOptionInGroup(
  selectedIds: string[],
  optionId: string,
  freeQuantity: number | null | undefined
): number {
  return chargeableUnitsByOptionInGroup(selectedIds, freeQuantity).get(optionId) ?? 0;
}

/**
 * Show (+€) for one option in a QUANTITY free-tier group.
 * Prices stay hidden until total selected units reach `freeQuantity`; then:
 * - selected options with chargeable units show price;
 * - unselected options show price (guest is past the free allowance).
 */
export function shouldShowOptionQuantityPrice(
  selectedIds: string[],
  optionId: string,
  freeQuantity: number | null | undefined
): boolean {
  if (!hasQuantityFreeTier(freeQuantity)) return true;
  if (!shouldShowQuantityGroupPickerPrices(selectedIds, freeQuantity)) {
    return false;
  }

  const optionQty = selectedIds.filter((id) => id === optionId).length;
  if (optionQty > 0) {
    return (
      chargeableUnitsForOptionInGroup(selectedIds, optionId, freeQuantity) > 0
    );
  }

  return true;
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
