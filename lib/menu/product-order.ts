import type { Prisma } from '@prisma/client';

/** Newest / most recently updated MenuItem first (matches Products dashboard). */
export const MENU_ITEM_DATE_ORDER = [
  { updatedAt: 'desc' as const },
  { createdAt: 'desc' as const },
] as const satisfies Prisma.Enumerable<Prisma.MenuItemOrderByWithRelationInput>;

/** Order MenuItemCategory join rows by Final View / catalog sort order. */
export const MENU_ITEM_CATEGORY_LINK_SORT_ORDER = [
  { sortOrder: 'asc' as const },
  { menuItem: { updatedAt: 'desc' as const } },
  { menuItem: { createdAt: 'desc' as const } },
] as const satisfies Prisma.Enumerable<Prisma.MenuItemCategoryOrderByWithRelationInput>;

/**
 * Guest/POS category product order.
 * Prefer sortOrder (Final View); date fields as tie-breakers.
 */
export const MENU_ITEM_CATEGORY_LINK_DATE_ORDER =
  MENU_ITEM_CATEGORY_LINK_SORT_ORDER;
