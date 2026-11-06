import { db } from '@/lib/db';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  type RestaurantServiceChargeRow,
} from '@/lib/restaurant-service-charge';
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
  categoryVisibleForBranch,
  RECOMMENDATION_SOURCE_CATEGORY_WHERE,
  sanitizeCustomerMenuPayload,
} from '@/lib/menu/category-visibility';
import { loadRestaurantMenuCategories } from '@/lib/menu/load-restaurant-menu-categories';
import {
  attachCustomerLazyImages,
  resolveCategoryImageUrl,
} from '@/lib/menu/menu-item-image-utils';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';
import { MENU_ITEM_VARIATION_SELLABLE_WHERE } from '@/lib/menu/variation-sellable';
import { publicRestaurantImageUrls } from '@/lib/stored-image-response';

export function isPrismaSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code === 'P2021' || code === 'P2022') return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Unknown nested field/i.test(message) ||
    /Unknown field/i.test(message) ||
    /Unknown arg/i.test(message)
  );
}

function buildCustomerMenuItemSelect(mode: CustomerMenuSelectMode) {
  // imageUrl is a short public CDN URL (post-migration); resolved inline.
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
    ...(mode === 'full'
      ? {
          dealsFromThis: {
            orderBy: { sortOrder: 'asc' as const },
            select: {
              id: true,
              sortOrder: true,
              dealItem: {
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
                },
              },
            },
          },
        }
      : {}),
  } as const;
}

function buildRecommendationPoolItemSelect(mode: CustomerMenuSelectMode) {
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

const restaurantPublicSelect = {
  id: true,
  name: true,
  themePrimaryColor: true,
  subdomain: true,
  slug: true,
  logoUrl: true,
  mainBannerUrl: true,
  menuBannerUrls: true,
  updatedAt: true,
  ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
} as const;

function stampMenusInlineImages<
  T extends {
    id: string;
    updatedAt?: Date | string | number | null;
    imageUrl?: string | null;
    items?: unknown[];
  },
>(
  menus: T[],
  query: { slug?: string | null; subdomain?: string | null }
): T[] {
  return menus.map((cat) => {
    const items = ((cat.items ?? []) as object[]).map((item) =>
      attachCustomerLazyImages(item, query)
    );
    return {
      ...cat,
      imageUrl: resolveCategoryImageUrl(cat, query),
      items,
    };
  });
}

async function enrichRestaurantMenuForCustomer<
  T extends {
    id: string;
    slug: string;
    logoUrl?: string | null;
    mainBannerUrl?: string | null;
    menuBannerUrls?: string[] | null;
    updatedAt?: Date | string | number | null;
    menus: unknown;
  } & RestaurantServiceChargeRow,
>(
  restaurant: T,
  mode: CustomerMenuSelectMode,
  query: { slug?: string | null; subdomain?: string | null }
) {
  const allCategoriesRaw = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: {
      id: true,
      name: true,
      sortOrder: true,
      updatedAt: true,
      imageUrl: true,
    },
    itemSelect: buildRecommendationPoolItemSelect(mode),
    categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
  });
  const allCategories = stampMenusInlineImages(allCategoriesRaw, query);
  const menus = stampMenusInlineImages(
    restaurant.menus as Parameters<typeof stampMenusInlineImages>[0],
    query
  );

  const withImages = {
    ...restaurant,
    ...publicRestaurantImageUrls(restaurant.slug, {
      logoUrl: restaurant.logoUrl,
      mainBannerUrl: restaurant.mainBannerUrl,
      menuBannerUrls: restaurant.menuBannerUrls,
      updatedAt: restaurant.updatedAt,
    }),
    menus,
  };

  return {
    ...sanitizeCustomerMenuPayload(
      applyProductRecommendationPools(
        withImages as Parameters<typeof applyProductRecommendationPools>[0],
        allCategories
      )
    ),
    serviceCharges: parseRestaurantServiceCharges(restaurant),
  };
}

async function loadBySlugWithMode(
  slug: string,
  mode: CustomerMenuSelectMode,
  branchId: string
) {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: restaurantPublicSelect,
  });
  if (!restaurant) return null;
  const branch = await db.branch.findFirst({
    where: { id: branchId, restaurantId: restaurant.id, isActive: true },
    select: { id: true },
  });
  if (!branch) return null;

  const menus = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: {
      id: true,
      name: true,
      sortOrder: true,
      updatedAt: true,
      imageUrl: true,
    },
    itemSelect: buildCustomerMenuItemSelect(mode),
    categoryWhere: {
      ...CUSTOMER_MENU_CATEGORY_WHERE,
      ...categoryVisibleForBranch(branchId),
    },
  });

  return enrichRestaurantMenuForCustomer(
    { ...restaurant, menus },
    mode,
    { slug, subdomain: null }
  );
}

async function loadBySubdomainWithMode(
  subdomain: string,
  mode: CustomerMenuSelectMode,
  branchId: string
) {
  const restaurant = await db.restaurant.findUnique({
    where: { subdomain },
    select: restaurantPublicSelect,
  });
  if (!restaurant) return null;
  const branch = await db.branch.findFirst({
    where: { id: branchId, restaurantId: restaurant.id, isActive: true },
    select: { id: true },
  });
  if (!branch) return null;

  const menus = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: {
      id: true,
      name: true,
      sortOrder: true,
      updatedAt: true,
      imageUrl: true,
    },
    itemSelect: buildCustomerMenuItemSelect(mode),
    categoryWhere: {
      ...CUSTOMER_MENU_CATEGORY_WHERE,
      ...categoryVisibleForBranch(branchId),
    },
  });

  return enrichRestaurantMenuForCustomer(
    { ...restaurant, menus },
    mode,
    { slug: null, subdomain }
  );
}

/** Load customer menu; retries with legacy Prisma select when production DB lags migrations. */
export async function loadCustomerMenuRestaurant(options: {
  slug?: string | null;
  subdomain?: string | null;
  branchId: string;
}) {
  const modes: CustomerMenuSelectMode[] = ['full', 'legacy'];
  const slug = options.slug?.trim();
  const subdomain = options.subdomain?.trim();

  for (const mode of modes) {
    try {
      if (slug) {
        return await loadBySlugWithMode(slug, mode, options.branchId);
      }
      if (subdomain) {
        return await loadBySubdomainWithMode(subdomain, mode, options.branchId);
      }
      return null;
    } catch (error) {
      if (!isPrismaSchemaDriftError(error) || mode === 'legacy') {
        throw error;
      }
      console.warn(
        'customer menu: schema drift detected, retrying with legacy select',
        error
      );
    }
  }

  return null;
}
