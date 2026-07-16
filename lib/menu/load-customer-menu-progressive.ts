import { db } from '@/lib/db';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  buildCustomerMenuAttributeGroupsSelectLegacy,
  customerMenuItemCoreSelect,
  customerMenuItemCoreSelectLegacy,
  type CustomerMenuSelectMode,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import {
  CUSTOMER_MENU_CATEGORY_WHERE,
  RECOMMENDATION_SOURCE_CATEGORY_WHERE,
  sanitizeCustomerMenuPayload,
} from '@/lib/menu/category-visibility';
import {
  isPrismaSchemaDriftError,
} from '@/lib/menu/load-customer-menu';
import { loadSingleCategoryWithLinkedItems } from '@/lib/menu/menu-item-categories';
import { loadRestaurantMenuCategories } from '@/lib/menu/load-restaurant-menu-categories';
import { withRecommendationPoolCache } from '@/lib/menu/recommendation-pool-cache';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  type RestaurantServiceChargeRow,
} from '@/lib/restaurant-service-charge';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';

const restaurantPublicSelect = {
  id: true,
  name: true,
  logoUrl: true,
  mainBannerUrl: true,
  themePrimaryColor: true,
  subdomain: true,
  slug: true,
  ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
} as const;

function buildCustomerMenuItemSelect(mode: CustomerMenuSelectMode) {
  const itemCore =
    mode === 'full'
      ? customerMenuItemCoreSelect
      : customerMenuItemCoreSelectLegacy;
  const buildGroups =
    mode === 'full'
      ? buildCustomerMenuAttributeGroupsSelect
      : buildCustomerMenuAttributeGroupsSelectLegacy;

  return {
    ...itemCore,
    categoryId: true,
    attributeGroups: buildGroups(2),
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
}

function buildRecommendationPoolItemSelect(mode: CustomerMenuSelectMode) {
  const itemCore =
    mode === 'full'
      ? customerMenuItemCoreSelect
      : customerMenuItemCoreSelectLegacy;
  const buildGroups =
    mode === 'full'
      ? buildCustomerMenuAttributeGroupsSelect
      : buildCustomerMenuAttributeGroupsSelectLegacy;

  return {
    ...itemCore,
    attributeGroups: buildGroups(2),
  } as const;
}

async function resolveRestaurant(
  slug?: string | null,
  subdomain?: string | null
) {
  const s = slug?.trim();
  if (s) {
    return db.restaurant.findUnique({
      where: { slug: s },
      select: restaurantPublicSelect,
    });
  }
  const sub = subdomain?.trim();
  if (sub) {
    return db.restaurant.findUnique({
      where: { subdomain: sub },
      select: restaurantPublicSelect,
    });
  }
  return null;
}

async function withMenuSelectMode<T>(
  fn: (mode: CustomerMenuSelectMode) => Promise<T>
): Promise<T> {
  const modes: CustomerMenuSelectMode[] = ['full', 'legacy'];
  for (const mode of modes) {
    try {
      return await fn(mode);
    } catch (error) {
      if (!isPrismaSchemaDriftError(error) || mode === 'legacy') {
        throw error;
      }
      console.warn(
        'customer menu progressive: schema drift, retrying legacy select',
        error
      );
    }
  }
  throw new Error('Failed to load customer menu');
}

async function loadRecommendationPool(
  restaurantId: string,
  mode: CustomerMenuSelectMode
) {
  return withRecommendationPoolCache(
    `customer:${restaurantId}:${mode}`,
    () =>
      loadRestaurantMenuCategories({
        restaurantId,
        categorySelect: { id: true, name: true, sortOrder: true },
        itemSelect: buildRecommendationPoolItemSelect(mode),
        categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
      })
  );
}

function restaurantMetaPayload<
  T extends { id: string } & RestaurantServiceChargeRow,
>(restaurant: T) {
  return {
    ...restaurant,
    serviceCharges: parseRestaurantServiceCharges(restaurant),
  };
}

/** Restaurant branding + category list (no items). */
export async function loadCustomerMenuCategoriesMeta(options: {
  slug?: string | null;
  subdomain?: string | null;
}) {
  return withMenuSelectMode(async () => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;

    // Category WHERE already requires products — skip joining every item id.
    const categories = await db.menuCategory.findMany({
      where: {
        restaurantId: restaurant.id,
        ...CUSTOMER_MENU_CATEGORY_WHERE,
      },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, sortOrder: true, imageUrl: true },
    });

    const menus = categories.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      items: [],
    }));

    return {
      ...restaurantMetaPayload(restaurant),
      menus,
    };
  });
}

/** Items for a single storefront category, with recommendation pools applied. */
export async function loadCustomerMenuCategoryItems(options: {
  slug?: string | null;
  subdomain?: string | null;
  categoryId: string;
  page?: number;
  limit?: number;
}) {
  return withMenuSelectMode(async (mode) => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(48, Math.max(1, options.limit ?? 24));
    const skip = (page - 1) * limit;

    const [category, pool] = await Promise.all([
      loadSingleCategoryWithLinkedItems({
        restaurantId: restaurant.id,
        categoryId: options.categoryId,
        categorySelect: {
          id: true,
          name: true,
          sortOrder: true,
          imageUrl: true,
        },
        itemSelect: buildCustomerMenuItemSelect(mode),
        categoryWhere: CUSTOMER_MENU_CATEGORY_WHERE,
        pagination: { skip, take: limit },
      }),
      loadRecommendationPool(restaurant.id, mode),
    ]);
    if (!category) return null;

    const enriched = applyProductRecommendationPools(
      { menus: [category] },
      pool
    );
    const sanitized = sanitizeCustomerMenuPayload({
      ...restaurantMetaPayload(restaurant),
      menus: enriched.menus ?? [],
    });

    return {
      categoryId: category.id,
      items: sanitized?.menus?.[0]?.items ?? [],
      page,
      limit,
      total: category.itemTotal,
      hasMore: category.hasMore,
    };
  });
}
