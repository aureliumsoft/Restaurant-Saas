import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  buildCustomerProductDetailAttributeGroupsSelect,
  buildCustomerProductDetailShellAttributeGroupsSelect,
  customerProductDetailGroupSelect,
  customerProductDetailOptionCardSelect,
  type CustomerMenuSelectMode,
} from '@/lib/menu/customer-menu-attribute-groups-select';
import {
  CUSTOMER_MENU_CATEGORY_WHERE,
  categoryHasProducts,
  categoryVisibleForBranch,
} from '@/lib/menu/category-visibility';
import {
  isPrismaSchemaDriftError,
} from '@/lib/menu/load-customer-menu';
import { loadSingleCategoryWithLinkedItems } from '@/lib/menu/menu-item-categories';
import {
  menuItemBrowseListSelect,
  menuItemBrowseListSelectLegacy,
} from '@/lib/menu/menu-item-list-select';
import {
  MENU_ITEM_CATEGORY_LINK_DATE_ORDER,
  MENU_ITEM_DATE_ORDER,
} from '@/lib/menu/product-order';
import {
  type AttributeGroupSource,
} from '@/lib/menu/map-attribute-group-items';
import {
  attachCustomerLazyImages,
  attachRestaurantLazyImages,
  customerMenuItemImageUrl,
  mapBrowseListItem,
  resolveCategoryImageUrl,
  restaurantMenuItemImageUrl,
  stampBrowseVariationImages,
} from '@/lib/menu/menu-item-image-utils';
import { resolveStoredImageUrl } from '@/lib/resolve-stored-image-url';
import { publicRestaurantImageUrls } from '@/lib/stored-image-response';
import {
  parseRestaurantServiceCharges,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  type RestaurantServiceChargeRow,
} from '@/lib/restaurant-service-charge';
import { personalizeGroupsSelectLite } from '@/lib/menu/personalize-groups-select';
import {
  isPrismaFulfillmentSettingsFieldError,
  parseRestaurantFulfillmentSettings,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
  RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT_PRE_CHANNEL,
} from '@/lib/restaurant-fulfillment-settings';

const restaurantPublicSelectCore = {
  id: true,
  name: true,
  themePrimaryColor: true,
  subdomain: true,
  slug: true,
  updatedAt: true,
  ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
} as const;

const restaurantPublicSelectBase = {
  ...restaurantPublicSelectCore,
  ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT_PRE_CHANNEL,
} as const;

const restaurantPublicSelect = {
  ...restaurantPublicSelectBase,
  ...RESTAURANT_FULFILLMENT_SETTINGS_DB_SELECT,
} as const;

function buildCustomerProductDetailItemSelect(mode: CustomerMenuSelectMode) {
  return {
    id: true,
    name: true,
    description: true,
    imageUrl: true,
    price: true,
    salePrice: true,
    updatedAt: true,
    categoryId: true,
    variations: customerProductDetailOptionCardSelect(mode).variations,
    attributeGroups: buildCustomerProductDetailAttributeGroupsSelect(mode),
    personalizeGroups: personalizeGroupsSelectLite,
  } as const;
}

/** Shell open: product + group metadata only (no option cards / nest trees). */
function buildCustomerProductDetailShellItemSelect(
  mode: CustomerMenuSelectMode
) {
  return {
    id: true,
    name: true,
    description: true,
    imageUrl: true,
    price: true,
    salePrice: true,
    updatedAt: true,
    categoryId: true,
    variations: customerProductDetailOptionCardSelect(mode).variations,
    attributeGroups: buildCustomerProductDetailShellAttributeGroupsSelect(mode),
    personalizeGroups: personalizeGroupsSelectLite,
  } as const;
}

async function findRestaurantPublic(
  where: { slug: string } | { subdomain: string }
) {
  const imageWhere =
    'slug' in where
      ? db.$queryRaw<RestaurantImageHead[]>`
          SELECT
            CASE WHEN left(coalesce("logoUrl", ''), 4) = 'http' THEN "logoUrl" ELSE NULL END AS "logoUrl",
            ("logoUrl" IS NOT NULL AND btrim("logoUrl") <> '') AS "hasLogo",
            CASE WHEN left(coalesce("mainBannerUrl", ''), 4) = 'http' THEN "mainBannerUrl" ELSE NULL END AS "mainBannerUrl",
            ("mainBannerUrl" IS NOT NULL AND btrim("mainBannerUrl") <> '') AS "hasMainBanner",
            "menuBannerUrls"
          FROM "Restaurant"
          WHERE slug = ${where.slug}
          LIMIT 1
        `
      : db.$queryRaw<RestaurantImageHead[]>`
          SELECT
            CASE WHEN left(coalesce("logoUrl", ''), 4) = 'http' THEN "logoUrl" ELSE NULL END AS "logoUrl",
            ("logoUrl" IS NOT NULL AND btrim("logoUrl") <> '') AS "hasLogo",
            CASE WHEN left(coalesce("mainBannerUrl", ''), 4) = 'http' THEN "mainBannerUrl" ELSE NULL END AS "mainBannerUrl",
            ("mainBannerUrl" IS NOT NULL AND btrim("mainBannerUrl") <> '') AS "hasMainBanner",
            "menuBannerUrls"
          FROM "Restaurant"
          WHERE subdomain = ${where.subdomain}
          LIMIT 1
        `;

  const loadRow = async () => {
    try {
      return await db.restaurant.findUnique({
        where,
        select: restaurantPublicSelect,
      });
    } catch (error) {
      if (!isPrismaFulfillmentSettingsFieldError(error)) throw error;
      try {
        return await db.restaurant.findUnique({
          where,
          select: restaurantPublicSelectBase,
        });
      } catch (baseError) {
        if (!isPrismaFulfillmentSettingsFieldError(baseError)) throw baseError;
        return db.restaurant.findUnique({
          where,
          select: restaurantPublicSelectCore,
        });
      }
    }
  };

  const [row, images] = await Promise.all([loadRow(), imageWhere]);
  if (!row) return null;
  const image = images[0];
  return {
    ...row,
    logoUrl: image?.logoUrl ?? null,
    hasLogo: Boolean(image?.hasLogo),
    mainBannerUrl: image?.mainBannerUrl ?? null,
    hasMainBanner: Boolean(image?.hasMainBanner),
    menuBannerUrls: image?.menuBannerUrls ?? [],
  };
}

type RestaurantImageHead = {
  logoUrl: string | null;
  hasLogo: boolean;
  mainBannerUrl: string | null;
  hasMainBanner: boolean;
  menuBannerUrls: string[] | null;
};

const RESTAURANT_LOOKUP_MS = 60_000;
const restaurantLookupCache = new Map<
  string,
  { at: number; value: Awaited<ReturnType<typeof findRestaurantPublic>> }
>();
const restaurantLookupInflight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof findRestaurantPublic>>>
>();
const restaurantIdCache = new Map<string, { at: number; value: string | null }>();
const restaurantIdInflight = new Map<string, Promise<string | null>>();

function restaurantLookupKey(slug?: string | null, subdomain?: string | null) {
  const s = slug?.trim();
  if (s) return `slug:${s}`;
  const sub = subdomain?.trim();
  if (sub) return `sub:${sub}`;
  return '';
}

async function resolveRestaurant(
  slug?: string | null,
  subdomain?: string | null
) {
  const key = restaurantLookupKey(slug, subdomain);
  if (!key) return null;
  const hit = restaurantLookupCache.get(key);
  if (hit && Date.now() - hit.at < RESTAURANT_LOOKUP_MS) return hit.value;
  const pending = restaurantLookupInflight.get(key);
  if (pending) return pending;
  const request = (async () => {
    const s = slug?.trim();
    const value = s
      ? await findRestaurantPublic({ slug: s })
      : await findRestaurantPublic({ subdomain: subdomain!.trim() });
    restaurantLookupCache.set(key, { at: Date.now(), value });
    return value;
  })().finally(() => {
    restaurantLookupInflight.delete(key);
  });
  restaurantLookupInflight.set(key, request);
  return request;
}

async function resolveRestaurantId(
  slug?: string | null,
  subdomain?: string | null
): Promise<string | null> {
  const key = restaurantLookupKey(slug, subdomain);
  if (!key) return null;
  const hit = restaurantIdCache.get(key);
  if (hit && Date.now() - hit.at < RESTAURANT_LOOKUP_MS) return hit.value;
  const pending = restaurantIdInflight.get(key);
  if (pending) return pending;
  const request = (async () => {
    const s = slug?.trim();
    const row = s
      ? await db.restaurant.findUnique({
          where: { slug: s },
          select: { id: true },
        })
      : await db.restaurant.findUnique({
          where: { subdomain: subdomain!.trim() },
          select: { id: true },
        });
    const value = row?.id ?? null;
    restaurantIdCache.set(key, { at: Date.now(), value });
    return value;
  })().finally(() => {
    restaurantIdInflight.delete(key);
  });
  restaurantIdInflight.set(key, request);
  return request;
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

type BrowseDealLink = {
  dealItem?: {
    id: string;
    imageUrl?: string | null;
    hasImage?: boolean;
  };
};

function dealsFromBrowseItem(item: object): BrowseDealLink[] {
  const deals = (item as { dealsFromThis?: BrowseDealLink[] }).dealsFromThis;
  return Array.isArray(deals) ? deals : [];
}

function restaurantMetaPayload<
  T extends {
    id: string;
    slug: string;
    logoUrl?: string | null;
    hasLogo?: boolean;
    mainBannerUrl?: string | null;
    hasMainBanner?: boolean;
    menuBannerUrls?: string[] | null;
    updatedAt?: Date | string | number | null;
  } & RestaurantServiceChargeRow & {
    deliveryEnabled?: boolean;
    dineInEnabled?: boolean;
    cardPaymentsEnabled?: boolean;
  },
>(restaurant: T) {
  return {
    ...restaurant,
    ...publicRestaurantImageUrls(restaurant.slug, {
      logoUrl: restaurant.logoUrl,
      hasLogo: restaurant.hasLogo,
      mainBannerUrl: restaurant.mainBannerUrl,
      hasMainBanner: restaurant.hasMainBanner,
      menuBannerUrls: restaurant.menuBannerUrls,
      updatedAt: restaurant.updatedAt,
    }),
    serviceCharges: parseRestaurantServiceCharges(restaurant),
    fulfillmentSettings: parseRestaurantFulfillmentSettings(restaurant),
  };
}

/** Restaurant branding + category list (no items). */
export async function loadCustomerMenuCategoriesMeta(options: {
  slug?: string | null;
  subdomain?: string | null;
  branchId: string;
}) {
  return withMenuSelectMode(async () => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;
    const branch = await db.branch.findFirst({
      where: {
        id: options.branchId,
        restaurantId: restaurant.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!branch) return null;

    const categories = await db.menuCategory.findMany({
      where: {
        restaurantId: restaurant.id,
        ...CUSTOMER_MENU_CATEGORY_WHERE,
        ...categoryVisibleForBranch(options.branchId),
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        updatedAt: true,
        imageUrl: true,
      },
    });

    const imageQuery = {
      slug: options.slug,
      subdomain: options.subdomain,
    };

    const menus = categories.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: resolveCategoryImageUrl(c, imageQuery),
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
  branchId: string;
  page?: number;
  limit?: number;
}) {
  return withMenuSelectMode(async (mode) => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;
    const branch = await db.branch.findFirst({
      where: {
        id: options.branchId,
        restaurantId: restaurant.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!branch) return null;

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(200, Math.max(1, options.limit ?? 24));
    const skip = (page - 1) * limit;

    const category = await loadSingleCategoryWithLinkedItems({
      restaurantId: restaurant.id,
      categoryId: options.categoryId,
      categorySelect: {
        id: true,
        name: true,
        sortOrder: true,
      },
      itemSelect:
        mode === 'full'
          ? menuItemBrowseListSelect
          : menuItemBrowseListSelectLegacy,
      categoryWhere: {
        ...CUSTOMER_MENU_CATEGORY_WHERE,
        ...categoryVisibleForBranch(options.branchId),
      },
      pagination: { skip, take: limit },
      sellableOnly: true,
    });
    if (!category) return null;

    const imageQuery = {
      slug: options.slug,
      subdomain: options.subdomain,
    };

    const items = presentCustomerBrowseItems(category.items, imageQuery);

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

type BrowseImageQuery = {
  slug?: string | null;
  subdomain?: string | null;
};

function presentCustomerBrowseItems<
  T extends {
    id: string;
    imageUrl?: string | null;
    updatedAt?: Date | string | number | null;
    variations?: Array<{
      id: string;
      imageUrl?: string | null;
      updatedAt?: Date | string | number | null;
    }>;
  },
>(items: T[], imageQuery: BrowseImageQuery) {
  return stampBrowseVariationImages(
    items.map((item) => {
      const mapped = mapBrowseListItem(item, imageQuery);
      const deals = dealsFromBrowseItem(mapped);
      if (deals.length > 0) {
        (mapped as unknown as { dealsFromThis: BrowseDealLink[] }).dealsFromThis =
          deals.map((deal) => {
            const did = deal.dealItem?.id;
            if (!did || !deal.dealItem) return deal;
            const dealUrl = resolveStoredImageUrl(
              deal.dealItem.imageUrl,
              customerMenuItemImageUrl(did, {
                ...imageQuery,
                updatedAt: (deal.dealItem as { updatedAt?: Date }).updatedAt,
              })
            );
            return {
              ...deal,
              dealItem: {
                ...deal.dealItem,
                hasImage: Boolean(dealUrl),
                imageUrl: dealUrl,
              },
            };
          });
      }
      return mapped;
    }),
    imageQuery
  );
}

const BROWSE_CACHE_MS = 60_000;

type CustomerMenuBrowse = NonNullable<
  Awaited<ReturnType<typeof loadCustomerMenuBrowseUncached>>
>;

const browseCache = new Map<
  string,
  { at: number; data: CustomerMenuBrowse }
>();
const browseInflight = new Map<string, Promise<CustomerMenuBrowse | null>>();

function browseCacheKey(options: {
  slug?: string | null;
  subdomain?: string | null;
  branchId: string;
}) {
  return `${options.slug?.trim() ?? ''}|${options.subdomain?.trim() ?? ''}|${options.branchId}`;
}

/** Drop the one-request menu so the next visit reads the saved catalog. */
export function clearCustomerMenuBrowseCache() {
  browseCache.clear();
}

/**
 * Whole storefront menu in one round of queries.
 * Category-by-category loading repeated the restaurant lookup and kept the
 * first screen waiting behind every other category.
 */
export async function loadCustomerMenuBrowse(options: {
  slug?: string | null;
  subdomain?: string | null;
  branchId: string;
}): Promise<CustomerMenuBrowse | null> {
  const key = browseCacheKey(options);
  const hit = browseCache.get(key);
  if (hit && Date.now() - hit.at < BROWSE_CACHE_MS) return hit.data;
  const pending = browseInflight.get(key);
  if (pending) return pending;
  const request = loadCustomerMenuBrowseUncached(options)
    .then((data) => {
      if (data) browseCache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      browseInflight.delete(key);
    });
  browseInflight.set(key, request);
  return request;
}

type CustomerGridRow = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  hasImage: boolean;
  price: number;
  salePrice: number | null;
  updatedAt: string | null;
  variations: Array<{
    id: string;
    name: string;
    title: string;
    swatchHex: string | null;
    priceDelta: number;
    sortOrder: number;
  }>;
  attributeGroups: Array<{ id: string; sourceType: string; required: boolean }>;
  personalizeGroups: Array<{ id: string; options: Array<{ id: string }> }>;
  dealsFromThis: Array<{
    id: string;
    sortOrder: number;
    dealItem: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      hasImage: boolean;
      price: number;
      salePrice: number | null;
    };
  }>;
};

/** One database round trip for the whole grid. Nested Prisma reads were one trip per relation. */
async function loadCustomerGridRows(itemIds: string[]): Promise<CustomerGridRow[]> {
  if (itemIds.length === 0) return [];
  const rows = await db.$queryRaw<Array<{ item: CustomerGridRow }>>`
    SELECT json_build_object(
      'id', i.id,
      'name', i.name,
      'description', i.description,
      'imageUrl', CASE WHEN left(coalesce(i."imageUrl", ''), 4) = 'http' THEN i."imageUrl" ELSE NULL END,
      'hasImage', (i."imageUrl" IS NOT NULL AND btrim(i."imageUrl") <> ''),
      'price', i.price,
      'salePrice', i."salePrice",
      'updatedAt', i."updatedAt",
      'variations', (
        SELECT coalesce(json_agg(json_build_object(
          'id', v.id,
          'name', v.name,
          'title', v.title,
          'swatchHex', v."swatchHex",
          'priceDelta', v."priceDelta",
          'sortOrder', v."sortOrder"
        ) ORDER BY v."sortOrder"), '[]'::json)
        FROM "MenuItemVariation" v
        LEFT JOIN "RestaurantVariation" rv ON rv.id = v."restaurantVariationId"
        WHERE v."menuItemId" = i.id
          AND (v."restaurantVariationId" IS NULL OR rv."isActive" = true)
      ),
      'attributeGroups', (
        SELECT coalesce(json_agg(json_build_object(
          'id', g.id,
          'sourceType', g."sourceType",
          'required', g.required
        ) ORDER BY g."sortOrder"), '[]'::json)
        FROM "MenuItemAttributeGroup" g
        WHERE g."menuItemId" = i.id
      ),
      'personalizeGroups', (
        SELECT coalesce(json_agg(json_build_object(
          'id', p.id,
          'options', coalesce(
            (
              SELECT json_build_array(json_build_object('id', o.id))
              FROM "MenuItemPersonalizeOption" o
              WHERE o."groupId" = p.id
              ORDER BY o."sortOrder"
              LIMIT 1
            ),
            '[]'::json
          )
        ) ORDER BY p."sortOrder"), '[]'::json)
        FROM "MenuItemPersonalizeGroup" p
        WHERE p."menuItemId" = i.id
      ),
      'dealsFromThis', (
        SELECT coalesce(json_agg(json_build_object(
          'id', d.id,
          'sortOrder', d."sortOrder",
          'dealItem', json_build_object(
            'id', di.id,
            'name', di.name,
            'description', di.description,
            'imageUrl', CASE WHEN left(coalesce(di."imageUrl", ''), 4) = 'http' THEN di."imageUrl" ELSE NULL END,
            'hasImage', (di."imageUrl" IS NOT NULL AND btrim(di."imageUrl") <> ''),
            'price', di.price,
            'salePrice', di."salePrice"
          )
        ) ORDER BY d."sortOrder"), '[]'::json)
        FROM "MenuItemDeal" d
        JOIN "MenuItem" di ON di.id = d."dealItemId"
        WHERE d."baseItemId" = i.id
      )
    ) AS item
    FROM "MenuItem" i
    WHERE i.id IN (${Prisma.join(itemIds)})
      AND i."isActive" = true
  `;
  return rows.map((row) => row.item);
}

async function loadCustomerMenuBrowseUncached(options: {
  slug?: string | null;
  subdomain?: string | null;
  branchId: string;
}) {
  return withMenuSelectMode(async () => {
    const restaurant = await resolveRestaurant(options.slug, options.subdomain);
    if (!restaurant) return null;
    const [branch, categories] = await Promise.all([
      db.branch.findFirst({
        where: {
          id: options.branchId,
          restaurantId: restaurant.id,
          isActive: true,
        },
        select: { id: true },
      }),
      db.menuCategory.findMany({
        where: {
          restaurantId: restaurant.id,
          ...CUSTOMER_MENU_CATEGORY_WHERE,
          ...categoryVisibleForBranch(options.branchId),
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          updatedAt: true,
          imageUrl: true,
        },
      }),
    ]);
    if (!branch) return null;

    const imageQuery = {
      slug: options.slug,
      subdomain: options.subdomain,
    };
    const categoryIds = categories.map((category) => category.id);
    const idsByCategory = new Map<string, string[]>();
    const seenByCategory = new Map<string, Set<string>>();
    const pushId = (categoryId: string, itemId: string) => {
      const seen = seenByCategory.get(categoryId) ?? new Set<string>();
      if (seen.has(itemId)) return;
      seen.add(itemId);
      seenByCategory.set(categoryId, seen);
      const list = idsByCategory.get(categoryId) ?? [];
      list.push(itemId);
      idsByCategory.set(categoryId, list);
    };

    if (categoryIds.length > 0) {
      const [links, legacyItems] = await Promise.all([
        db.menuItemCategory.findMany({
          where: {
            categoryId: { in: categoryIds },
            menuItem: { isActive: true },
          },
          orderBy: [...MENU_ITEM_CATEGORY_LINK_DATE_ORDER],
          select: { categoryId: true, menuItemId: true },
        }),
        db.menuItem.findMany({
          where: {
            restaurantId: restaurant.id,
            categoryId: { in: categoryIds },
            isActive: true,
          },
          orderBy: [...MENU_ITEM_DATE_ORDER],
          select: { id: true, categoryId: true },
        }),
      ]);
      for (const link of links) pushId(link.categoryId, link.menuItemId);
      for (const item of legacyItems) pushId(item.categoryId, item.id);
    }

    const pageIds = [...new Set([...idsByCategory.values()].flat())];
    const loaded = await loadCustomerGridRows(pageIds);
    const imageFor = (id: string, imageUrl: string | null, hasImage: boolean) =>
      imageUrl ??
      (hasImage ? customerMenuItemImageUrl(id, { ...imageQuery, updatedAt: null }) : null);
    const byId = new Map(
      loaded.map((item) => [
        item.id,
        {
          ...item,
          imageUrl: imageFor(item.id, item.imageUrl, item.hasImage),
          hasImage: item.hasImage || Boolean(item.imageUrl),
          dealsFromThis: item.dealsFromThis.map((deal) => ({
            ...deal,
            dealItem: {
              ...deal.dealItem,
              imageUrl: imageFor(
                deal.dealItem.id,
                deal.dealItem.imageUrl,
                deal.dealItem.hasImage
              ),
            },
          })),
        },
      ])
    );

    return {
      ...restaurantMetaPayload(restaurant),
      menus: categories.map((category) => ({
        id: category.id,
        name: category.name,
        imageUrl: resolveCategoryImageUrl(category, imageQuery),
        items: (idsByCategory.get(category.id) ?? [])
          .map((id) => byId.get(id))
          .filter((item): item is NonNullable<ReturnType<typeof byId.get>> => Boolean(item)),
      })),
    };
  });
}

const PRODUCT_DETAIL_OPTION_TAKE = 40;
/** Menu saves clear this. Kept for the kiosk visit so a tap does not rebuild the dish. */
const PRODUCT_DETAIL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type CachedProductDetail = {
  expiresAt: number;
  data: unknown;
};

const productDetailCache = new Map<string, CachedProductDetail>();
const productDetailInflight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof loadCustomerMenuProductDetailUncached>>>
>();

function productDetailCacheKey(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
}) {
  return `${options.slug?.trim() ?? ''}|${options.subdomain?.trim() ?? ''}|${options.itemId}`;
}

/** Drop cached customize payloads so recommendation prices refresh after edits. */
export function clearCustomerMenuProductDetailCache(itemId?: string) {
  clearCustomerMenuBrowseCache();
  clearRestaurantMenuConfigureCache();
  if (!itemId) {
    productDetailCache.clear();
    return;
  }
  for (const key of productDetailCache.keys()) {
    if (key.endsWith(`|${itemId}`)) productDetailCache.delete(key);
  }
}

type DetailGroup = AttributeGroupSource & {
  name?: string | null;
  menuItemId?: string;
  linkedCategoryId?: string | null;
  linkedProductId?: string | null;
  linkedProduct?: (AttributeGroupSource['linkedProduct'] & {
    attributeGroups?: DetailGroup[] | null;
  }) | null;
};

function collectLinkedCategoryIdsFromGroups(
  groups: DetailGroup[] | null | undefined
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (list: DetailGroup[] | null | undefined) => {
    for (const group of list ?? []) {
      const categoryId =
        group.linkedCategoryId || group.linkedCategory?.id || '';
      if (categoryId && !seen.has(categoryId)) {
        seen.add(categoryId);
        ids.push(categoryId);
      }
      visit(group.linkedProduct?.attributeGroups ?? undefined);
    }
  };
  visit(groups);
  return ids;
}

function collectLinkedProductIdsFromGroups(
  groups: DetailGroup[] | null | undefined
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (list: DetailGroup[] | null | undefined) => {
    for (const group of list ?? []) {
      const productId = group.linkedProductId || group.linkedProduct?.id || '';
      if (productId && !seen.has(productId)) {
        seen.add(productId);
        ids.push(productId);
      }
      visit(group.linkedProduct?.attributeGroups ?? undefined);
    }
  };
  visit(groups);
  return ids;
}

function pushUniqueItem(
  itemsByCategory: Map<string, Array<Record<string, unknown>>>,
  seenByCategory: Map<string, Set<string>>,
  categoryId: string,
  itemId: string,
  item: Record<string, unknown>
) {
  const seen = seenByCategory.get(categoryId) ?? new Set<string>();
  if (seen.has(itemId)) return;
  seen.add(itemId);
  seenByCategory.set(categoryId, seen);
  const items = itemsByCategory.get(categoryId) ?? [];
  if (items.length >= PRODUCT_DETAIL_OPTION_TAKE) return;
  items.push(item);
  itemsByCategory.set(categoryId, items);
}

async function loadOptionCardsByCategoryIds(
  restaurantId: string,
  categoryIds: string[],
  mode: CustomerMenuSelectMode
) {
  const itemsByCategory = new Map<string, Array<Record<string, unknown>>>();
  if (categoryIds.length === 0) return itemsByCategory;

  const optionSelect = customerProductDetailOptionCardSelect(mode);
  const seenByCategory = new Map<string, Set<string>>();

  // Cap at DB per category — unbounded findMany then truncate was the slow path
  // for large recommendation categories. Load categories one-by-one so progressive
  // hydrate / multi-group callers do not pile parallel category queries.
  for (const categoryId of categoryIds) {
    const [links, legacyItems] = await Promise.all([
      db.menuItemCategory.findMany({
        where: {
          categoryId,
          menuItem: { restaurantId },
        },
        orderBy: [...MENU_ITEM_CATEGORY_LINK_DATE_ORDER],
        take: PRODUCT_DETAIL_OPTION_TAKE,
        select: {
          categoryId: true,
          menuItemId: true,
          menuItem: { select: optionSelect },
        },
      }),
      db.menuItem.findMany({
        where: {
          restaurantId,
          categoryId,
        },
        orderBy: [...MENU_ITEM_DATE_ORDER],
        take: PRODUCT_DETAIL_OPTION_TAKE,
        select: {
          ...optionSelect,
          categoryId: true,
        },
      }),
    ]);

    for (const link of links) {
      pushUniqueItem(
        itemsByCategory,
        seenByCategory,
        link.categoryId,
        link.menuItemId,
        link.menuItem as Record<string, unknown>
      );
    }
    for (const item of legacyItems) {
      pushUniqueItem(
        itemsByCategory,
        seenByCategory,
        item.categoryId,
        item.id,
        item as Record<string, unknown>
      );
    }
  }

  return itemsByCategory;
}

async function loadAttributeGroupsByMenuItemIds(
  menuItemIds: string[],
  mode: CustomerMenuSelectMode
) {
  const groupsByProductId = new Map<string, DetailGroup[]>();
  if (menuItemIds.length === 0) return groupsByProductId;

  const rows = await db.menuItemAttributeGroup.findMany({
    where: { menuItemId: { in: menuItemIds } },
    orderBy: { sortOrder: 'asc' },
    select: {
      menuItemId: true,
      ...customerProductDetailGroupSelect(mode),
    },
  });

  for (const row of rows) {
    const { menuItemId, ...group } = row as DetailGroup & { menuItemId: string };
    const list = groupsByProductId.get(menuItemId) ?? [];
    list.push(group);
    groupsByProductId.set(menuItemId, list);
  }
  return groupsByProductId;
}

function attachNestedProductGroups(
  groups: DetailGroup[] | null | undefined,
  groupsByProductId: Map<string, DetailGroup[]>,
  depth = 0
): DetailGroup[] {
  if (depth > 1) return groups ?? [];
  return (groups ?? []).map((group) => {
    const productId = group.linkedProduct?.id;
    if (!productId || !group.linkedProduct) return group;
    const nested = groupsByProductId.get(productId) ?? [];
    return {
      ...group,
      linkedProduct: {
        ...group.linkedProduct,
        attributeGroups: attachNestedProductGroups(
          nested,
          groupsByProductId,
          depth + 1
        ),
      },
    };
  });
}

function collectCategoryOptionItemIds(
  groups: DetailGroup[] | null | undefined
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const visit = (list: DetailGroup[] | null | undefined) => {
    for (const group of list ?? []) {
      for (const item of group.linkedCategory?.items ?? []) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          ids.push(item.id);
        }
      }
      visit(group.linkedProduct?.attributeGroups ?? undefined);
    }
  };
  visit(groups);
  return ids;
}

function attachCategoryItemsToGroups(
  groups: DetailGroup[] | null | undefined,
  itemsByCategory: Map<string, Array<Record<string, unknown>>>
): DetailGroup[] {
  return (groups ?? []).map((group) => {
    const categoryId = group.linkedCategoryId || group.linkedCategory?.id || '';
    const items = categoryId ? itemsByCategory.get(categoryId) ?? [] : [];
    const linkedProduct = group.linkedProduct
      ? {
          ...group.linkedProduct,
          attributeGroups: attachCategoryItemsToGroups(
            group.linkedProduct.attributeGroups ?? [],
            itemsByCategory
          ),
        }
      : group.linkedProduct;
    const linkedCategory = categoryId
      ? {
          ...(group.linkedCategory ?? {}),
          id: group.linkedCategory?.id ?? categoryId,
          name: group.linkedCategory?.name ?? group.name ?? '',
          items: items as NonNullable<
            AttributeGroupSource['linkedCategory']
          >['items'],
        }
      : group.linkedCategory;
    return {
      ...group,
      linkedProduct,
      linkedCategory,
    };
  });
}

/**
 * Cheap existence flags so the customize sheet knows which option cards open a
 * nested sheet — without loading every option's full recommendation tree up front.
 */
async function stampNeedsNestedSheetFlags(
  itemsByCategory: Map<string, Array<Record<string, unknown>>>
) {
  const ids: string[] = [];
  for (const items of itemsByCategory.values()) {
    for (const item of items) {
      const id = typeof item.id === 'string' ? item.id : '';
      if (id) ids.push(id);
    }
  }
  if (ids.length === 0) return;

  const unique = [...new Set(ids)];
  const [withGroups, withPersonalize] = await Promise.all([
    db.menuItemAttributeGroup.findMany({
      where: { menuItemId: { in: unique } },
      distinct: ['menuItemId'],
      select: { menuItemId: true },
    }),
    db.menuItemPersonalizeGroup.findMany({
      where: { menuItemId: { in: unique } },
      distinct: ['menuItemId'],
      select: { menuItemId: true },
    }),
  ]);

  const needs = new Set<string>();
  for (const row of withGroups) needs.add(row.menuItemId);
  for (const row of withPersonalize) needs.add(row.menuItemId);

  for (const items of itemsByCategory.values()) {
    for (const item of items) {
      const id = typeof item.id === 'string' ? item.id : '';
      if (id && needs.has(id)) item.needsNestedSheet = true;
    }
  }
}

function shellAttributeGroups(rawGroups: DetailGroup[] | null | undefined) {
  return (rawGroups ?? [])
    .map((group) => {
      const categoryId =
        group.linkedCategoryId || group.linkedCategory?.id || '';
      if (group.sourceType === 'PRODUCT') {
        return {
          ...group,
          linkedProduct: group.linkedProduct
            ? {
                ...group.linkedProduct,
                attributeGroups: [],
              }
            : group.linkedProduct,
        };
      }
      if (!categoryId && !group.linkedCategory) return group;
      return {
        ...group,
        linkedCategory: {
          ...(group.linkedCategory ?? {}),
          id: group.linkedCategory?.id ?? categoryId,
          name: group.linkedCategory?.name ?? group.name ?? '',
          items: [],
        },
      };
    })
    .filter((group) => {
      if (group.sourceType === 'PRODUCT') return group.linkedProduct != null;
      const categoryId =
        group.linkedCategoryId || group.linkedCategory?.id || '';
      return Boolean(categoryId);
    });
}

type ImageAttachOpts = {
  slug?: string | null;
  subdomain?: string | null;
  /** When true, use restaurant image URL helpers instead of customer CDN. */
  restaurantImages?: boolean;
};

async function loadProductDetailShellForRestaurant(
  restaurantId: string,
  itemId: string,
  imageOpts?: ImageAttachOpts
) {
  return withMenuSelectMode(async (mode) => {
    const item = await db.menuItem.findFirst({
      where: { id: itemId, restaurantId },
      select: buildCustomerProductDetailShellItemSelect(mode),
    });
    if (!item) return null;

    const rawGroups = (item as { attributeGroups?: DetailGroup[] })
      .attributeGroups;
    const shellGroups = shellAttributeGroups(rawGroups);

    const payload = {
      ...item,
      attributeGroups: shellGroups,
      categoryIds: [item.categoryId],
      progressiveShell: true as const,
    };

    if (imageOpts?.restaurantImages) {
      return attachRestaurantLazyImages(payload);
    }

    return attachCustomerLazyImages(payload, {
      slug: imageOpts?.slug,
      subdomain: imageOpts?.subdomain,
    });
  });
}

async function loadProductDetailGroupForRestaurant(
  restaurantId: string,
  itemId: string,
  groupId: string,
  imageOpts?: ImageAttachOpts
) {
  return withMenuSelectMode(async (mode) => {
    const group = await db.menuItemAttributeGroup.findFirst({
      where: {
        id: groupId,
        menuItemId: itemId,
        menuItem: { restaurantId },
      },
      select: customerProductDetailGroupSelect(mode),
    });
    if (!group) return null;

    const detailGroup = group as DetailGroup;

    if (detailGroup.sourceType === 'PRODUCT') {
      const productId =
        detailGroup.linkedProductId || detailGroup.linkedProduct?.id || '';
      if (!productId || !detailGroup.linkedProduct) {
        return {
          groupId,
          sourceType: 'PRODUCT' as const,
          linkedProduct: detailGroup.linkedProduct ?? null,
          linkedCategory: null,
        };
      }

      // Do not preload nested recommendation trees here — nest sheet opens with
      // progressive shell→category cards for this linked product on demand.
      const [hasAttrGroups, hasPersonalize] = await Promise.all([
        db.menuItemAttributeGroup
          .findFirst({
            where: { menuItemId: productId },
            select: { id: true },
          })
          .then((row) => Boolean(row)),
        db.menuItemPersonalizeGroup
          .findFirst({
            where: { menuItemId: productId },
            select: { id: true },
          })
          .then((row) => Boolean(row)),
      ]);

      const linkedProduct = {
        ...detailGroup.linkedProduct,
        attributeGroups: [],
        needsNestedSheet: hasAttrGroups || hasPersonalize,
      };

      const wrapped = imageOpts?.restaurantImages
        ? attachRestaurantLazyImages({ linkedProduct })
        : attachCustomerLazyImages(
            { linkedProduct },
            {
              slug: imageOpts?.slug,
              subdomain: imageOpts?.subdomain,
            }
          );
      const withInline = wrapped as { linkedProduct?: typeof linkedProduct };

      return {
        groupId,
        sourceType: 'PRODUCT' as const,
        linkedProduct: withInline.linkedProduct ?? linkedProduct,
        linkedCategory: null,
      };
    }

    const categoryId =
      detailGroup.linkedCategoryId || detailGroup.linkedCategory?.id || '';
    if (!categoryId) {
      return {
        groupId,
        sourceType: 'CATEGORY' as const,
        linkedCategory: detailGroup.linkedCategory
          ? { ...detailGroup.linkedCategory, items: [] }
          : null,
        linkedProduct: null,
      };
    }

    // Option cards for this recommendation category only — no nested trees.
    const itemsByCategory = await loadOptionCardsByCategoryIds(
      restaurantId,
      [categoryId],
      mode
    );
    await stampNeedsNestedSheetFlags(itemsByCategory);
    const items = itemsByCategory.get(categoryId) ?? [];
    const linkedCategory = {
      ...(detailGroup.linkedCategory ?? {}),
      id: detailGroup.linkedCategory?.id ?? categoryId,
      name: detailGroup.linkedCategory?.name ?? detailGroup.name ?? '',
      items,
    };

    const wrapped = imageOpts?.restaurantImages
      ? attachRestaurantLazyImages({ linkedCategory })
      : attachCustomerLazyImages(
          { linkedCategory },
          {
            slug: imageOpts?.slug,
            subdomain: imageOpts?.subdomain,
          }
        );
    const withInline = wrapped as { linkedCategory?: typeof linkedCategory };

    return {
      groupId,
      sourceType: 'CATEGORY' as const,
      linkedCategory: withInline.linkedCategory ?? linkedCategory,
      linkedProduct: null,
    };
  });
}

/** Fast customize open: group metadata only; option cards hydrate per group. */
export async function loadCustomerMenuProductDetailShell(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
}) {
  const restaurantId = await resolveRestaurantId(
    options.slug,
    options.subdomain
  );
  if (!restaurantId) return null;
  return loadProductDetailShellForRestaurant(restaurantId, options.itemId, {
    slug: options.slug,
    subdomain: options.subdomain,
  });
}

const RESTAURANT_CONFIGURE_MS = 10 * 60 * 1000;
const restaurantConfigureCache = new Map<
  string,
  { at: number; data: unknown }
>();
const restaurantConfigureInflight = new Map<string, Promise<unknown>>();

export function clearRestaurantMenuConfigureCache() {
  restaurantConfigureCache.clear();
}

function stampConfiguredImages(node: unknown, fallbackItemId?: string): void {
  if (!node || typeof node !== 'object') return;
  const row = node as {
    id?: string;
    imageUrl?: string | null;
    hasImage?: boolean;
    variations?: Array<{ imageUrl?: string | null; hasImage?: boolean }>;
    attributeGroups?: unknown[];
    linkedCategory?: { items?: unknown[] } | null;
    linkedProduct?: unknown;
    dealsFromThis?: Array<{ dealItem?: unknown }>;
  };
  if (row.id && row.hasImage && !row.imageUrl) {
    row.imageUrl = restaurantMenuItemImageUrl(row.id);
  }
  const imageOwner = row.id ?? fallbackItemId;
  for (const variation of row.variations ?? []) {
    if (imageOwner && variation.hasImage && !variation.imageUrl) {
      variation.imageUrl = restaurantMenuItemImageUrl(imageOwner);
    }
  }
  for (const group of row.attributeGroups ?? []) {
    stampConfiguredImages(group, row.id);
  }
  for (const item of row.linkedCategory?.items ?? []) {
    stampConfiguredImages(item);
  }
  if (row.linkedProduct) stampConfiguredImages(row.linkedProduct);
  for (const deal of row.dealsFromThis ?? []) {
    if (deal.dealItem) stampConfiguredImages(deal.dealItem);
  }
}

/**
 * POS customize in one database round trip: sizes, personalize, and every
 * recommendation list. The old path paid a full query per group.
 */
async function loadRestaurantMenuProductConfiguredUncached(options: {
  restaurantId: string;
  itemId: string;
}) {
  const rows = await db.$queryRaw<Array<{ item: Record<string, unknown> | null }>>`
    SELECT json_build_object(
      'id', i.id,
      'name', i.name,
      'description', i.description,
      'imageUrl', CASE WHEN left(coalesce(i."imageUrl", ''), 4) = 'http' THEN i."imageUrl" ELSE NULL END,
      'hasImage', (i."imageUrl" IS NOT NULL AND btrim(i."imageUrl") <> ''),
      'price', i.price,
      'salePrice', i."salePrice",
      'updatedAt', i."updatedAt",
      'categoryId', i."categoryId",
      'categoryIds', json_build_array(i."categoryId"),
      'variations', (
        SELECT coalesce(json_agg(json_build_object(
          'id', v.id,
          'name', v.name,
          'title', v.title,
          'imageUrl', CASE WHEN left(coalesce(v."imageUrl", ''), 4) = 'http' THEN v."imageUrl" ELSE NULL END,
          'hasImage', (v."imageUrl" IS NOT NULL AND btrim(v."imageUrl") <> ''),
          'swatchHex', v."swatchHex",
          'priceDelta', v."priceDelta",
          'sortOrder', v."sortOrder",
          'restaurantVariationId', v."restaurantVariationId",
          'restaurantVariation', CASE WHEN rv.id IS NULL THEN NULL ELSE json_build_object(
            'id', rv.id,
            'name', rv.name,
            'shortLabel', rv."shortLabel"
          ) END
        ) ORDER BY v."sortOrder"), '[]'::json)
        FROM "MenuItemVariation" v
        LEFT JOIN "RestaurantVariation" rv ON rv.id = v."restaurantVariationId"
        WHERE v."menuItemId" = i.id
          AND (v."restaurantVariationId" IS NULL OR rv."isActive" = true)
      ),
      'personalizeGroups', (
        SELECT coalesce(json_agg(json_build_object(
          'id', pg.id,
          'parentName', pg."parentName",
          'maxItems', pg."maxItems",
          'sortOrder', pg."sortOrder",
          'options', (
            SELECT coalesce(json_agg(json_build_object(
              'id', po.id,
              'name', po.name,
              'sortOrder', po."sortOrder"
            ) ORDER BY po."sortOrder"), '[]'::json)
            FROM "MenuItemPersonalizeOption" po
            WHERE po."groupId" = pg.id
          )
        ) ORDER BY pg."sortOrder"), '[]'::json)
        FROM "MenuItemPersonalizeGroup" pg
        WHERE pg."menuItemId" = i.id
      ),
      'attributeGroups', (
        SELECT coalesce(json_agg(json_build_object(
          'id', g.id,
          'name', g.name,
          'selectionType', g."selectionType",
          'sourceType', g."sourceType",
          'multipleMode', g."multipleMode",
          'freeQuantity', g."freeQuantity",
          'categoryDiscountPercent', g."categoryDiscountPercent",
          'categoryExtraCostPercent', g."categoryExtraCostPercent",
          'productOverrides', g."productOverrides",
          'required', g.required,
          'minItems', g."minItems",
          'maxItems', g."maxItems",
          'sortOrder', g."sortOrder",
          'productCategoryIds', g."productCategoryIds",
          'defaultLinkedMenuItemId', g."defaultLinkedMenuItemId",
          'defaultLinkedRestaurantVariationId', g."defaultLinkedRestaurantVariationId",
          'includeDefaultLinkedVariationPrice', g."includeDefaultLinkedVariationPrice",
          'useVariationPricing', g."useVariationPricing",
          'linkedCategoryId', g."linkedCategoryId",
          'linkedProductId', g."linkedProductId",
          'defaultLinkedRestaurantVariation', (
            SELECT json_build_object('id', drv.id, 'name', drv.name, 'shortLabel', drv."shortLabel")
            FROM "RestaurantVariation" drv
            WHERE drv.id = g."defaultLinkedRestaurantVariationId"
          ),
          'variationLimits', (
            SELECT coalesce(json_agg(json_build_object(
              'variationId', vl."variationId",
              'minItems', vl."minItems",
              'maxItems', vl."maxItems"
            )), '[]'::json)
            FROM "MenuItemAttributeGroupVariationLimit" vl
            WHERE vl."groupId" = g.id
          ),
          'linkedProduct', CASE WHEN g."sourceType"::text = 'PRODUCT' THEN (
            SELECT json_build_object(
              'id', lp.id,
              'name', lp.name,
              'imageUrl', CASE WHEN left(coalesce(lp."imageUrl", ''), 4) = 'http' THEN lp."imageUrl" ELSE NULL END,
              'hasImage', (lp."imageUrl" IS NOT NULL AND btrim(lp."imageUrl") <> ''),
              'price', lp.price,
              'salePrice', lp."salePrice",
              'categoryId', lp."categoryId",
              'needsNestedSheet', (
                EXISTS (SELECT 1 FROM "MenuItemAttributeGroup" ng WHERE ng."menuItemId" = lp.id)
                OR EXISTS (SELECT 1 FROM "MenuItemPersonalizeGroup" np WHERE np."menuItemId" = lp.id)
              ),
              'variations', (
                SELECT coalesce(json_agg(json_build_object(
                  'id', lv.id,
                  'name', lv.name,
                  'title', lv.title,
                  'swatchHex', lv."swatchHex",
                  'priceDelta', lv."priceDelta",
                  'sortOrder', lv."sortOrder",
                  'restaurantVariationId', lv."restaurantVariationId"
                ) ORDER BY lv."sortOrder"), '[]'::json)
                FROM "MenuItemVariation" lv
                LEFT JOIN "RestaurantVariation" lrv ON lrv.id = lv."restaurantVariationId"
                WHERE lv."menuItemId" = lp.id
                  AND (lv."restaurantVariationId" IS NULL OR lrv."isActive" = true)
              )
            )
            FROM "MenuItem" lp
            WHERE lp.id = g."linkedProductId" AND lp."restaurantId" = ${options.restaurantId}
          ) ELSE NULL END,
          'linkedCategory', CASE WHEN g."sourceType"::text = 'CATEGORY' AND g."linkedCategoryId" IS NOT NULL THEN json_build_object(
            'id', c.id,
            'name', c.name,
            'items', (
              SELECT coalesce(json_agg(card.item ORDER BY card.ord), '[]'::json)
              FROM (
                SELECT src.ord, json_build_object(
                  'id', mi.id,
                  'name', mi.name,
                  'imageUrl', CASE WHEN left(coalesce(mi."imageUrl", ''), 4) = 'http' THEN mi."imageUrl" ELSE NULL END,
                  'hasImage', (mi."imageUrl" IS NOT NULL AND btrim(mi."imageUrl") <> ''),
                  'price', mi.price,
                  'salePrice', mi."salePrice",
                  'needsNestedSheet', (
                    EXISTS (SELECT 1 FROM "MenuItemAttributeGroup" ng WHERE ng."menuItemId" = mi.id)
                    OR EXISTS (SELECT 1 FROM "MenuItemPersonalizeGroup" np WHERE np."menuItemId" = mi.id)
                  ),
                  'variations', (
                    SELECT coalesce(json_agg(json_build_object(
                      'id', ov.id,
                      'name', ov.name,
                      'title', ov.title,
                      'swatchHex', ov."swatchHex",
                      'priceDelta', ov."priceDelta",
                      'sortOrder', ov."sortOrder",
                      'restaurantVariationId', ov."restaurantVariationId"
                    ) ORDER BY ov."sortOrder"), '[]'::json)
                    FROM "MenuItemVariation" ov
                    LEFT JOIN "RestaurantVariation" orv ON orv.id = ov."restaurantVariationId"
                    WHERE ov."menuItemId" = mi.id
                      AND (ov."restaurantVariationId" IS NULL OR orv."isActive" = true)
                  )
                ) AS item
                FROM (
                  SELECT picked."menuItemId", picked.ord
                  FROM (
                    SELECT ranked."menuItemId", ranked.ord
                    FROM (
                      SELECT link."menuItemId",
                        row_number() OVER (
                          ORDER BY link.legacy, link."sortOrder", link."createdAt", link.item_created
                        ) AS ord
                      FROM (
                        SELECT l."menuItemId", l."sortOrder", l."createdAt", mi_link."createdAt" AS item_created, 0 AS legacy
                        FROM "MenuItemCategory" l
                        JOIN "MenuItem" mi_link ON mi_link.id = l."menuItemId" AND mi_link."isActive" = true
                        WHERE l."categoryId" = g."linkedCategoryId"
                        UNION ALL
                        SELECT mi_legacy.id, 0, mi_legacy."createdAt", mi_legacy."createdAt", 1
                        FROM "MenuItem" mi_legacy
                        WHERE mi_legacy."categoryId" = g."linkedCategoryId"
                          AND mi_legacy."restaurantId" = ${options.restaurantId}
                          AND mi_legacy."isActive" = true
                          AND NOT EXISTS (
                            SELECT 1 FROM "MenuItemCategory" l2
                            WHERE l2."categoryId" = g."linkedCategoryId"
                              AND l2."menuItemId" = mi_legacy.id
                          )
                      ) link
                    ) ranked
                    WHERE ranked.ord <= 40
                  ) picked
                ) src
                JOIN "MenuItem" mi ON mi.id = src."menuItemId"
              ) card
            )
          ) ELSE NULL END
        ) ORDER BY g."sortOrder"), '[]'::json)
        FROM "MenuItemAttributeGroup" g
        LEFT JOIN "MenuCategory" c ON c.id = g."linkedCategoryId"
        WHERE g."menuItemId" = i.id
      )
    ) AS item
    FROM "MenuItem" i
    WHERE i.id = ${options.itemId}
      AND i."restaurantId" = ${options.restaurantId}
    LIMIT 1
  `;
  const item = rows[0]?.item;
  if (!item) return null;
  const groups = Array.isArray(item.attributeGroups) ? item.attributeGroups : [];
  item.attributeGroups = groups.filter((group) => {
    if (!group || typeof group !== 'object') return false;
    const row = group as {
      sourceType?: string;
      linkedProduct?: unknown;
      linkedCategoryId?: string | null;
      linkedCategory?: { id?: string } | null;
    };
    if (row.sourceType === 'PRODUCT') return row.linkedProduct != null;
    return Boolean(row.linkedCategoryId || row.linkedCategory?.id);
  });
  stampConfiguredImages(item);
  return item;
}

/** Sizes and recommendations for one POS dish, shared across taps in this process. */
export async function loadRestaurantMenuProductConfigured(options: {
  restaurantId: string;
  itemId: string;
}) {
  const key = `${options.restaurantId}|${options.itemId}`;
  const hit = restaurantConfigureCache.get(key);
  if (hit && Date.now() - hit.at < RESTAURANT_CONFIGURE_MS) return hit.data;
  const pending = restaurantConfigureInflight.get(key);
  if (pending) return pending;
  const request = loadRestaurantMenuProductConfiguredUncached(options)
    .then((data) => {
      if (data) restaurantConfigureCache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      restaurantConfigureInflight.delete(key);
    });
  restaurantConfigureInflight.set(key, request);
  return request;
}

/** POS / authenticated restaurant progressive shell. */
export async function loadRestaurantMenuProductDetailShell(options: {
  restaurantId: string;
  itemId: string;
}) {
  return loadProductDetailShellForRestaurant(
    options.restaurantId,
    options.itemId,
    { restaurantImages: true }
  );
}

/**
 * Hydrate one recommendation group's option cards for progressive customize.
 * Nested option trees stay deferred until nest-sheet open.
 */
export async function loadCustomerMenuProductDetailGroup(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
  groupId: string;
}) {
  const restaurantId = await resolveRestaurantId(
    options.slug,
    options.subdomain
  );
  if (!restaurantId) return null;
  return loadProductDetailGroupForRestaurant(
    restaurantId,
    options.itemId,
    options.groupId,
    { slug: options.slug, subdomain: options.subdomain }
  );
}

/** POS / authenticated restaurant progressive group hydrate. */
export async function loadRestaurantMenuProductDetailGroup(options: {
  restaurantId: string;
  itemId: string;
  groupId: string;
}) {
  return loadProductDetailGroupForRestaurant(
    options.restaurantId,
    options.itemId,
    options.groupId,
    { restaurantImages: true }
  );
}

async function loadCustomerMenuProductDetailUncached(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
}) {
  return withMenuSelectMode(async (mode) => {
    const restaurantId = await resolveRestaurantId(
      options.slug,
      options.subdomain
    );
    if (!restaurantId) return null;

    const item = await db.menuItem.findFirst({
      where: {
        id: options.itemId,
        restaurantId,
      },
      select: buildCustomerProductDetailItemSelect(mode),
    });
    if (!item) return null;

    const rawGroups = (item as { attributeGroups?: DetailGroup[] })
      .attributeGroups;
    const parentProductIds = collectLinkedProductIdsFromGroups(rawGroups);
    const parentCategoryIds = collectLinkedCategoryIdsFromGroups(rawGroups);

    // Fast path: group rules + option cards only. Nested option trees load
    // on demand when the guest opens a nested recommendation sheet.
    // Load product nests and category cards sequentially (not parallel storms).
    const nestedByProduct = await loadAttributeGroupsByMenuItemIds(
      parentProductIds,
      mode
    );
    const parentItemsByCategory = await loadOptionCardsByCategoryIds(
      restaurantId,
      parentCategoryIds,
      mode
    );

    const deeperProductIds = collectLinkedProductIdsFromGroups(
      [...nestedByProduct.values()].flat()
    ).filter((id) => !parentProductIds.includes(id));

    if (deeperProductIds.length > 0) {
      const deeper = await loadAttributeGroupsByMenuItemIds(
        deeperProductIds,
        mode
      );
      for (const [id, groups] of deeper) {
        nestedByProduct.set(id, groups);
      }
    }

    const groupsWithNested = attachNestedProductGroups(
      rawGroups,
      nestedByProduct
    );
    const allCategoryIds = collectLinkedCategoryIdsFromGroups(groupsWithNested);
    const extraCategoryIds = allCategoryIds.filter(
      (id) => !parentCategoryIds.includes(id)
    );

    const extraItemsByCategory =
      extraCategoryIds.length > 0
        ? await loadOptionCardsByCategoryIds(
            restaurantId,
            extraCategoryIds,
            mode
          )
        : new Map<string, Array<Record<string, unknown>>>();

    const itemsByCategory = new Map(parentItemsByCategory);
    for (const [categoryId, items] of extraItemsByCategory) {
      itemsByCategory.set(categoryId, items);
    }

    // Flags only — nested trees load on sheet open via fetchOptionNestedSheetPayload.
    // Pre-hydrating every flagged option made customize 10–40s+ on large menus.
    await stampNeedsNestedSheetFlags(itemsByCategory);

    const hydratedGroups = attachCategoryItemsToGroups(
      groupsWithNested,
      itemsByCategory
    ).filter((group) => {
      if (group.sourceType === 'PRODUCT') return group.linkedProduct != null;
      return categoryHasProducts(group.linkedCategory ?? undefined);
    });

    const withInline = attachCustomerLazyImages(
      {
        ...item,
        attributeGroups: hydratedGroups,
      },
      {
        slug: options.slug,
        subdomain: options.subdomain,
      }
    );

    return {
      ...withInline,
      categoryIds: [item.categoryId],
    };
  });
}

/** Customize sheet: slim group metadata + option cards (nested trees on demand). */
export async function loadCustomerMenuProductDetail(options: {
  slug?: string | null;
  subdomain?: string | null;
  itemId: string;
  /** Skip in-memory cache so recommendation / add-on prices stay current. */
  skipCache?: boolean;
}) {
  const key = productDetailCacheKey(options);
  if (!options.skipCache) {
    const cached = productDetailCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as Awaited<
        ReturnType<typeof loadCustomerMenuProductDetailUncached>
      >;
    }
    const inflight = productDetailInflight.get(key);
    if (inflight) return inflight;
  } else {
    productDetailCache.delete(key);
  }

  const request = loadCustomerMenuProductDetailUncached(options)
    .then((data) => {
      if (data && !options.skipCache) {
        productDetailCache.set(key, {
          expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_TTL_MS,
          data,
        });
      }
      return data;
    })
    .finally(() => {
      productDetailInflight.delete(key);
    });

  if (!options.skipCache) {
    productDetailInflight.set(key, request);
  }
  return request;
}

