/** Categories visible on web storefront, kiosk browse, and POS category tabs. */
export const MENU_CATEGORY_FRONT_FILTER = {
  showInFront: true,
} as const;

/** Storefront / kiosk / POS: must be shown in front and have at least one product. */
export const CUSTOMER_MENU_CATEGORY_WHERE = {
  showInFront: true,
  itemLinks: { some: {} },
} as const;

/** Categories usable as recommendation sources (on-menu and add-on only), non-empty. */
export const RECOMMENDATION_SOURCE_CATEGORY_WHERE = {
  itemLinks: { some: {} },
} as const;

export function categoryHasProducts(
  category: { items?: unknown[] | null } | null | undefined
): boolean {
  return Array.isArray(category?.items) && category.items.length > 0;
}

export function filterCategoriesWithProducts<
  T extends { items?: unknown[] | null },
>(categories: T[]): T[] {
  return categories.filter(categoryHasProducts);
}

export function isMenuCategoryShownInFront(
  category: { showInFront?: boolean | null } | null | undefined
): boolean {
  return category?.showInFront !== false;
}

/** Eligible as a recommendation / add-on linked category. */
export function isCategoryEligibleForRecommendations(
  category: { items?: unknown[] | null } | null | undefined
): boolean {
  return categoryHasProducts(category);
}

type CustomerMenuItem = {
  attributeGroups?: Array<{
    sourceType?: 'CATEGORY' | 'PRODUCT' | null;
    linkedCategory?: { items?: unknown[] | null } | null;
    linkedProduct?: unknown | null;
  }> | null;
};

type CustomerMenuCategory = {
  items?: CustomerMenuItem[] | null;
};

type CustomerMenuRestaurant = {
  menus?: CustomerMenuCategory[] | null;
};

/** Drop empty storefront categories and add-on groups whose linked category has no products. */
export function sanitizeCustomerMenuPayload<T extends CustomerMenuRestaurant>(
  restaurant: T | null
): T | null {
  if (!restaurant?.menus) return restaurant;

  const menus = filterCategoriesWithProducts(restaurant.menus).map((cat) => ({
    ...cat,
    items: (cat.items ?? []).map((item) => ({
      ...item,
      attributeGroups: (item.attributeGroups ?? []).filter((group) => {
        if (group.sourceType === 'PRODUCT') {
          return group.linkedProduct != null;
        }
        return categoryHasProducts(group.linkedCategory ?? undefined);
      }),
    })),
  }));

  return { ...restaurant, menus };
}
