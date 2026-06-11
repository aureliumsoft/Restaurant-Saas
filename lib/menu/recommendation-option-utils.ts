import {
  matchItemVariationForParent,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import { hasPersonalizeOptions } from '@/lib/menu/personalize-options';

export type OptionConfigGroup = { useVariationPricing?: boolean };

export type OptionConfigContext = {
  group?: OptionConfigGroup;
  parentVariation?: ParentVariationContext | null;
};

type OptionItemLike = {
  menuItemId?: string;
  variations?: Array<{
    id: string;
    name?: string | null;
    title?: string | null;
    restaurantVariationId?: string | null;
    priceDelta: number;
  }> | null;
  nestedAttributeGroups?: unknown[] | null;
};

/** Category uses parent product variation for item rates (no manual item variation). */
export function categoryItemUsesParentVariation(
  group: OptionConfigGroup | undefined
): boolean {
  return group?.useVariationPricing ?? false;
}

/** Matched add-on variation id when group prices by parent variation. */
export function resolveCategoryItemVariationId(
  item: OptionItemLike,
  parentVariation: ParentVariationContext | null | undefined,
  group: OptionConfigGroup | undefined
): string | null {
  if (!categoryItemUsesParentVariation(group)) return null;
  const matched = matchItemVariationForParent(
    parentVariation,
    item.variations ?? []
  );
  return matched?.id ?? null;
}

export function optionNeedsManualVariationPicker(
  item: { variations?: unknown[] | null },
  group: OptionConfigGroup | undefined
): boolean {
  return (
    (item.variations?.length ?? 0) > 0 &&
    !categoryItemUsesParentVariation(group)
  );
}

/** Resolved variation id for a linked product recommendation selection. */
export function resolveProductRecommendationVariationId(
  item: OptionItemLike,
  group: OptionConfigGroup | undefined,
  options: {
    configProductVariationId?: string | null;
    preselectedVariationId?: string | null;
    parentVariation?: ParentVariationContext | null;
  }
): string | null {
  const fromConfig =
    options.configProductVariationId &&
    options.configProductVariationId.length > 0
      ? options.configProductVariationId
      : null;
  const fromPreselect = options.preselectedVariationId || null;
  if (optionNeedsManualVariationPicker(item, group)) {
    return fromConfig || fromPreselect;
  }
  return (
    fromConfig ||
    resolveCategoryItemVariationId(item, options.parentVariation, group) ||
    fromPreselect
  );
}

/** Linked product configuration group needs variation picker and/or nested sheet. */
export function recommendedProductNeedsSheet(group: {
  required?: boolean;
  useVariationPricing?: boolean;
  items: Array<{
    variations?: unknown[] | null;
    nestedAttributeGroups?: unknown[] | null;
    personalizeGroups?: Array<{ options?: unknown[] }> | null;
  }>;
}): boolean {
  const item = group.items[0];
  if (!item) return false;
  if (optionNeedsManualVariationPicker(item, group)) return true;
  if ((item.nestedAttributeGroups?.length ?? 0) > 0) return true;
  if (hasPersonalizeOptions(item)) return true;
  // Always surface linked products in the nested sheet (required or optional).
  return true;
}

/** Category option needs nested sheet and/or manual variation picker. */
export function recommendationOptionNeedsSheet(
  item: {
    variations?: unknown[] | null;
    nestedAttributeGroups?: unknown[] | null;
    personalizeGroups?: Array<{ options?: unknown[] }> | null;
  },
  group?: OptionConfigGroup
): boolean {
  return (
    optionNeedsManualVariationPicker(item, group) ||
    (item.nestedAttributeGroups?.length ?? 0) > 0 ||
    hasPersonalizeOptions(item)
  );
}

/** Resolved variation id (parent-matched or guest-selected). */
export function effectiveOptionVariationId(
  item: OptionItemLike,
  key: string,
  selectedNestedVariationByOption: Record<string, string>,
  optionNestedConfigs: Record<string, unknown>,
  context?: OptionConfigContext
): string | undefined {
  const fromParent = resolveCategoryItemVariationId(
    item,
    context?.parentVariation,
    context?.group
  );
  if (fromParent) return fromParent;
  return (
    selectedNestedVariationByOption[key] ??
    (
      optionNestedConfigs[key] as { productVariationId?: string } | undefined
    )?.productVariationId ??
    undefined
  );
}

export function optionSelectionKey(groupId: string, optionId: string) {
  return `${groupId}:${optionId}`;
}

/** True when saved nested config includes at least one category selection or mod. */
export function hasNestedOptionConfigContent(
  config: {
    selectedByGroup?: Record<string, string[]>;
    mods?: unknown[];
  } | null
  | undefined
): boolean {
  if (!config) return false;
  const hasSelections = Object.values(config.selectedByGroup ?? {}).some(
    (ids) => (ids?.length ?? 0) > 0
  );
  if (hasSelections) return true;
  return (config.mods?.length ?? 0) > 0;
}

/** Remove all per-option nested/variation state for a category group. */
export function clearOptionDataForGroup<T extends Record<string, unknown>>(
  groupId: string,
  configs: T,
  variations: Record<string, string>
): { configs: T; variations: Record<string, string> } {
  const prefix = `${groupId}:`;
  const nextConfigs = { ...configs };
  const nextVariations = { ...variations };
  for (const k of Object.keys(nextConfigs)) {
    if (k.startsWith(prefix)) delete nextConfigs[k];
  }
  for (const k of Object.keys(nextVariations)) {
    if (k.startsWith(prefix)) delete nextVariations[k];
  }
  return { configs: nextConfigs, variations: nextVariations };
}

export function clearOptionDataForKey<T extends Record<string, unknown>>(
  key: string,
  configs: T,
  variations: Record<string, string>
): { configs: T; variations: Record<string, string> } {
  const nextConfigs = { ...configs };
  const nextVariations = { ...variations };
  delete nextConfigs[key];
  delete nextVariations[key];
  return { configs: nextConfigs, variations: nextVariations };
}

export function isOptionConfigComplete(
  item: OptionItemLike,
  key: string,
  selectedNestedVariationByOption: Record<string, string>,
  optionNestedConfigs: Record<string, unknown>,
  context?: OptionConfigContext
): boolean {
  const hasNested = (item.nestedAttributeGroups?.length ?? 0) > 0;
  const usesParentVar = categoryItemUsesParentVariation(context?.group);
  const hasManualVar = optionNeedsManualVariationPicker(item, context?.group);
  if (!hasManualVar && !hasNested) return true;

  const config = optionNestedConfigs[key] as
    | {
        productVariationId?: string;
        selectedByGroup?: Record<string, string[]>;
        mods?: unknown[];
      }
    | undefined;

  if (usesParentVar && (item.variations?.length ?? 0) > 0) {
    if (!context?.parentVariation) return false;
    if (!resolveCategoryItemVariationId(item, context.parentVariation, context.group)) {
      return false;
    }
  } else if (hasManualVar) {
    const variationId = effectiveOptionVariationId(
      item,
      key,
      selectedNestedVariationByOption,
      optionNestedConfigs,
      context
    );
    if (!config) {
      if (!variationId) return false;
    } else if (!variationId && !config.productVariationId) {
      return false;
    }
  }

  if (!hasNested) return true;
  if (!config) return false;
  return hasNestedOptionConfigContent(config);
}

export function shouldAutoOpenOptionFlow(
  item: OptionItemLike,
  key: string,
  selectedNestedVariationByOption: Record<string, string>,
  optionNestedConfigs: Record<string, unknown>,
  context?: OptionConfigContext
): boolean {
  return (
    recommendationOptionNeedsSheet(item, context?.group) &&
    !isOptionConfigComplete(
      item,
      key,
      selectedNestedVariationByOption,
      optionNestedConfigs,
      context
    )
  );
}

/** Apply parent-matched variation ids for selected options in variation-priced groups. */
export function syncParentVariationOptionSelections(
  groups: Array<{
    id: string;
    useVariationPricing?: boolean;
    items: OptionItemLike[];
  }>,
  selectedByGroup: Record<string, string[]>,
  parentVariation: ParentVariationContext | null | undefined,
  prev: Record<string, string>
): Record<string, string> | null {
  let changed = false;
  const next = { ...prev };

  const walk = (
    list: Array<{
      id: string;
      useVariationPricing?: boolean;
      items: OptionItemLike[];
    }>
  ) => {
    for (const g of list) {
      if (!categoryItemUsesParentVariation(g)) continue;
      const ids = selectedByGroup[g.id] ?? [];
      for (const optionId of new Set(ids)) {
        const item = g.items.find((it) => it.menuItemId === optionId);
        if (!item) continue;
        const key = optionSelectionKey(g.id, optionId);
        const resolved = resolveCategoryItemVariationId(
          item,
          parentVariation,
          g
        );
        if (resolved) {
          if (next[key] !== resolved) {
            next[key] = resolved;
            changed = true;
          }
        } else if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      for (const it of g.items) {
        const nested = it.nestedAttributeGroups as
          | Array<{
              id: string;
              useVariationPricing?: boolean;
              items: OptionItemLike[];
            }>
          | undefined;
        if (nested?.length) walk(nested);
      }
    }
  };

  walk(groups);
  return changed ? next : null;
}

export function emptyOptionNestedConfig(): {
  productVariationId: string;
  selectedByGroup: Record<string, string[]>;
  selectedNestedVariationByOption: Record<string, string>;
  mods: [];
} {
  return {
    productVariationId: '',
    selectedByGroup: {},
    selectedNestedVariationByOption: {},
    mods: [],
  };
}
