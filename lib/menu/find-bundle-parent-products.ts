export type BundleLookupAttributeGroup = {
  sourceType?: 'CATEGORY' | 'PRODUCT' | null;
  linkedProduct?: { id: string } | null;
  linkedCategory?: { items?: Array<{ id: string }> | null } | null;
};

export type BundleLookupProduct = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  salePrice?: number | null;
  attributeGroups?: BundleLookupAttributeGroup[] | null;
};

function configurationGroupReferencesProduct(
  group: BundleLookupAttributeGroup,
  productId: string
): boolean {
  if (group.sourceType === 'PRODUCT') {
    return group.linkedProduct?.id === productId;
  }
  return (group.linkedCategory?.items ?? []).some((item) => item.id === productId);
}

/** Menu/deal products that include `productId` in a configuration group. */
export function findBundleParentProducts<T extends BundleLookupProduct>(
  productId: string,
  allProducts: T[]
): T[] {
  return allProducts.filter(
    (parent) =>
      parent.id !== productId &&
      (parent.attributeGroups ?? []).some((group) =>
        configurationGroupReferencesProduct(group, productId)
      )
  );
}

export function productHasBundleOffers(
  productId: string,
  allProducts: BundleLookupProduct[]
): boolean {
  return findBundleParentProducts(productId, allProducts).length > 0;
}
