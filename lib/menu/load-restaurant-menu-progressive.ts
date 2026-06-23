import { db } from '@/lib/db';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  customerMenuItemCoreSelect,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import { RECOMMENDATION_SOURCE_CATEGORY_WHERE } from '@/lib/menu/category-visibility';
import { loadSingleCategoryWithLinkedItems } from '@/lib/menu/menu-item-categories';
import { loadRestaurantMenuCategories } from '@/lib/menu/load-restaurant-menu-categories';
import {
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  parseRestaurantServiceCharges,
  withServiceChargesPayload,
} from '@/lib/restaurant-service-charge';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';

const menuItemSelect = {
  ...customerMenuItemCoreSelect,
  categoryId: true,
  attributeGroups: buildCustomerMenuAttributeGroupsSelect(2),
  personalizeGroups: personalizeGroupsSelect,
  offersFromThis: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      sortOrder: true,
      offeredItem: {
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          price: true,
          salePrice: true,
        },
      },
    },
  },
} as const;

const recommendationPoolItemSelect = {
  ...customerMenuItemCoreSelect,
  attributeGroups: buildCustomerMenuAttributeGroupsSelect(2),
} as const;

async function loadCategoryIdsByItem(restaurantId: string) {
  const links = await db.menuItemCategory.findMany({
    where: { category: { restaurantId } },
    orderBy: { sortOrder: 'asc' },
    select: { menuItemId: true, categoryId: true },
  });
  const map = new Map<string, string[]>();
  for (const link of links) {
    const list = map.get(link.menuItemId) ?? [];
    list.push(link.categoryId);
    map.set(link.menuItemId, list);
  }
  return map;
}

function mapMenuItemWithCategoryIds<
  T extends { id: string; categoryId: string },
>(item: T, categoryIdsByItem: Map<string, string[]>) {
  const categoryIds = categoryIdsByItem.get(item.id) ?? [item.categoryId];
  return {
    ...item,
    categoryIds,
  };
}

/** POS menu: restaurant meta + category list (no items). */
export async function loadRestaurantMenuCategoriesMeta(restaurantId: string) {
  const restaurantMeta = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      themePrimaryColor: true,
      ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
    },
  });
  if (!restaurantMeta) return null;

  const categories = await loadRestaurantMenuCategories({
    restaurantId,
    categorySelect: {
      id: true,
      name: true,
      showInFront: true,
      imageUrl: true,
    },
    itemSelect: { id: true },
  });

  const menus = categories
    .filter(
      (c) => c.showInFront !== false && (c.items?.length ?? 0) > 0
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      showInFront: c.showInFront,
      imageUrl: c.imageUrl,
      items: [],
    }));

  return withServiceChargesPayload({
    ...restaurantMeta,
    serviceCharges: parseRestaurantServiceCharges(restaurantMeta),
    menus,
  });
}

/** POS menu: items for one category. */
export async function loadRestaurantMenuCategoryItems(
  restaurantId: string,
  categoryId: string
) {
  const categoryIdsByItem = await loadCategoryIdsByItem(restaurantId);

  const category = await loadSingleCategoryWithLinkedItems({
    restaurantId,
    categoryId,
    categorySelect: {
      id: true,
      name: true,
      showInFront: true,
      imageUrl: true,
    },
    itemSelect: menuItemSelect,
  });
  if (!category || category.showInFront === false) return null;

  const allCategories = await loadRestaurantMenuCategories({
    restaurantId,
    categorySelect: { id: true, name: true, imageUrl: true },
    itemSelect: recommendationPoolItemSelect,
    categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
  });

  const itemsWithCategoryIds = category.items.map((item) =>
    mapMenuItemWithCategoryIds(item, categoryIdsByItem)
  );

  const enriched = applyProductRecommendationPools(
    {
      menus: [{ ...category, items: itemsWithCategoryIds }],
    },
    allCategories
  );

  return {
    categoryId: category.id,
    items: enriched.menus?.[0]?.items ?? [],
  };
}
