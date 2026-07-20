type LinkedItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl: string | null;
  price: number;
  salePrice: number | null;
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

  const items = group.linkedCategory?.items ?? [];
  return items.filter((it) => it.id !== baseProductId);
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
