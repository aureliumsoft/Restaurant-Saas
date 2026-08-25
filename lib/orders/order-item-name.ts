export const DELETED_PRODUCT_LABEL = 'Deleted product';

export function orderItemDisplayName(item: {
  productName?: string | null;
  menuItem?: { name?: string | null } | null;
}): string {
  const live = item.menuItem?.name?.trim();
  if (live) return live;
  const snap = item.productName?.trim();
  if (snap) return snap;
  return DELETED_PRODUCT_LABEL;
}
