/** Lightweight product select for browse grids (kiosk / online / POS). */

export const menuItemBrowseListSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  salePrice: true,
  categoryId: true,
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
      linkedProduct: { select: { id: true } },
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
