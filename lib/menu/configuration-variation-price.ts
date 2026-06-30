import {
  effectiveMenuItemUnitPrice,
  productUnitPriceWithVariation,
} from '@/lib/menu/recommendation-addon-price';
import {
  shouldShowOptionQuantityPrice,
  shouldShowQuantityGroupPickerPrices,
} from '@/lib/menu/recommendation-limits';
import { formatAddonDelta } from '@/lib/format-money';
import type { RestaurantRegionalSettings } from '@/lib/restaurant-regional';

export type VariationLinkRef = {
  id: string;
  name?: string | null;
  title?: string | null;
  restaurantVariationId?: string | null;
  priceDelta: number;
};

export type ParentVariationContext = {
  id: string;
  name?: string | null;
  title?: string | null;
  restaurantVariationId?: string | null;
};

function normalizeVariationKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Build parent variation context from a menu item's selected variation id. */
export function parentVariationFromItemVariation(
  itemVariations: VariationLinkRef[] | null | undefined,
  variationId: string | null | undefined
): ParentVariationContext | null {
  if (!variationId) return null;
  const v = itemVariations?.find((x) => x.id === variationId);
  if (!v) return null;
  return {
    id: v.id,
    name: v.name ?? null,
    title: v.title ?? null,
    restaurantVariationId: v.restaurantVariationId ?? null,
  };
}

/** Match an item variation to the guest's selected base-product variation. */
export function matchItemVariationForParent(
  parent: ParentVariationContext | null | undefined,
  itemVariations: VariationLinkRef[]
): VariationLinkRef | null {
  if (!parent || itemVariations.length === 0) return null;

  if (parent.restaurantVariationId) {
    const byTemplate = itemVariations.find(
      (v) => v.restaurantVariationId === parent.restaurantVariationId
    );
    if (byTemplate) return byTemplate;
  }

  const parentKeys = new Set(
    [parent.name, parent.title]
      .map(normalizeVariationKey)
      .filter((k) => k.length > 0)
  );
  if (parentKeys.size === 0) return null;

  return (
    itemVariations.find((v) => {
      const keys = [v.name, v.title]
        .map(normalizeVariationKey)
        .filter((k) => k.length > 0);
      return keys.some((k) => parentKeys.has(k));
    }) ?? null
  );
}

export type ConfigurationItemLike = {
  price: number;
  salePrice: number | null;
  variations?: VariationLinkRef[];
};

/** Whether this add-on is offered for the guest's selected base-product variation. */
export function isConfigurationItemAvailableForParentVariation(
  item: ConfigurationItemLike,
  parentVariation: ParentVariationContext | null | undefined,
  useVariationPricing: boolean
): boolean {
  if (!useVariationPricing) return true;
  if (!parentVariation) return false;
  return (
    matchItemVariationForParent(parentVariation, item.variations ?? []) !=
    null
  );
}

/** Hide add-ons with no rate linked for the current product variation. */
export function filterConfigurationItemsForParentVariation<
  T extends ConfigurationItemLike,
>(items: T[], parentVariation: ParentVariationContext | null | undefined, useVariationPricing: boolean): T[] {
  if (!useVariationPricing) return items;
  if (!parentVariation) return [];
  return items.filter((item) =>
    isConfigurationItemAvailableForParentVariation(
      item,
      parentVariation,
      true
    )
  );
}

/** Whether a configuration section should render (category row / nested group). */
export function isConfigurationGroupVisibleForParentVariation(
  group: { items: ConfigurationItemLike[]; useVariationPricing?: boolean },
  parentVariation: ParentVariationContext | null | undefined
): boolean {
  return configurationGroupHasItemsForParentVariation(group, parentVariation);
}

/** Whether a variation-priced group has at least one add-on for the current parent variation. */
export function configurationGroupHasItemsForParentVariation(
  group: { items: ConfigurationItemLike[]; useVariationPricing?: boolean },
  parentVariation: ParentVariationContext | null | undefined
): boolean {
  const useVariationPricing = group.useVariationPricing ?? false;
  if (!useVariationPricing) return group.items.length > 0;
  if (!parentVariation) return false;
  return (
    filterConfigurationItemsForParentVariation(
      group.items,
      parentVariation,
      true
    ).length > 0
  );
}

/** List unit price for a configuration item (variation rate or original item price). */
export function configurationItemListUnitPrice(
  item: ConfigurationItemLike,
  parentVariation: ParentVariationContext | null | undefined,
  useVariationPricing: boolean
): number {
  const original = effectiveMenuItemUnitPrice(item.price, item.salePrice);
  if (!useVariationPricing) return original;

  const matched = matchItemVariationForParent(
    parentVariation,
    item.variations ?? []
  );
  if (matched) return matched.priceDelta;
  return original;
}

/** Header suffix when configuration prices follow variation (e.g. "Gratinage M"). */
export function configurationGroupVariationSuffix(
  parentVariation: ParentVariationContext | null | undefined,
  restaurantVariationShortLabel?: string | null
): string | null {
  if (!parentVariation) return null;
  const short =
    restaurantVariationShortLabel?.trim() ||
    parentVariation.title?.trim() ||
    parentVariation.name?.trim();
  if (!short) return null;
  return short;
}

export function configurationGroupDisplayTitle(
  baseName: string,
  parentVariation: ParentVariationContext | null | undefined,
  useVariationPricing: boolean,
  restaurantVariationShortLabel?: string | null
): string {
  if (!useVariationPricing) return baseName;
  const suffix = configurationGroupVariationSuffix(
    parentVariation,
    restaurantVariationShortLabel
  );
  if (!suffix) return baseName;
  return `${baseName} ${suffix}`;
}

type ConfigurationDefaultListUnitInput = {
  defaultMenuItemId?: string | null;
  defaultUnitPrice?: number | null;
  useVariationPricing?: boolean;
  items: Array<ConfigurationItemLike & { menuItemId?: string }>;
};

/** Resolved list unit for the group's default add-on (explicit default or static fallback). */
export function configurationDefaultListUnitPrice(
  group: ConfigurationDefaultListUnitInput,
  parentVariation: ParentVariationContext | null | undefined,
  visibleItems?: Array<ConfigurationItemLike & { menuItemId?: string }>
): number | null {
  const visible =
    visibleItems ??
    filterConfigurationItemsForParentVariation(
      group.items,
      parentVariation,
      group.useVariationPricing ?? false
    );
  if (group.defaultMenuItemId) {
    const defaultItem = visible.find(
      (i) => i.menuItemId === group.defaultMenuItemId
    );
    if (defaultItem) {
      return configurationItemListUnitPrice(
        defaultItem,
        parentVariation,
        group.useVariationPricing ?? false
      );
    }
  }
  return group.defaultUnitPrice ?? null;
}

function parallelVariationOnItem(
  item: ConfigurationItemLike & { variations?: VariationLinkRef[] },
  source: VariationLinkRef
): VariationLinkRef | null {
  const variations = item.variations ?? [];
  if (source.restaurantVariationId) {
    const match = variations.find(
      (v) => v.restaurantVariationId === source.restaurantVariationId
    );
    if (match) return match;
  }
  const sourceKeys = new Set(
    [source.name, source.title]
      .map(normalizeVariationKey)
      .filter((k) => k.length > 0)
  );
  return (
    variations.find((v) => {
      const keys = [v.name, v.title]
        .map(normalizeVariationKey)
        .filter((k) => k.length > 0);
      return keys.some((k) => sourceKeys.has(k));
    }) ?? null
  );
}

/** List unit for an add-on, including a manually selected nested variation when applicable. */
export function configurationItemResolvedListUnit(
  item: ConfigurationItemLike & { variations?: VariationLinkRef[] },
  parentVariation: ParentVariationContext | null | undefined,
  useVariationPricing: boolean,
  selectedNestedVariationId?: string | null
): number {
  const base = configurationItemListUnitPrice(
    item,
    parentVariation,
    useVariationPricing
  );
  if (useVariationPricing || !selectedNestedVariationId) return base;
  const v = (item.variations ?? []).find((x) => x.id === selectedNestedVariationId);
  if (!v) return base;
  return productUnitPriceWithVariation(base, v.priceDelta, item.variations);
}

/**
 * Default-item baseline for delta pricing, aligned to the guest's nested variation
 * (e.g. 7 Up Medium vs default Pepsi Medium at the same tier).
 */
export function configurationDefaultListUnitPriceForSelection(
  group: ConfigurationDefaultListUnitInput,
  parentVariation: ParentVariationContext | null | undefined,
  visibleItems: Array<
    ConfigurationItemLike & { menuItemId?: string; variations?: VariationLinkRef[] }
  >,
  selectedNestedVariation?: VariationLinkRef | null
): number | null {
  if (!group.defaultMenuItemId) return group.defaultUnitPrice ?? null;
  const defaultItem = visibleItems.find(
    (i) => i.menuItemId === group.defaultMenuItemId
  );
  if (!defaultItem) return group.defaultUnitPrice ?? null;

  let defaultNestedVariationId: string | null = null;
  if (selectedNestedVariation && !(group.useVariationPricing ?? false)) {
    defaultNestedVariationId =
      parallelVariationOnItem(defaultItem, selectedNestedVariation)?.id ?? null;
  }

  return configurationItemResolvedListUnit(
    defaultItem,
    parentVariation,
    group.useVariationPricing ?? false,
    defaultNestedVariationId
  );
}

/** Chargeable addon unit after default-item delta (uses resolved list unit). */
export function chargeableConfigurationItemUnitPrice(
  resolvedListUnit: number,
  defaultUnitPrice: number | null | undefined
): number {
  if (defaultUnitPrice == null) return resolvedListUnit;
  return Math.max(
    0,
    Math.round((resolvedListUnit - defaultUnitPrice) * 100) / 100
  );
}

/** Guest-facing addon delta/full label for configuration pickers. */
export function formatConfigurationAddonDisplay(
  resolvedListUnit: number,
  defaultUnitPrice: number | null | undefined,
  regional?: Partial<RestaurantRegionalSettings>
): string | null {
  if (defaultUnitPrice != null) {
    const delta = Math.round((resolvedListUnit - defaultUnitPrice) * 100) / 100;
    if (delta <= 0) return null;
    return formatAddonDelta(delta, regional);
  }
  return formatAddonDelta(resolvedListUnit, regional);
}

/** Guest-facing addon label for configuration pickers (quantity + free tier). */
export function configurationAddonPriceLabel(
  resolvedListUnit: number,
  defaultUnitPrice: number | null | undefined,
  options?: {
    freeQuantity?: number | null;
    multipleMode?: 'CHECKBOX' | 'QUANTITY' | null;
    /** All selected option ids in the group (with duplicates for qty). */
    groupSelectedIds?: string[];
    /** When set, free tier is allocated across the whole group in selection order. */
    optionId?: string;
    regional?: Partial<RestaurantRegionalSettings>;
    /** @deprecated use regional */
    currencySymbol?: string;
  }
): string | null {
  if (options?.multipleMode === 'QUANTITY') {
    const groupSelectedIds = options.groupSelectedIds ?? [];
    const show =
      options.optionId != null
        ? shouldShowOptionQuantityPrice(
            groupSelectedIds,
            options.optionId,
            options.freeQuantity
          )
        : shouldShowQuantityGroupPickerPrices(
            groupSelectedIds,
            options.freeQuantity
          );
    if (!show) return null;
  }
  return formatConfigurationAddonDisplay(
    resolvedListUnit,
    defaultUnitPrice,
    options?.regional ??
      (options?.currencySymbol
        ? { currencyCode: options.currencySymbol as 'EUR' }
        : undefined)
  );
}
