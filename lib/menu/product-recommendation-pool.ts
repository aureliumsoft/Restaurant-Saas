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
    } as AttributeGroupLike['linkedProduct'],
  };
}
