





import type { Prisma } from '@prisma/client';

/** Category product fallback order: earliest created first (stable, unaffected by edits). */
export const MENU_ITEM_DATE_ORDER = [
  { createdAt: 'asc' as const },
] as const satisfies Prisma.Enumerable<Prisma.MenuItemOrderByWithRelationInput>;

/** Order MenuItemCategory join rows by Final View / catalog sort order (unaffected by edits). */
export const MENU_ITEM_CATEGORY_LINK_SORT_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
  { menuItem: { createdAt: 'asc' as const } },
] as const satisfies Prisma.Enumerable<Prisma.MenuItemCategoryOrderByWithRelationInput>;

/**
 * Guest/POS/Recommendation category product order.
 * Follows Final View sortOrder strictly; stable creation order as tie-breaker.
 */
export const MENU_ITEM_CATEGORY_LINK_DATE_ORDER =
  MENU_ITEM_CATEGORY_LINK_SORT_ORDER;
