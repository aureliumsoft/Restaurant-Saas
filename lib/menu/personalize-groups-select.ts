export const personalizeGroupsSelect = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    parentName: true,
    maxItems: true,
    sortOrder: true,
    options: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        sortOrder: true,
      },
    },
  },
} as const;

/** POS customize lite — never pull option image blobs. */
export const personalizeGroupsSelectLite = {
  orderBy: { sortOrder: 'asc' as const },
  select: {
    id: true,
    parentName: true,
    maxItems: true,
    sortOrder: true,
    options: {
      orderBy: { sortOrder: 'asc' as const },
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    },
  },
} as const;
