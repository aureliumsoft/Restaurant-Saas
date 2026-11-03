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
  imageMetaByCategoryIds,
  restaurantBrandingFlags,
} from '@/lib/menu/menu-item-image-utils';
import { personalizeGroupsSelect } from '@/lib/menu/personalize-groups-select';
import { MENU_ITEM_VARIATION_SELLABLE_WHERE } from '@/lib/menu/variation-sellable';
import {
  customerCategoryImageUrl,
  publicRestaurantImageUrls,
} from '@/lib/stored-image-response';

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
  // Linked core omits imageUrl blobs; lazy /image URLs stamped after load.
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
  updatedAt: true,
  ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
} as const;

async function stampMenusLazyImages<
  T extends {
    id: string;
    updatedAt?: Date | string | number | null;
    imageUrl?: string | null;
    items?: unknown[];
  },
>(
  menus: T[],
  query: { slug?: string | null; subdomain?: string | null }
): Promise<T[]> {
  const categoryMeta = await imageMetaByCategoryIds(menus.map((m) => m.id));
  return Promise.all(
    menus.map(async (cat) => {
      const meta = categoryMeta.get(cat.id);
      const hasImage = meta?.hasImage ?? false;
      const items = await Promise.all(
        ((cat.items ?? []) as object[]).map((item) =>
          attachCustomerLazyImages(item, query)
        )
      );
      return {
        ...cat,
        imageUrl: hasImage
          ? customerCategoryImageUrl(cat.id, {
              ...query,
              updatedAt: meta?.updatedAt ?? cat.updatedAt,
            })
          : null,
        items,
      };
    })
  );
}

async function enrichRestaurantMenuForCustomer<
  T extends {
    id: string;
    slug: string;
    updatedAt?: Date | string | number | null;
    menus: unknown;
  } & RestaurantServiceChargeRow,
>(
  restaurant: T,
  mode: CustomerMenuSelectMode,
  query: { slug?: string | null; subdomain?: string | null },
  branding: { hasLogo: boolean; hasMainBanner: boolean }
) {
  const allCategoriesRaw = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: { id: true, name: true, sortOrder: true, updatedAt: true },
    itemSelect: buildRecommendationPoolItemSelect(mode),
    categoryWhere: RECOMMENDATION_SOURCE_CATEGORY_WHERE,
  });
  const allCategories = await stampMenusLazyImages(allCategoriesRaw, query);
  const menus = await stampMenusLazyImages(
    restaurant.menus as Parameters<typeof stampMenusLazyImages>[0],
    query
  );

  const withImages = {
    ...restaurant,
    ...publicRestaurantImageUrls(restaurant.slug, {
      hasLogo: branding.hasLogo,
      hasMainBanner: branding.hasMainBanner,
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
  const [branch, branding] = await Promise.all([
    db.branch.findFirst({
      where: { id: branchId, restaurantId: restaurant.id, isActive: true },
      select: { id: true },
    }),
    restaurantBrandingFlags(restaurant.id),
  ]);
  if (!branch) return null;

  const menus = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: {
      id: true,
      name: true,
      sortOrder: true,
      updatedAt: true,
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
    { slug, subdomain: null },
    branding
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
  const [branch, branding] = await Promise.all([
    db.branch.findFirst({
      where: { id: branchId, restaurantId: restaurant.id, isActive: true },
      select: { id: true },
    }),
    restaurantBrandingFlags(restaurant.id),
  ]);
  if (!branch) return null;

  const menus = await loadRestaurantMenuCategories({
    restaurantId: restaurant.id,
    categorySelect: {
      id: true,
      name: true,
      sortOrder: true,
      updatedAt: true,
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
    { slug: null, subdomain },
    branding
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
