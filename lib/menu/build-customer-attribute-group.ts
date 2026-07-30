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
  const rawItems =
    group.sourceType === 'PRODUCT' && group.linkedProduct
      ? [group.linkedProduct]
      : (group.linkedCategory?.items ?? []);

  const defaultRestaurantVariationId =
    group.defaultLinkedRestaurantVariationId ??
    group.defaultLinkedRestaurantVariation?.id ??
    null;
  const includeDefaultLinkedVariationPrice =
    group.includeDefaultLinkedVariationPrice ?? true;

  const defaultItem =
    group.sourceType === 'CATEGORY' && group.defaultLinkedMenuItem
      ? group.defaultLinkedMenuItem
      : group.sourceType === 'CATEGORY' && group.defaultLinkedMenuItemId
        ? rawItems.find((r) => r.id === group.defaultLinkedMenuItemId)
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

  const mappedItems = mapAttributeGroupItems(group, baseProductId);
  const items =
    defaultRestaurantVariationId && !(group.useVariationPricing ?? false)
      ? filterConfigurationItemsForDefaultLinkedVariation(
          mappedItems,
          defaultRestaurantVariationId
        )
      : mappedItems;
  return {
    id: group.id,
    name: group.name,
    selectionType: group.selectionType,
    multipleMode: group.multipleMode ?? undefined,
    freeQuantity: group.freeQuantity,
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
    items: items.map((it) => {
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
        price: it.price,
        salePrice: it.salePrice,
        variations: (it.variations ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          title: v.title,
          // Variation thumbs reuse the product lazy URL (no per-variation blob).
          imageUrl: lazyImage,
          swatchHex: v.swatchHex ?? null,
          priceDelta: v.priceDelta,
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
    }),
  };
}
