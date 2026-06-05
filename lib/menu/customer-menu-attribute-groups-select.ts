/** Shared Prisma select for menu item recommendation groups on the customer menu API. */

const variationSelect = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    name: true,
    title: true,
    imageUrl: true,
    swatchHex: true,
    priceDelta: true,
    sortOrder: true,
    restaurantVariationId: true,
    restaurantVariation: {
      select: { id: true, name: true, shortLabel: true },
    },
  },
} as const;

export const customerMenuItemCoreSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  salePrice: true,
  variations: variationSelect,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCustomerMenuAttributeGroupsSelect(depth: number): any {
  if (depth <= 0) {
    return undefined;
  }

  const nestedItemSelect: Record<string, unknown> = {
    ...customerMenuItemCoreSelect,
    ...(depth > 1
      ? {
          attributeGroups: buildCustomerMenuAttributeGroupsSelect(depth - 1),
        }
      : {}),
  };

  return {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      name: true,
      selectionType: true,
      sourceType: true,
      multipleMode: true,
      freeQuantity: true,
      required: true,
      minItems: true,
      maxItems: true,
      sortOrder: true,
      productCategoryIds: true,
      defaultLinkedMenuItemId: true,
      useVariationPricing: true,
      defaultLinkedMenuItem: {
        select: {
          id: true,
          name: true,
          price: true,
          salePrice: true,
        },
      },
      linkedCategory: {
        select: {
          id: true,
          name: true,
          items: {
            orderBy: { name: 'asc' as const },
            select: nestedItemSelect,
          },
        },
      },
      linkedProduct: {
        select: {
          ...customerMenuItemCoreSelect,
          categoryId: true,
          attributeGroups: buildCustomerMenuAttributeGroupsSelect(depth - 1),
        },
      },
      variationLimits: {
        select: {
          variationId: true,
          minItems: true,
          maxItems: true,
        },
      },
    },
  };
}
