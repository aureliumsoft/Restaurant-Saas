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

/** Deal includes this item as a linked product recommendation (not a category pool). */
function configurationGroupReferencesProductRecommendation(
  group: BundleLookupAttributeGroup,
  productId: string
): boolean {
  return (
    group.sourceType === 'PRODUCT' && group.linkedProduct?.id === productId
  );
}

/**
 * Deals that offer `productId` as a product recommendation.
 * Category recommendations (items inside a linked category) do not trigger the
 * single-vs-deal popup — guests order that product alone instead.
 */
export function findBundleParentProducts<T extends BundleLookupProduct>(
  productId: string,
  allProducts: T[]
): T[] {
  return allProducts.filter(
    (parent) =>
      parent.id !== productId &&
      (parent.attributeGroups ?? []).some((group) =>
        configurationGroupReferencesProductRecommendation(group, productId)
      )
  );
}

export function productHasBundleOffers(
  productId: string,
  allProducts: BundleLookupProduct[]
): boolean {
  return findBundleParentProducts(productId, allProducts).length > 0;
}
