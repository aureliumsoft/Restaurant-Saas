/** Lightweight product select for browse grids (kiosk / online / POS). */

export const menuItemBrowseListSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  salePrice: true,
  categoryId: true,
  updatedAt: true,
  createdAt: true,
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
  attributeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      name: true,
      selectionType: true,
      sourceType: true,
      required: true,
      linkedProduct: { select: { id: true, name: true } },
      linkedCategory: { select: { id: true, name: true } },
      linkedCategoryId: true,
      linkedProductId: true,
      productCategoryIds: true,
    },
  },
  personalizeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      options: { select: { id: true }, take: 1 },
    },
  },
  dealsFromThis: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      sortOrder: true,
      dealItem: {
        select: {
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
        },
      },
    },
  },
} as const;

/** Same browse grid without deal joins (stale Prisma clients omit MenuItemDeal). */
export const menuItemBrowseListSelectLegacy = {
  id: true,
  name: true,
  description: true,
  price: true,
  salePrice: true,
  categoryId: true,
  updatedAt: true,
  createdAt: true,
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
  attributeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      name: true,
      selectionType: true,
      sourceType: true,
      required: true,
      linkedProduct: { select: { id: true, name: true } },
      linkedCategory: { select: { id: true, name: true } },
      linkedCategoryId: true,
      linkedProductId: true,
      productCategoryIds: true,
    },
  },
  personalizeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      options: { select: { id: true }, take: 1 },
    },
  },
} as const;

/**
 * POS catalog: enough for grid + customize-gate + progressive variation picker.
 * Skips unused join fields on attribute groups.
 */
export const menuItemPosCatalogSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  salePrice: true,
  categoryId: true,
  updatedAt: true,
  createdAt: true,
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
  attributeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      sourceType: true,
      required: true,
    },
  },
  personalizeGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      options: { select: { id: true }, take: 1 },
    },
  },
  dealsFromThis: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      sortOrder: true,
      dealItem: {
        select: {
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
        },
      },
    },
  },
} as const;
