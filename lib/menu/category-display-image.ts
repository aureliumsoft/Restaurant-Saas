type CategoryImageSource = {
  imageUrl?: string | null;
  items?: Array<{ imageUrl?: string | null }> | null;
};

/** Category image for storefront UI; falls back to the first product image in the category. */
export function getCategoryDisplayImageUrl(
  category: CategoryImageSource
): string | null {
  const own = category.imageUrl?.trim();
  if (own) return own;

  for (const item of category.items ?? []) {
    const productImage = item.imageUrl?.trim();
    if (productImage) return productImage;
  }

  return null;
}
