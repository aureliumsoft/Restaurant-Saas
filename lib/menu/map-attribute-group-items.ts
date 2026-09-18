type LinkedItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  salePrice: number | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  attributeGroups?: AttributeGroupSource[] | null;
  personalizeGroups?: Array<{
    id: string;
    parentName: string;
    maxItems: number;
    options: Array<{
      id: string;
      name: string;
      imageUrl?: string | null;
    }>;
  }> | null;
  variations?: {
    id: string;
    name?: string;
    title?: string;
    imageUrl?: string | null;
    swatchHex?: string | null;
    priceDelta: number;
    sortOrder?: number;
    restaurantVariationId?: string | null;
  }[];
};

export type AttributeGroupSource = {
  sourceType?: 'CATEGORY' | 'PRODUCT' | null;
  defaultLinkedMenuItemId?: string | null;
  defaultLinkedRestaurantVariationId?: string | null;
  defaultLinkedMenuItem?: {
    id: string;
    name: string;
    price: number;
    salePrice: number | null;
    updatedAt?: string | Date | null;
    createdAt?: string | Date | null;
  } | null;
  linkedCategory?: {
    id: string;
    name: string;
    items?: LinkedItem[] | null;
  } | null;
  linkedProduct?: (LinkedItem & {
    categoryId?: string;
    category?: {
      id: string;
      name: string;
      items?: LinkedItem[] | null;
    } | null;
  }) | null;
};

export function mapAttributeGroupItems(
  group: AttributeGroupSource,
  baseProductId: string
): LinkedItem[] {
  if (group.sourceType === 'PRODUCT' && group.linkedProduct) {
    if (group.linkedProduct.id === baseProductId) return [];
    return [group.linkedProduct];
  }

  const direct = group.linkedCategory?.items ?? [];
  const links =
    (
      group.linkedCategory as
        | { itemLinks?: Array<{ menuItem?: LinkedItem }> }
        | undefined
    )?.itemLinks
      ?.map((l) => l.menuItem)
      .filter((it): it is LinkedItem => Boolean(it)) ?? [];
  const combined: LinkedItem[] = [];
  const seen = new Set<string>();
  for (const it of [...direct, ...links]) {
    if (it && it.id && !seen.has(it.id)) {
      seen.add(it.id);
      combined.push(it);
    }
  }
  const filtered = combined.filter((it) => it.id !== baseProductId);

  // Sort by latest updatedAt first (fallback to createdAt, then name)
  return filtered.sort((a, b) => {
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
  });
}

function linkedCategoryLinkItems(
  group: AttributeGroupSource
): LinkedItem[] {
  return (
    (
      group.linkedCategory as
        | { itemLinks?: Array<{ menuItem?: LinkedItem }> }
        | undefined
    )?.itemLinks
      ?.map((l) => l.menuItem)
      .filter((it): it is LinkedItem => Boolean(it)) ?? []
  );
}

function mergeLinkedItems(items: LinkedItem[]): LinkedItem[] {
  const combined: LinkedItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (it?.id && !seen.has(it.id)) {
      seen.add(it.id);
      combined.push({
        ...it,
        attributeGroups: it.attributeGroups
          ? hydrateLinkedCategoryItems(it.attributeGroups)
          : it.attributeGroups,
      });
    }
  }
  return combined;
}

/** Copy MenuItemCategory links onto linkedCategory.items so sanitize/UI see add-on products. */
export function hydrateLinkedCategoryItems(
  groups: AttributeGroupSource[] | null | undefined
): AttributeGroupSource[] {
  return (groups ?? []).map((group) => {
    const linkedProduct = group.linkedProduct
      ? {
          ...group.linkedProduct,
          attributeGroups: group.linkedProduct.attributeGroups
            ? hydrateLinkedCategoryItems(group.linkedProduct.attributeGroups)
            : group.linkedProduct.attributeGroups,
        }
      : group.linkedProduct;

    if (!group.linkedCategory) {
      return linkedProduct === group.linkedProduct
        ? group
        : { ...group, linkedProduct };
    }

    const items = mergeLinkedItems([
      ...(group.linkedCategory.items ?? []),
      ...linkedCategoryLinkItems(group),
    ]);

    return {
      ...group,
      linkedProduct,
      linkedCategory: {
        ...group.linkedCategory,
        items,
      },
    };
  });
}

export function attributeGroupDisplayName(group: AttributeGroupSource): string | null {
  if (group.sourceType === 'PRODUCT') {
    return (
      group.linkedProduct?.category?.name ??
      group.linkedProduct?.name ??
      null
    );
  }
  return group.linkedCategory?.name ?? null;
}
