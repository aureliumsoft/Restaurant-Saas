import {
  attributeGroupDisplayName,
  mapAttributeGroupItems,
  type AttributeGroupSource,
} from '@/lib/menu/map-attribute-group-items';
import {
  configurationItemListUnitPriceForDefaultLinked,
  filterConfigurationItemsForDefaultLinkedVariation,
} from '@/lib/menu/configuration-variation-price';
import { effectiveMenuItemUnitPrice } from '@/lib/menu/recommendation-addon-price';

import type { AttributeGroup } from '@/components/order/product-customize-dialog';
import type { PersonalizeGroup } from '@/components/order/personalize-options-section';

export type AttributeGroupImageUrlBuilder = (menuItemId: string) => string;

export function buildCustomerAttributeGroup(
  group: AttributeGroupSource & {
    id: string;
    name: string;
    selectionType: 'SINGLE' | 'MULTIPLE';
    multipleMode?: 'CHECKBOX' | 'QUANTITY' | null;
    freeQuantity?: number | null;
    categoryDiscountPercent?: number | null;
    categoryExtraCostPercent?: number | null;
    productOverrides?: Record<string, { excluded?: boolean; free?: boolean }> | null;
    required: boolean;
    minItems: number | null;
    maxItems: number | null;
    defaultLinkedMenuItemId?: string | null;
    defaultLinkedRestaurantVariationId?: string | null;
    defaultLinkedRestaurantVariation?: {
      id: string;
      name: string;
      shortLabel?: string | null;
    } | null;
    includeDefaultLinkedVariationPrice?: boolean;
    variationLimits?: {
      variationId: string;
      minItems: number;
      maxItems: number;
    }[];
    useVariationPricing?: boolean;
  },
  baseProductId: string,
  /** Lazy image proxy for recommendation option thumbs (no embedded base64). */
  imageUrlForItem?: AttributeGroupImageUrlBuilder
): AttributeGroup {
  const directItems = group.linkedCategory?.items ?? [];
  const linkItems =
    (
      group.linkedCategory as
        | { itemLinks?: Array<{ menuItem?: (typeof directItems)[number] }> }
        | undefined
    )?.itemLinks
      ?.map((l) => l.menuItem)
      .filter(Boolean) ?? [];

  const mergedCategoryItems: typeof directItems = [];
  const seenIds = new Set<string>();
  for (const it of [...directItems, ...linkItems]) {
    if (it && it.id && !seenIds.has(it.id)) {
      seenIds.add(it.id);
      mergedCategoryItems.push(it);
    }
  }

  const rawItems =
    group.sourceType === 'PRODUCT' && group.linkedProduct
      ? [group.linkedProduct]
      : mergedCategoryItems;
  const productOverrides = group.productOverrides ?? {};
  const visibleRawItems = rawItems.filter(
    (item) => !productOverrides[item.id]?.excluded
  );

  const defaultRestaurantVariationId =
    group.defaultLinkedRestaurantVariationId ??
    group.defaultLinkedRestaurantVariation?.id ??
    null;
  const includeDefaultLinkedVariationPrice =
    group.includeDefaultLinkedVariationPrice ?? true;

  const defaultItem =
    group.sourceType === 'CATEGORY' && group.defaultLinkedMenuItem
      ? productOverrides[group.defaultLinkedMenuItem.id]?.excluded
        ? null
        : group.defaultLinkedMenuItem
      : group.sourceType === 'CATEGORY' && group.defaultLinkedMenuItemId
        ? visibleRawItems.find((r) => r.id === group.defaultLinkedMenuItemId)
        : null;
  const defaultUnitPrice =
    defaultItem && !(group.useVariationPricing ?? false)
      ? defaultRestaurantVariationId
        ? configurationItemListUnitPriceForDefaultLinked(
            defaultItem,
            defaultRestaurantVariationId,
            includeDefaultLinkedVariationPrice
          )
        : effectiveMenuItemUnitPrice(defaultItem.price, defaultItem.salePrice)
      : null;

  const mappedItems = mapAttributeGroupItems(
    group.sourceType === 'CATEGORY' && group.linkedCategory
      ? {
          ...group,
          linkedCategory: {
            ...group.linkedCategory,
            items: visibleRawItems,
          },
        }
      : group,
    baseProductId
  );
  const items =
    defaultRestaurantVariationId && !(group.useVariationPricing ?? false)
      ? filterConfigurationItemsForDefaultLinkedVariation(
          mappedItems,
          defaultRestaurantVariationId
        )
      : mappedItems;
  return {
    id: group.id,
    name: group.name?.trim() || attributeGroupDisplayName(group) || 'Option',
    selectionType: group.selectionType,
    multipleMode: group.multipleMode ?? undefined,
    freeQuantity: group.freeQuantity,
    categoryDiscountPercent: group.categoryDiscountPercent ?? null,
    categoryExtraCostPercent: group.categoryExtraCostPercent ?? null,
    required: group.required,
    minItems: group.minItems,
    maxItems: group.maxItems,
    variationLimits: group.variationLimits,
    linkedCategoryName: attributeGroupDisplayName(group),
    sourceType: group.sourceType ?? 'CATEGORY',
    defaultMenuItemId: defaultItem?.id ?? group.defaultLinkedMenuItemId ?? null,
    defaultUnitPrice,
    useVariationPricing: group.useVariationPricing ?? false,
    defaultLinkedRestaurantVariationId: defaultRestaurantVariationId,
    includeDefaultLinkedVariationPrice,
    items: items
      .map((it) => {
        const raw = rawItems.find((r) => r.id === it.id);
        const nestedGroups = raw?.attributeGroups ?? [];
        const lazyImage =
          imageUrlForItem?.(it.id) ??
          (it.imageUrl && !it.imageUrl.startsWith('data:')
            ? it.imageUrl
            : null);
        return {
          menuItemId: it.id,
          name: it.name,
          description: it.description ?? null,
          imageUrl: lazyImage,
          price: productOverrides[it.id]?.free ? 0 : it.price,
          salePrice: productOverrides[it.id]?.free ? null : it.salePrice,
          updatedAt: it.updatedAt ?? raw?.updatedAt ?? null,
          createdAt: it.createdAt ?? raw?.createdAt ?? null,
          variations: (it.variations ?? []).map((v) => ({
            id: v.id,
            name: v.name,
            title: v.title,
            // Variation thumbs reuse the product lazy URL (no per-variation blob).
            imageUrl: lazyImage,
            swatchHex: v.swatchHex ?? null,
            priceDelta: productOverrides[it.id]?.free ? 0 : v.priceDelta,
            restaurantVariationId: v.restaurantVariationId ?? null,
          })),
          nestedAttributeGroups:
            nestedGroups.length > 0
              ? nestedGroups.map((ng) =>
                  buildCustomerAttributeGroup(
                    ng as Parameters<typeof buildCustomerAttributeGroup>[0],
                    it.id,
                    imageUrlForItem
                  )
                )
              : undefined,
          personalizeGroups:
            (raw as { personalizeGroups?: PersonalizeGroup[] } | undefined)
              ?.personalizeGroups ?? undefined,
        };
      })
      .sort((a, b) => {
        const timeA = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;
        const timeB = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;
        if (timeB !== timeA) return timeB - timeA;
        return a.name.localeCompare(b.name);
      }),
  };
}
