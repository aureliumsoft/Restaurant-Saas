export function menuItemCategoryIds(item: {
  categoryId: string;
  categoryIds?: string[] | null;
}): string[] {
  if (item.categoryIds && item.categoryIds.length > 0) {
    return item.categoryIds;
  }
  return [item.categoryId];
}

export function menuItemBelongsToCategory(
  item: { categoryId: string; categoryIds?: string[] | null },
  categoryId: string
): boolean {
  return menuItemCategoryIds(item).includes(categoryId);
}
