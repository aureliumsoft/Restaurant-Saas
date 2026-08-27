/** Shared Prisma select for menu item recommendation groups on the customer menu API. */

import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';

export type CustomerMenuSelectMode = 'full' | 'legacy';

/** Base product / variation select — may include imageUrl for the product being customized. */
const variationSelectFull = {
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

const variationSelectLegacy = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    name: true,
    title: true,
    imageUrl: true,
    swatchHex: true,
    priceDelta: true,
    sortOrder: true,
  },
} as const;

/**
 * Linked recommendation products — never select imageUrl blobs.
 * Thumbs use lazy `/image` proxy URLs after the sheet paints.
 */
const variationSelectLinkedFull = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    name: true,
    title: true,
    swatchHex: true,
    priceDelta: true,
    sortOrder: true,
    restaurantVariationId: true,
    restaurantVariation: {
      select: { id: true, name: true, shortLabel: true },
    },
  },
} as const;

const variationSelectLinkedLegacy = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    name: true,
    title: true,
    swatchHex: true,
    priceDelta: true,
    sortOrder: true,
  },
} as const;

export const customerMenuItemCoreSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  salePrice: true,
  variations: variationSelectFull,
} as const;

export const customerMenuItemCoreSelectLegacy = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  salePrice: true,
  variations: variationSelectLegacy,
} as const;

/** Linked category/product option cards — lightweight, no image blobs. */
export const customerMenuLinkedItemCoreSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  salePrice: true,
  variations: variationSelectLinkedFull,
} as const;

export const customerMenuLinkedItemCoreSelectLegacy = {
  id: true,
  name: true,
  description: true,
  price: true,
  salePrice: true,
  variations: variationSelectLinkedLegacy,
} as const;

function linkedItemCore(mode: CustomerMenuSelectMode) {
  return mode === 'full'
    ? customerMenuLinkedItemCoreSelect
    : customerMenuLinkedItemCoreSelectLegacy;
}

function buildAttributeGroupsSelect(
  depth: number,
  mode: CustomerMenuSelectMode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (depth <= 0) {
    return undefined;
  }

  const linkedCore = linkedItemCore(mode);

  const nestedItemSelect: Record<string, unknown> = {
    ...linkedCore,
    personalizeGroups: personalizeGroupsSelect,
    ...(depth > 1
      ? {
          attributeGroups: buildAttributeGroupsSelect(depth - 1, mode),
        }
      : {}),
  };

  const groupSelect: Record<string, unknown> = {
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
    defaultLinkedRestaurantVariationId: true,
    includeDefaultLinkedVariationPrice: true,
    defaultLinkedRestaurantVariation: {
      select: { id: true, name: true, shortLabel: true },
    },
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
        ...linkedCore,
        categoryId: true,
        personalizeGroups: personalizeGroupsSelect,
        attributeGroups: buildAttributeGroupsSelect(depth - 1, mode),
      },
    },
    variationLimits: {
      select: {
        variationId: true,
        minItems: true,
        maxItems: true,
      },
    },
  };

  if (mode === 'full') {
    groupSelect.useVariationPricing = true;
    groupSelect.includeDefaultLinkedVariationPrice = true;
  }

  return {
    orderBy: { sortOrder: 'asc' as const },
    select: groupSelect,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCustomerMenuAttributeGroupsSelect(depth: number): any {
  return buildAttributeGroupsSelect(depth, 'full');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCustomerMenuAttributeGroupsSelectLegacy(depth: number): any {
  return buildAttributeGroupsSelect(depth, 'legacy');
}

/**
 * POS ?lite=1 recommendations: linked option cards without nested personalize
 * trees (those hydrate when a nested sheet opens).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPosLiteAttributeGroupsSelect(): any {
  const optionCardSelect = {
    id: true,
    name: true,
    description: true,
    price: true,
    salePrice: true,
    variations: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        id: true,
        name: true,
        title: true,
        swatchHex: true,
        priceDelta: true,
        sortOrder: true,
      },
    },
  } as const;

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
      defaultLinkedRestaurantVariationId: true,
      includeDefaultLinkedVariationPrice: true,
      useVariationPricing: true,
      defaultLinkedRestaurantVariation: {
        select: { id: true, name: true, shortLabel: true },
      },
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
            select: optionCardSelect,
          },
        },
      },
      linkedProduct: {
        select: {
          ...optionCardSelect,
          categoryId: true,
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
