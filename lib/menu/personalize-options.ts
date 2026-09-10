export type PersonalizeGroupsLike = {
  personalizeGroups?: Array<{ options?: unknown[] }> | null;
};

export function hasPersonalizeOptions(
  product: PersonalizeGroupsLike | null | undefined
): boolean {
  if (!product?.personalizeGroups?.length) return false;
  return product.personalizeGroups.some(
    (group) => (group.options?.length ?? 0) > 0
  );
}

export function productNeedsCustomizeDialog(product: {
  attributeGroups?: Array<{ required?: boolean }>;
  variations?: unknown[] | null;
  personalizeGroups?: Array<{ options?: unknown[] }> | null;
}): boolean {
  const hasAddons = (product.attributeGroups?.length ?? 0) > 0;
  const hasVariations = (product.variations?.length ?? 0) > 0;
  return hasAddons || hasVariations || hasPersonalizeOptions(product);
}
