import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import {
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  withServiceChargesPayload,
} from '@/lib/restaurant-service-charge';
import { RESTAURANT_DINE_IN_PAYMENT_DB_SELECT } from '@/lib/restaurant-dine-in-payment';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  customerMenuLinkedItemCoreSelect,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import { RECOMMENDATION_SOURCE_CATEGORY_WHERE } from '@/lib/menu/category-visibility';
import { loadRestaurantMenuCategories } from '@/lib/menu/load-restaurant-menu-categories';
import {
  attachRestaurantLazyImages,
  resolveCategoryImageUrl,
} from '@/lib/menu/menu-item-image-utils';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';
import { MENU_ITEM_VARIATION_SELLABLE_WHERE } from '@/lib/menu/variation-sellable';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publicRestaurantImageUrls } from '@/lib/stored-image-response';

/** List/dashboard select — includes public CDN imageUrl columns. */
const menuItemSelect = {
  ...customerMenuLinkedItemCoreSelect,
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
          updatedAt: true,
          variations: {
            where: MENU_ITEM_VARIATION_SELLABLE_WHERE,
            orderBy: { sortOrder: 'asc' as const },
            select: {
              id: true,
              name: true,
              title: true,
              imageUrl: true,
              swatchHex: true,
              priceDelta: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  },
} as const;

const recommendationPoolItemSelect = {
  ...customerMenuLinkedItemCoreSelect,
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

function stampCategoryImages<
  T extends {
    id: string;
    imageUrl?: string | null;
    updatedAt?: Date | string | number | null;
  },
>(categories: T[]): T[] {
  return categories.map((category) => ({
    ...category,
    imageUrl: resolveCategoryImageUrl(category, { restaurantProxy: true }),
  }));
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
        slug: true,
        logoUrl: true,
        mainBannerUrl: true,
        menuBannerUrls: true,
        updatedAt: true,
        themePrimaryColor: true,
        ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
        ...RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
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
        updatedAt: true,
        imageUrl: true,
      },
      itemSelect: menuItemSelect,
    });

    const menusWithCategoryIds = stampCategoryImages(menus).map((category) => ({
      ...category,
      items: category.items.map((item) =>
        attachRestaurantLazyImages(
          mapMenuItemWithCategoryIds(item, categoryIdsByItem)
        )
      ),
    }));

    const allCategoriesRaw = await loadRestaurantMenuCategories({
      restaurantId: auth.restaurant.id,
      categorySelect: {
        id: true,
        name: true,
        sortOrder: true,
        updatedAt: true,
        imageUrl: true,
      },
      itemSelect: recommendationPoolItemSelect,
      categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
    });

    const allCategories = stampCategoryImages(allCategoriesRaw).map(
      (category) => ({
        ...category,
        items: category.items.map((item) => attachRestaurantLazyImages(item)),
      })
    );

    const logoUrls = publicRestaurantImageUrls(restaurantMeta.slug, {
      logoUrl: restaurantMeta.logoUrl,
      mainBannerUrl: restaurantMeta.mainBannerUrl,
      menuBannerUrls: restaurantMeta.menuBannerUrls,
      updatedAt: restaurantMeta.updatedAt,
    });
    const { slug: _slug, updatedAt: _updatedAt, ...metaRest } = restaurantMeta;

    const enriched = applyProductRecommendationPools(
      {
        ...metaRest,
        logoUrl: logoUrls.logoUrl,
        menus: menusWithCategoryIds,
      },
      allCategories
    );

    const inventoryItems = (
      await db.menuItem.findMany({
        where: { restaurantId: auth.restaurant.id },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: menuItemSelect,
      })
    ).map((item) =>
      attachRestaurantLazyImages(
        mapMenuItemWithCategoryIds(item, categoryIdsByItem)
      )
    );

    return NextResponse.json(
      { data: withServiceChargesPayload({ ...enriched, inventoryItems }) },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 });
  }
}
