import { db } from '@/lib/db';
import { loadSingleCategoryWithLinkedItems } from '@/lib/menu/menu-item-categories';
import {
  menuItemBrowseListSelect,
  menuItemPosCatalogSelect,
} from '@/lib/menu/menu-item-list-select';
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
import { RESTAURANT_DINE_IN_PAYMENT_DB_SELECT } from '@/lib/restaurant-dine-in-payment';
import {
  parseRestaurantFulfillmentSettings,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} from '@/lib/restaurant-fulfillment-settings';

async function loadCategoryIdsByItemIds(menuItemIds: string[]) {
  const map = new Map<string, string[]>();
  if (menuItemIds.length === 0) return map;

  const links = await db.menuItemCategory.findMany({
    where: { menuItemId: { in: menuItemIds } },
    orderBy: { sortOrder: 'asc' },
    select: { menuItemId: true, categoryId: true },
  });
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

function stampBrowseImages<
  T extends { id: string; imageUrl?: string | null },
>(items: T[], imageFlags: Map<string, boolean>) {
  return items.map((item) =>
    mapBrowseListItem(
      item,
      imageFlags.get(item.id) ?? false,
      imageFlags.get(item.id) ? restaurantMenuItemImageUrl(item.id) : null
    )
  );
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
      ...RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
      ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
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

  return {
    ...withServiceChargesPayload({
      ...restaurantMeta,
      serviceCharges: parseRestaurantServiceCharges(restaurantMeta),
      menus,
    }),
    fulfillmentSettings: parseRestaurantFulfillmentSettings(restaurantMeta),
  };
}

/**
 * POS one-shot catalog: meta + every front category with browse items.
 * Single parallel DB round-trip; each product row loaded once.
 */
export async function loadRestaurantPosMenuCatalog(restaurantId: string) {
  const frontCategoryWhere = {
    restaurantId,
    showInFront: true,
    OR: [{ itemLinks: { some: {} } }, { items: { some: {} } }],
  };

  const [restaurantMeta, categories, links, loadedItems, itemsWithImage] =
    await Promise.all([
      db.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          themePrimaryColor: true,
          ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
          ...RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
          ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
        },
      }),
      db.menuCategory.findMany({
        where: frontCategoryWhere,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          showInFront: true,
          sortOrder: true,
          imageUrl: true,
        },
      }),
      db.menuItemCategory.findMany({
        where: { category: frontCategoryWhere },
        orderBy: [{ sortOrder: 'asc' }, { menuItem: { name: 'asc' } }],
        select: { categoryId: true, menuItemId: true },
      }),
      db.menuItem.findMany({
        where: {
          restaurantId,
          OR: [
            { category: { showInFront: true } },
            {
              categoryLinks: {
                some: { category: { showInFront: true } },
              },
            },
          ],
        },
        select: menuItemPosCatalogSelect,
      }),
      db.menuItem.findMany({
        where: {
          restaurantId,
          AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
        },
        select: { id: true },
      }),
    ]);
  if (!restaurantMeta) return null;

  const imageFlags = new Map<string, boolean>();
  for (const row of itemsWithImage) imageFlags.set(row.id, true);

  const byId = new Map(loadedItems.map((item) => [item.id, item]));
  const orderedIdsByCategory = new Map<string, string[]>();
  const seenByCategory = new Map<string, Set<string>>();
  const categoryIdsByItem = new Map<string, string[]>();

  for (const category of categories) {
    orderedIdsByCategory.set(category.id, []);
    seenByCategory.set(category.id, new Set());
  }

  const pushItemToCategory = (categoryId: string, menuItemId: string) => {
    if (!byId.has(menuItemId)) return;
    const seen = seenByCategory.get(categoryId);
    const ordered = orderedIdsByCategory.get(categoryId);
    if (!seen || !ordered || seen.has(menuItemId)) return;
    seen.add(menuItemId);
    ordered.push(menuItemId);
    const list = categoryIdsByItem.get(menuItemId) ?? [];
    list.push(categoryId);
    categoryIdsByItem.set(menuItemId, list);
  };

  for (const link of links) {
    pushItemToCategory(link.categoryId, link.menuItemId);
  }

  // Legacy primary-category membership (items not only on join table).
  for (const item of loadedItems) {
    if (orderedIdsByCategory.has(item.categoryId)) {
      pushItemToCategory(item.categoryId, item.id);
    }
  }

  const menus = categories.map((category) => {
    const orderedIds = orderedIdsByCategory.get(category.id) ?? [];
    const items = orderedIds
      .map((id) => byId.get(id))
      .filter((item): item is (typeof loadedItems)[number] => Boolean(item));

    return {
      id: category.id,
      name: category.name,
      showInFront: category.showInFront,
      imageUrl: category.imageUrl,
      items: stampBrowseImages(items, imageFlags).map((item) =>
        mapMenuItemWithCategoryIds(item, categoryIdsByItem)
      ),
    };
  });

  return {
    ...withServiceChargesPayload({
      ...restaurantMeta,
      serviceCharges: parseRestaurantServiceCharges(restaurantMeta),
      menus,
    }),
    fulfillmentSettings: parseRestaurantFulfillmentSettings(restaurantMeta),
  };
}

/** POS menu: items for one category (fast browse list). */
export async function loadRestaurantMenuCategoryItems(
  restaurantId: string,
  categoryId: string
) {
  const category = await loadSingleCategoryWithLinkedItems({
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
  });
  if (!category || category.showInFront === false) return null;

  const itemIds = category.items.map((item) => item.id);
  const [imageFlags, categoryIdsByItem] = await Promise.all([
    hasImageByMenuItemIds(itemIds),
    loadCategoryIdsByItemIds(itemIds),
  ]);

  const itemsWithCategoryIds = stampBrowseImages(
    category.items,
    imageFlags
  ).map((item) => mapMenuItemWithCategoryIds(item, categoryIdsByItem));

  return {
    categoryId: category.id,
    items: itemsWithCategoryIds,
  };
}
