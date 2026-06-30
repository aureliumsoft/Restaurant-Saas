import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import {
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  withServiceChargesPayload,
} from '@/lib/restaurant-service-charge';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  customerMenuItemCoreSelect,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import { RECOMMENDATION_SOURCE_CATEGORY_WHERE } from '@/lib/menu/category-visibility';
import { loadRestaurantMenuCategories } from '@/lib/menu/load-restaurant-menu-categories';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';

const menuItemSelect = {
  ...customerMenuItemCoreSelect,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
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

function mapMenuItemWithCategoryIds<
  T extends { id: string; categoryId: string },
>(item: T, categoryIdsByItem: Map<string, string[]>) {
  const categoryIds = categoryIdsByItem.get(item.id) ?? [item.categoryId];
  return {
    ...item,
    categoryIds,
  };
}

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

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ['product', 'pos', 'recommendations'],
    action: 'access',
  });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const restaurantMeta = await db.restaurant.findUnique({
      where: { id: auth.restaurant.id },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        themePrimaryColor: true,
        ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
      },
    });

    if (!restaurantMeta) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    const categoryIdsByItem = await loadCategoryIdsByItem(auth.restaurant.id);

    const menus = await loadRestaurantMenuCategories({
      restaurantId: auth.restaurant.id,
      categorySelect: {
        id: true,
        name: true,
        showInFront: true,
        sortOrder: true,
        imageUrl: true,
      },
      itemSelect: menuItemSelect,
    });

    const menusWithCategoryIds = menus.map((category) => ({
      ...category,
      items: category.items.map((item) =>
        mapMenuItemWithCategoryIds(item, categoryIdsByItem)
      ),
    }));

    const allCategories = await loadRestaurantMenuCategories({
      restaurantId: auth.restaurant.id,
      categorySelect: { id: true, name: true, sortOrder: true, imageUrl: true },
      itemSelect: recommendationPoolItemSelect,
      categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
    });

    const enriched = applyProductRecommendationPools(
      { ...restaurantMeta, menus: menusWithCategoryIds },
      allCategories
    );

    const inventoryItems = (
      await db.menuItem.findMany({
        where: { restaurantId: auth.restaurant.id },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: menuItemSelect,
      })
    ).map((item) => mapMenuItemWithCategoryIds(item, categoryIdsByItem));

    return NextResponse.json(
      { data: withServiceChargesPayload({ ...enriched, inventoryItems }) },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 });
  }
}
