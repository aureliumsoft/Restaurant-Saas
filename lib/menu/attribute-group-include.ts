/** Shared Prisma include for recommendation / attribute groups. */
const defaultLinkedMenuItemSelect = {
  id: true,
  name: true,
  price: true,
  salePrice: true,
} as const;

export const attributeGroupInclude = {
  linkedCategory: { select: { id: true, name: true } },
  defaultLinkedMenuItem: { select: defaultLinkedMenuItemSelect },
  defaultLinkedRestaurantVariation: {
    select: { id: true, name: true, shortLabel: true },
  },
  linkedProduct: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      price: true,
      salePrice: true,
      description: true,
      variations: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          id: true,
          name: true,
          title: true,
          imageUrl: true,
          swatchHex: true,
          priceDelta: true,
          sortOrder: true,
          restaurantVariationId: true,
        },
      },
    },
  },
  variationLimits: {
    select: {
      variationId: true,
      minItems: true,
      maxItems: true,
    },
  },
} as const;

export const attributeGroupSelectFields = {
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
  defaultLinkedMenuItemId: true,
  defaultLinkedRestaurantVariationId: true,
  includeDefaultLinkedVariationPrice: true,
  useVariationPricing: true,
} as const;
