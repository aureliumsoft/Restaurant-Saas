import {
  attributeGroupDisplayName,
  mapAttributeGroupItems,
  type AttributeGroupSource,
} from '@/lib/menu/map-attribute-group-items';
import { effectiveMenuItemUnitPrice } from '@/lib/menu/recommendation-addon-price';

import type { AttributeGroup } from '@/components/order/product-customize-dialog';
import type { PersonalizeGroup } from '@/components/order/personalize-options-section';

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
    variationLimits?: {
      variationId: string;
      minItems: number;
      maxItems: number;
    }[];
    useVariationPricing?: boolean;
  },
  baseProductId: string
): AttributeGroup {
  const rawItems =
    group.sourceType === 'PRODUCT' && group.linkedProduct
      ? [group.linkedProduct]
      : (group.linkedCategory?.items ?? []);

  const defaultItem =
    group.sourceType === 'CATEGORY' && group.defaultLinkedMenuItem
      ? group.defaultLinkedMenuItem
      : group.sourceType === 'CATEGORY' && group.defaultLinkedMenuItemId
        ? rawItems.find((r) => r.id === group.defaultLinkedMenuItemId)
        : null;
  const defaultUnitPrice =
    defaultItem && !(group.useVariationPricing ?? false)
      ? effectiveMenuItemUnitPrice(defaultItem.price, defaultItem.salePrice)
      : null;

  const items = mapAttributeGroupItems(group, baseProductId);
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
    items: items.map((it) => {
      const raw = rawItems.find((r) => r.id === it.id);
      const nestedGroups = raw?.attributeGroups ?? [];
      return {
        menuItemId: it.id,
        name: it.name,
        description: it.description ?? null,
        imageUrl: it.imageUrl ?? null,
        price: it.price,
        salePrice: it.salePrice,
        variations: (it.variations ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          title: v.title,
          imageUrl: v.imageUrl ?? null,
          swatchHex: v.swatchHex ?? null,
          priceDelta: v.priceDelta,
          restaurantVariationId: v.restaurantVariationId ?? null,
        })),
        nestedAttributeGroups:
          nestedGroups.length > 0
            ? nestedGroups.map((ng) =>
                buildCustomerAttributeGroup(
                  ng as Parameters<typeof buildCustomerAttributeGroup>[0],
                  it.id
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
