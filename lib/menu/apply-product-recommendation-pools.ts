import {
  enrichAttributeGroupSource,
  type AttributeGroupLike,
  type CategoryLike,
} from '@/lib/menu/product-recommendation-pool';

type MenuItemWithGroups = {
  id: string;
  attributeGroups?: AttributeGroupLike[] | null;
};

type MenuCategoryWithItems = {
  items?: MenuItemWithGroups[] | null;
};

type RestaurantWithMenus = {
  menus?: MenuCategoryWithItems[] | null;
};

/** Enrich PRODUCT groups with nested recommendation data for the anchor product. */
export function applyProductRecommendationPools<T extends RestaurantWithMenus>(
  restaurant: T,
  allCategories: CategoryLike[]
): T {
  if (!restaurant.menus?.length) return restaurant;

  const menus = restaurant.menus.map((cat) => ({
    ...cat,
    items: (cat.items ?? []).map((item) => ({
      ...item,
      attributeGroups: (item.attributeGroups ?? []).map((group) => {
        if (
          group.sourceType !== 'PRODUCT' ||
          !(group.productCategoryIds?.length ?? 0)
        ) {
          return group;
        }
        return enrichAttributeGroupSource(group, allCategories, item.id);
      }),
    })),
  }));

  return { ...restaurant, menus };
}
