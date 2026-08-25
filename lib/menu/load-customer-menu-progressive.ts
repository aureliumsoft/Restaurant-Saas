import { db } from '@/lib/db';
import { applyProductRecommendationPools } from '@/lib/menu/apply-product-recommendation-pools';
import {
  buildCustomerMenuAttributeGroupsSelect,
  buildCustomerMenuAttributeGroupsSelectLegacy,
  customerMenuLinkedItemCoreSelect,
  customerMenuLinkedItemCoreSelectLegacy,
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
import { loadSingleCategoryWithLinkedItems, getMenuItemCategoryIds } from '@/lib/menu/menu-item-categories';
import { loadRestaurantMenuCategories } from '@/lib/menu/load-restaurant-menu-categories';
import { menuItemBrowseListSelect } from '@/lib/menu/menu-item-list-select';
import {
  attachCustomerLazyImages,
  customerMenuItemImageUrl,
  hasImageByMenuItemIds,
  mapBrowseListItem,
  stampBrowseVariationImages,
} from '@/lib/menu/menu-item-image-utils';
import { customerCategoryImageUrl, publicRestaurantImageUrls } from '@/lib/stored-image-response';
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
  // Customize detail: no embedded image blobs (hero + options use /image proxies).
  const itemCore =
    mode === 'full'
      ? customerMenuLinkedItemCoreSelect
      : customerMenuLinkedItemCoreSelectLegacy;
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
            price: true,
            salePrice: true,
          },
        },
      },
    },
  } as const;
}

function buildRecommendationPoolItemSelect(mode: CustomerMenuSelectMode) {
  // Pool feeds recommendation option lists — never embed image blobs.
  const itemCore =
    mode === 'full'
      ? customerMenuLinkedItemCoreSelect
      : customerMenuLinkedItemCoreSelectLegacy;
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
  T extends { id: string; slug: string } & RestaurantServiceChargeRow & {
    logoUrl?: string | null;
    mainBannerUrl?: string | null;
  },
>(restaurant: T) {
  return {
    ...restaurant,
    ...publicRestaurantImageUrls(restaurant.slug, restaurant),
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
      imageUrl: c.imageUrl
        ? customerCategoryImageUrl(c.id, {
            slug: options.slug,
            subdomain: options.subdomain,
          })
        : null,
      items: [],
    }));

    return {
      ...restaurantMetaPayload(restaurant),
      menus,
    };
  });
}

/** Items for a single storefront category (fast browse list — no recommendation pool). */
export async function loadCustomerMenuCategoryItems(options: {
  slug?: string | null;
  subdomain?: string | null;
  categoryId: string;
  page?: number;
  limit?: number;
}) {
  return withMenuSelectMode(async () => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(48, Math.max(1, options.limit ?? 24));
    const skip = (page - 1) * limit;

    const category = await loadSingleCategoryWithLinkedItems({
      restaurantId: restaurant.id,
      categoryId: options.categoryId,
      categorySelect: {
        id: true,
        name: true,
        sortOrder: true,
        imageUrl: true,
      },
      itemSelect: menuItemBrowseListSelect,
      categoryWhere: CUSTOMER_MENU_CATEGORY_WHERE,
      pagination: { skip, take: limit },
    });
    if (!category) return null;

    const itemIds = category.items.map((item) => item.id);
    const imageFlags = await hasImageByMenuItemIds(itemIds);
    const imageQuery = {
      slug: options.slug,
      subdomain: options.subdomain,
    };

    const items = await stampBrowseVariationImages(
      category.items.map((item) =>
        mapBrowseListItem(
          item,
          imageFlags.get(item.id) ?? false,
          imageFlags.get(item.id)
            ? customerMenuItemImageUrl(item.id, imageQuery)
            : null
        )
      ),
      imageQuery
    );

    return {
      categoryId: category.id,
      items,
      page,
      limit,
      total: category.itemTotal,
      hasMore: category.hasMore,
    };
  });
}

/** Full product detail for customize dialog (fetched by id). */
export async function loadCustomerMenuProductDetail(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
}) {
  return withMenuSelectMode(async (mode) => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;

    const item = await db.menuItem.findFirst({
      where: {
        id: options.itemId,
        restaurantId: restaurant.id,
      },
      select: buildCustomerMenuItemSelect(mode),
    });
    if (!item) return null;

    const categoryIds = await getMenuItemCategoryIds(options.itemId);
    const imageQuery = {
      slug: options.slug,
      subdomain: options.subdomain,
    };
    const pool = await loadRecommendationPool(restaurant.id, mode);

    const enriched = applyProductRecommendationPools(
      {
        menus: [
          {
            id: 'detail',
            name: '',
            items: [
              {
                ...item,
                categoryIds,
              },
            ],
          },
        ],
      },
      pool
    );
    const sanitized = sanitizeCustomerMenuPayload({
      ...restaurantMetaPayload(restaurant),
      menus: enriched.menus ?? [],
    });
    const detail = sanitized?.menus?.[0]?.items?.[0] ?? null;
    if (!detail) return null;

    const withImages = await attachCustomerLazyImages(detail, imageQuery);
    return {
      ...withImages,
      categoryIds:
        categoryIds.length > 0 ? categoryIds : [detail.categoryId],
    };
  });
}

