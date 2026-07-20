import type { AttributeGroupSource } from '@/lib/menu/map-attribute-group-items';

export type MenuItemLike = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  salePrice?: number | null;
  attributeGroups?: AttributeGroupLike[] | null;
  variations?: {
    id: string;
    name?: string;
    title?: string;
    imageUrl?: string | null;
    swatchHex?: string | null;
    priceDelta: number;
    sortOrder?: number;
  }[];
};

export type CategoryLike = {
  id: string;
  name: string;
  items?: MenuItemLike[] | null;
};

export type AttributeGroupLike = AttributeGroupSource & {
  productCategoryIds?: string[] | null;
};

export function findMenuItemInCategories(
  itemId: string,
  allCategories: CategoryLike[]
): MenuItemLike | undefined {
  for (const cat of allCategories) {
    const found = cat.items?.find((i) => i.id === itemId);
    if (found) return found;
  }
  return undefined;
}

/** Attach nested recommendation groups to the anchor product (no category pooling). */
export function enrichAttributeGroupSource(
  group: AttributeGroupLike,
  allCategories: CategoryLike[],
  baseProductId: string
): AttributeGroupLike {
  if (group.sourceType !== 'PRODUCT' || !group.linkedProduct) {
    return group;
  }

  const catalogItem = findMenuItemInCategories(
    group.linkedProduct.id,
    allCategories
  );

  const anchor: MenuItemLike = catalogItem
    ? { ...group.linkedProduct, ...catalogItem }
    : group.linkedProduct;

  if (anchor.id === baseProductId) {
    return group;
  }

  return {
    ...group,
    linkedProduct: {
      ...anchor,
      description: anchor.description ?? null,
      imageUrl: anchor.imageUrl ?? null,
      category: undefined,
      attributeGroups: (anchor.attributeGroups ?? []).map((nested) =>
        enrichCategoryLinkedItems(nested, allCategories, anchor.id)
      ),
    } as AttributeGroupLike['linkedProduct'],
  };
}

/** Replace linkedCategory.items with the full category pool (includes MenuItemCategory links). */
export function enrichCategoryLinkedItems(
  group: AttributeGroupLike,
  allCategories: CategoryLike[],
  baseProductId: string
): AttributeGroupLike {
  if (group.sourceType !== 'CATEGORY' || !group.linkedCategory?.id) {
    return group;
  }

  const poolCategory = allCategories.find(
    (c) => c.id === group.linkedCategory!.id
  );
  if (!poolCategory?.items?.length) {
    return group;
  }

  return {
    ...group,
    linkedCategory: {
      ...group.linkedCategory,
      items: poolCategory.items.map((poolItem) => ({
        ...poolItem,
        imageUrl: poolItem.imageUrl ?? null,
        salePrice: poolItem.salePrice ?? null,
        attributeGroups: (poolItem.attributeGroups ?? []).map((nested) =>
          enrichCategoryLinkedItems(nested, allCategories, baseProductId)
        ),
      })) as NonNullable<AttributeGroupSource['linkedCategory']>['items'],
    },
  };
}

/** Enrich a recommendation group from the restaurant category product pool. */
export function enrichAttributeGroupFromPool(
  group: AttributeGroupLike,
  allCategories: CategoryLike[],
  baseProductId: string
): AttributeGroupLike {
  if (group.sourceType === 'PRODUCT') {
    return enrichAttributeGroupSource(group, allCategories, baseProductId);
  }
  return enrichCategoryLinkedItems(group, allCategories, baseProductId);
}

function enrichAttributeGroupsOnMenuItem(
  item: MenuItemLike,
  allCategories: CategoryLike[]
): MenuItemLike {
  return {
    ...item,
    attributeGroups: (item.attributeGroups ?? []).map((group) =>
      enrichAttributeGroupFromPool(group, allCategories, item.id)
    ),
  };
}

/** Enrich all attribute groups on menu items in storefront categories. */
export function enrichMenuItemsAttributeGroupsFromPool<
  T extends { id: string; attributeGroups?: AttributeGroupLike[] | null },
>(items: T[], allCategories: CategoryLike[]): T[] {
  return items.map((item) => ({
    ...item,
    attributeGroups: (item.attributeGroups ?? []).map((group) =>
      enrichAttributeGroupFromPool(group, allCategories, item.id)
    ),
  }));
}
