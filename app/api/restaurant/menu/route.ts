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
  imageMetaByCategoryIds,
  restaurantBrandingFlags,
  restaurantMenuCategoryImageUrl,
} from '@/lib/menu/menu-item-image-utils';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';
import { MENU_ITEM_VARIATION_SELLABLE_WHERE } from '@/lib/menu/variation-sellable';
import { getRestaurantForOwnerRequest } from '@/lib/restaurant/ownerRestaurant';
import { publicRestaurantImageUrls } from '@/lib/stored-image-response';

/** List/dashboard select — never pulls imageUrl blobs (lazy /image proxies stamped after). */
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

async function stampCategoryImages<
  T extends { id: string; imageUrl?: string | null; updatedAt?: Date | string | number | null },
>(categories: T[]): Promise<T[]> {
  const meta = await imageMetaByCategoryIds(categories.map((c) => c.id));
  return categories.map((category) => {
    const row = meta.get(category.id);
    const hasImage = row?.hasImage ?? false;
    return {
      ...category,
      imageUrl: hasImage
        ? restaurantMenuCategoryImageUrl(
            category.id,
            row?.updatedAt ?? category.updatedAt
          )
        : null,
    };
  });
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
    const [restaurantMeta, branding] = await Promise.all([
      db.restaurant.findUnique({
        where: { id: auth.restaurant.id },
        select: {
          id: true,
          name: true,
          slug: true,
          updatedAt: true,
          themePrimaryColor: true,
          ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
          ...RESTAURANT_DINE_IN_PAYMENT_DB_SELECT,
        },
      }),
      restaurantBrandingFlags(auth.restaurant.id),
    ]);

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
      },
      itemSelect: menuItemSelect,
    });

    const menusWithCategoryIds = await Promise.all(
      (await stampCategoryImages(menus)).map(async (category) => ({
        ...category,
        items: await Promise.all(
          category.items.map(async (item) =>
            attachRestaurantLazyImages(
              mapMenuItemWithCategoryIds(item, categoryIdsByItem)
            )
          )
        ),
      }))
    );

    const allCategoriesRaw = await loadRestaurantMenuCategories({
      restaurantId: auth.restaurant.id,
      categorySelect: {
        id: true,
        name: true,
        sortOrder: true,
        updatedAt: true,
      },
      itemSelect: recommendationPoolItemSelect,
      categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
    });

    const allCategories = await Promise.all(
      (await stampCategoryImages(allCategoriesRaw)).map(async (category) => ({
        ...category,
        items: await Promise.all(
          category.items.map((item) => attachRestaurantLazyImages(item))
        ),
      }))
    );

    const logoUrls = publicRestaurantImageUrls(restaurantMeta.slug, {
      hasLogo: branding.hasLogo,
      hasMainBanner: branding.hasMainBanner,
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

    const inventoryItems = await Promise.all(
      (
        await db.menuItem.findMany({
          where: { restaurantId: auth.restaurant.id },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: menuItemSelect,
        })
      ).map((item) =>
        attachRestaurantLazyImages(
          mapMenuItemWithCategoryIds(item, categoryIdsByItem)
        )
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
