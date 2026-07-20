import { db } from '@/lib/db';
import { loadSingleCategoryWithLinkedItems } from '@/lib/menu/menu-item-categories';
import { menuItemBrowseListSelect } from '@/lib/menu/menu-item-list-select';
import {
  hasImageByMenuItemIds,
  mapBrowseListItem,
  restaurantMenuItemImageUrl,
} from '@/lib/menu/menu-item-image-utils';
import {
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  parseRestaurantServiceCharges,
  withServiceChargesPayload,
} from '@/lib/restaurant-service-charge';

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

  const categories = await db.menuCategory.findMany({
    where: {
      restaurantId,
      showInFront: true,
      OR: [{ itemLinks: { some: {} } }, { items: { some: {} } }],
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      showInFront: true,
      sortOrder: true,
      imageUrl: true,
    },
  });

  const menus = categories.map((c) => ({
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

/** POS menu: items for one category (fast browse list). */
export async function loadRestaurantMenuCategoryItems(
  restaurantId: string,
  categoryId: string
) {
  const [categoryIdsByItem, category] = await Promise.all([
    loadCategoryIdsByItem(restaurantId),
    loadSingleCategoryWithLinkedItems({
      restaurantId,
      categoryId,
      categorySelect: {
        id: true,
        name: true,
        showInFront: true,
        sortOrder: true,
        imageUrl: true,
      },
      itemSelect: menuItemBrowseListSelect,
    }),
  ]);
  if (!category || category.showInFront === false) return null;

  const itemIds = category.items.map((item) => item.id);
  const imageFlags = await hasImageByMenuItemIds(itemIds);

  const itemsWithCategoryIds = category.items.map((item) => {
    const mapped = mapBrowseListItem(
      item,
      imageFlags.get(item.id) ?? false,
      imageFlags.get(item.id) ? restaurantMenuItemImageUrl(item.id) : null
    );
    return mapMenuItemWithCategoryIds(mapped, categoryIdsByItem);
  });

  return {
    categoryId: category.id,
    items: itemsWithCategoryIds,
  };
}
