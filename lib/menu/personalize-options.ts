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
  const hasRequiredAddons =
    product.attributeGroups?.some((g) => g.required) ?? false;
  const hasVariations = (product.variations?.length ?? 0) > 0;
  return hasRequiredAddons || hasVariations || hasPersonalizeOptions(product);
}
