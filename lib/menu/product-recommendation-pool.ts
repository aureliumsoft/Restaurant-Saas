import type { AttributeGroupSource } from '@/lib/menu/map-attribute-group-items';

export type MenuItemLike = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  salePrice?: number | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
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

/** Category→product→category loops used to recurse until the stack overflowed. */
const MAX_ENRICH_DEPTH = 2;

function groupVisitKey(group: AttributeGroupLike): string | null {
  if (group.sourceType === 'CATEGORY' && group.linkedCategory?.id) {
    return `c:${group.linkedCategory.id}`;
  }
  if (group.sourceType === 'PRODUCT' && group.linkedProduct?.id) {
    return `p:${group.linkedProduct.id}`;
  }
  return null;
}

export function collectLinkedCategoryIds(
  groups: AttributeGroupLike[] | null | undefined,
  into: Set<string> = new Set()
): Set<string> {
  for (const group of groups ?? []) {
    const catId = group.linkedCategory?.id;
    if (catId) into.add(catId);
    for (const item of group.linkedCategory?.items ?? []) {
      collectLinkedCategoryIds(item.attributeGroups, into);
    }
    const links = (
      group.linkedCategory as
        | { itemLinks?: Array<{ menuItem?: MenuItemLike }> }
        | undefined
    )?.itemLinks;
    for (const link of links ?? []) {
      collectLinkedCategoryIds(link.menuItem?.attributeGroups, into);
    }
    if (group.linkedProduct?.attributeGroups) {
      collectLinkedCategoryIds(group.linkedProduct.attributeGroups, into);
    }
  }
  return into;
}

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

function mapPoolItem(
  poolItem: MenuItemLike,
  allCategories: CategoryLike[],
  depth: number,
  path: Set<string>
): MenuItemLike {
  const nestedGroups = poolItem.attributeGroups ?? [];
  const expandNested = depth + 1 < MAX_ENRICH_DEPTH;
  return {
    ...poolItem,
    imageUrl: poolItem.imageUrl ?? null,
    salePrice: poolItem.salePrice ?? null,
    attributeGroups: expandNested
      ? nestedGroups.map((nested) =>
          enrichAttributeGroupFromPool(
            nested,
            allCategories,
            poolItem.id,
            depth + 1,
            path
          )
        )
      : nestedGroups,
  };
}

/** Attach nested recommendation groups to the anchor product (no category pooling). */
export function enrichAttributeGroupSource(
  group: AttributeGroupLike,
  allCategories: CategoryLike[],
  baseProductId: string,
  depth = 0,
  path: Set<string> = new Set()
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

  const expandNested = depth + 1 < MAX_ENRICH_DEPTH;
  return {
    ...group,
    linkedProduct: {
      ...anchor,
      description: anchor.description ?? null,
      imageUrl: anchor.imageUrl ?? null,
      category: undefined,
      attributeGroups: expandNested
        ? (anchor.attributeGroups ?? []).map((nested) =>
            enrichAttributeGroupFromPool(
              nested,
              allCategories,
              anchor.id,
              depth + 1,
              path
            )
          )
        : (anchor.attributeGroups ?? []),
    } as AttributeGroupLike['linkedProduct'],
  };
}

/** Replace linkedCategory.items with the full category pool (includes MenuItemCategory links). */
export function enrichCategoryLinkedItems(
  group: AttributeGroupLike,
  allCategories: CategoryLike[],
  baseProductId: string,
  depth = 0,
  path: Set<string> = new Set()
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

  const expandNested = depth + 1 < MAX_ENRICH_DEPTH;
  return {
    ...group,
    linkedCategory: {
      ...group.linkedCategory,
      name: group.linkedCategory.name || poolCategory.name,
      items: poolCategory.items.map((poolItem) =>
        expandNested
          ? mapPoolItem(poolItem, allCategories, depth, path)
          : {
              ...poolItem,
              imageUrl: poolItem.imageUrl ?? null,
              salePrice: poolItem.salePrice ?? null,
            }
      ) as NonNullable<AttributeGroupSource['linkedCategory']>['items'],
    },
  };
}

/** Enrich a recommendation group from the restaurant category product pool. */
export function enrichAttributeGroupFromPool(
  group: AttributeGroupLike,
  allCategories: CategoryLike[],
  baseProductId: string,
  depth = 0,
  path: Set<string> = new Set()
): AttributeGroupLike {
  if (depth >= MAX_ENRICH_DEPTH) return group;

  const key = groupVisitKey(group);
  if (key && path.has(key)) {
    return group;
  }

  const nextPath = key ? new Set(path).add(key) : path;

  if (group.sourceType === 'PRODUCT') {
    return enrichAttributeGroupSource(
      group,
      allCategories,
      baseProductId,
      depth,
      nextPath
    );
  }
  return enrichCategoryLinkedItems(
    group,
    allCategories,
    baseProductId,
    depth,
    nextPath
  );
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
