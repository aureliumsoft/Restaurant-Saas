export type PosCustomizeIndex = {
  groupsByItem: Record<string, Array<Record<string, unknown>>>;
  optionsByCategory: Record<string, Array<Record<string, unknown>>>;
  personalizeByItem: Record<string, Array<Record<string, unknown>>>;
  productCards: Record<string, Record<string, unknown>>;
};

type IndexGroup = Record<string, unknown>;

/**
 * Join a dish to the shared recommendation lists. No network call.
 * Returns null only when the index has not arrived yet.
 */
export function assemblePosCustomizeProduct<T extends { id: string }>(
  product: T,
  index: PosCustomizeIndex | null | undefined
): T | null {
  if (!index) return null;
  const groups = index.groupsByItem[product.id] ?? [];
  const attributeGroups = groups
    .map((group) => attachGroupOptions(group, index))
    .filter((group): group is IndexGroup => group != null);
  const personalizeGroups =
    index.personalizeByItem[product.id] ??
    (product as { personalizeGroups?: unknown }).personalizeGroups ??
    [];
  return {
    ...product,
    attributeGroups,
    personalizeGroups,
  };
}

function attachGroupOptions(
  group: IndexGroup,
  index: PosCustomizeIndex
): IndexGroup | null {
  const sourceType = typeof group.sourceType === 'string' ? group.sourceType : '';
  if (sourceType === 'PRODUCT') {
    const productId =
      typeof group.linkedProductId === 'string' ? group.linkedProductId : '';
    const linkedProduct = productId ? index.productCards[productId] : undefined;
    if (!linkedProduct) return null;
    return { ...group, linkedProduct: { ...linkedProduct }, linkedCategory: null };
  }
  const categoryId =
    typeof group.linkedCategoryId === 'string' ? group.linkedCategoryId : '';
  if (!categoryId) return null;
  const name =
    typeof group.linkedCategoryName === 'string' && group.linkedCategoryName
      ? group.linkedCategoryName
      : typeof group.name === 'string'
        ? group.name
        : '';
  return {
    ...group,
    linkedProduct: null,
    linkedCategory: {
      id: categoryId,
      name,
      items: [...(index.optionsByCategory[categoryId] ?? [])],
    },
  };
}
