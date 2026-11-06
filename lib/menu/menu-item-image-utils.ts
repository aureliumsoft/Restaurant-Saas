import { db } from '@/lib/db';
import { withImageCacheBust } from '@/lib/image-cache-bust';
import { resolveStoredImageUrl } from '@/lib/resolve-stored-image-url';
import { customerCategoryImageUrl } from '@/lib/stored-image-response';
import { pathSegmentId } from '@/lib/url-id-path';

export type MenuItemImageMeta = {
  hasImage: boolean;
  updatedAt: number | null;
};

export async function hasImageByMenuItemIds(
  ids: string[]
): Promise<Map<string, boolean>> {
  const meta = await imageMetaByMenuItemIds(ids);
  const map = new Map<string, boolean>();
  for (const id of ids) {
    map.set(id, meta.get(id)?.hasImage ?? false);
  }
  return map;
}

export async function imageMetaByMenuItemIds(
  ids: string[]
): Promise<Map<string, MenuItemImageMeta>> {
  const map = new Map<string, MenuItemImageMeta>();
  if (ids.length === 0) return map;

  for (const id of ids) {
    map.set(id, { hasImage: false, updatedAt: null });
  }

  // Select only id + updatedAt — never pull imageUrl blobs just to test presence.
  const rows = await db.menuItem.findMany({
    where: {
      id: { in: ids },
      AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
    },
    select: { id: true, updatedAt: true },
  });

  for (const row of rows) {
    map.set(row.id, {
      hasImage: true,
      updatedAt: row.updatedAt.getTime(),
    });
  }
  return map;
}

export function customerMenuItemImageUrl(
  itemId: string,
  query: {
    slug?: string | null;
    subdomain?: string | null;
    updatedAt?: Date | string | number | null;
  }
): string {
  const params = new URLSearchParams();
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  const qs = params.toString();
  return withImageCacheBust(
    `/api/customer/menu/items/${encodeURIComponent(pathSegmentId(itemId))}/image${qs ? `?${qs}` : ''}`,
    query.updatedAt
  );
}

export function restaurantMenuItemImageUrl(
  itemId: string,
  updatedAt?: Date | string | number | null
): string {
  return withImageCacheBust(
    `/api/restaurant/menu/items/${encodeURIComponent(pathSegmentId(itemId))}/image`,
    updatedAt
  );
}

export function restaurantMenuCategoryImageUrl(
  categoryId: string,
  updatedAt?: Date | string | number | null
): string {
  return withImageCacheBust(
    `/api/restaurant/menu/categories/${encodeURIComponent(pathSegmentId(categoryId))}/image`,
    updatedAt
  );
}

export type CategoryImageMeta = {
  hasImage: boolean;
  updatedAt: number | null;
};

/** Presence only — never SELECT imageUrl blobs just to test existence. */
export async function imageMetaByCategoryIds(
  ids: string[]
): Promise<Map<string, CategoryImageMeta>> {
  const map = new Map<string, CategoryImageMeta>();
  if (ids.length === 0) return map;

  for (const id of ids) {
    map.set(id, { hasImage: false, updatedAt: null });
  }

  const rows = await db.menuCategory.findMany({
    where: {
      id: { in: ids },
      AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
    },
    select: { id: true, updatedAt: true },
  });

  for (const row of rows) {
    map.set(row.id, {
      hasImage: true,
      updatedAt: row.updatedAt.getTime(),
    });
  }
  return map;
}

export type RestaurantBrandingFlags = {
  hasLogo: boolean;
  hasMainBanner: boolean;
};

/** Presence flags for restaurant media without loading base64 columns. */
export async function restaurantBrandingFlags(
  restaurantId: string
): Promise<RestaurantBrandingFlags> {
  const [logoRow, bannerRow] = await Promise.all([
    db.restaurant.findFirst({
      where: {
        id: restaurantId,
        AND: [{ logoUrl: { not: null } }, { NOT: { logoUrl: '' } }],
      },
      select: { id: true },
    }),
    db.restaurant.findFirst({
      where: {
        id: restaurantId,
        AND: [{ mainBannerUrl: { not: null } }, { NOT: { mainBannerUrl: '' } }],
      },
      select: { id: true },
    }),
  ]);
  return {
    hasLogo: Boolean(logoRow),
    hasMainBanner: Boolean(bannerRow),
  };
}

export type VariationImageMeta = {
  hasImage: boolean;
  updatedAt: number | null;
};

export async function hasImageByVariationIds(
  ids: string[]
): Promise<Map<string, boolean>> {
  const meta = await imageMetaByVariationIds(ids);
  const map = new Map<string, boolean>();
  for (const id of ids) {
    map.set(id, meta.get(id)?.hasImage ?? false);
  }
  return map;
}

export async function imageMetaByVariationIds(
  ids: string[]
): Promise<Map<string, VariationImageMeta>> {
  const map = new Map<string, VariationImageMeta>();
  if (ids.length === 0) return map;

  for (const id of ids) {
    map.set(id, { hasImage: false, updatedAt: null });
  }

  const rows = await db.menuItemVariation.findMany({
    where: {
      id: { in: ids },
      AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
    },
    select: { id: true, updatedAt: true },
  });

  for (const row of rows) {
    map.set(row.id, {
      hasImage: true,
      updatedAt: row.updatedAt.getTime(),
    });
  }
  return map;
}

export function customerMenuVariationImageUrl(
  itemId: string,
  variationId: string,
  query: {
    slug?: string | null;
    subdomain?: string | null;
    updatedAt?: Date | string | number | null;
  }
): string {
  const params = new URLSearchParams();
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  const qs = params.toString();
  return withImageCacheBust(
    `/api/customer/menu/items/${encodeURIComponent(pathSegmentId(itemId))}/variations/${encodeURIComponent(pathSegmentId(variationId))}/image${qs ? `?${qs}` : ''}`,
    query.updatedAt
  );
}

export function mapBrowseListItem<
  T extends { id: string; imageUrl?: string | null; updatedAt?: Date | string | number | null },
>(
  item: T,
  query?: {
    slug?: string | null;
    subdomain?: string | null;
    /** staff dashboard / POS proxy instead of customer */
    restaurantProxy?: boolean;
  }
): Omit<T, 'imageUrl'> & { hasImage: boolean; imageUrl: string | null } {
  const { imageUrl: stored, ...rest } = item;
  const proxy = query?.restaurantProxy
    ? restaurantMenuItemImageUrl(item.id, item.updatedAt)
    : customerMenuItemImageUrl(item.id, {
        slug: query?.slug,
        subdomain: query?.subdomain,
        updatedAt: item.updatedAt,
      });
  const imageUrl = resolveStoredImageUrl(stored, proxy);
  return {
    ...rest,
    hasImage: Boolean(imageUrl),
    imageUrl,
  };
}

/** Normalize variation thumbs from selected imageUrl (CDN) or legacy proxy. */
export function stampBrowseVariationImages<
  T extends {
    id: string;
    updatedAt?: Date | string | number | null;
    variations?: Array<{
      id: string;
      hasImage?: boolean;
      imageUrl?: string | null;
      updatedAt?: Date | string | number | null;
    }>;
  },
>(
  items: T[],
  query: { slug?: string | null; subdomain?: string | null }
): T[] {
  for (const item of items) {
    for (const variation of item.variations ?? []) {
      const proxy = customerMenuVariationImageUrl(item.id, variation.id, {
        ...query,
        updatedAt: variation.updatedAt ?? item.updatedAt,
      });
      const imageUrl = resolveStoredImageUrl(variation.imageUrl, proxy);
      variation.hasImage = Boolean(imageUrl);
      variation.imageUrl = imageUrl;
    }
  }
  return items;
}

type LinkedMenuNode = {
  id?: string;
  hasImage?: boolean;
  imageUrl?: string | null;
  variations?: Array<{
    id?: string;
    hasImage?: boolean;
    imageUrl?: string | null;
  }> | null;
  attributeGroups?: Array<{
    linkedProduct?: LinkedMenuNode | null;
    linkedCategory?: {
      items?: LinkedMenuNode[] | null;
      itemLinks?: Array<{ menuItem?: LinkedMenuNode | null }> | null;
    } | null;
  }> | null;
  dealsFromThis?: Array<{
    dealItem?: LinkedMenuNode | null;
  }> | null;
  offersFromThis?: Array<{
    offeredItem?: LinkedMenuNode | null;
  }> | null;
};

function applyInlineImageFlags(
  node: LinkedMenuNode,
  query: { slug?: string | null; subdomain?: string | null } | null,
  restaurantProxy: boolean
) {
  if (node.id) {
    const updatedAt = (node as { updatedAt?: Date | string | number | null })
      .updatedAt;
    const proxy = restaurantProxy
      ? restaurantMenuItemImageUrl(node.id, updatedAt)
      : customerMenuItemImageUrl(node.id, { ...(query ?? {}), updatedAt });
    const imageUrl = resolveStoredImageUrl(node.imageUrl, proxy);
    node.hasImage = Boolean(imageUrl);
    node.imageUrl = imageUrl;
    for (const variation of node.variations ?? []) {
      if (!variation.id) continue;
      if (restaurantProxy) {
        // Staff variation image proxy is not wired; reuse product thumb when present.
        const vUrl = resolveStoredImageUrl(variation.imageUrl, imageUrl);
        variation.hasImage = Boolean(vUrl);
        variation.imageUrl = vUrl;
      } else {
        const vProxy = customerMenuVariationImageUrl(node.id, variation.id, {
          ...(query ?? {}),
          updatedAt,
        });
        const vUrl = resolveStoredImageUrl(variation.imageUrl, vProxy);
        variation.hasImage = Boolean(vUrl);
        variation.imageUrl = vUrl;
      }
    }
  }
  for (const group of node.attributeGroups ?? []) {
    if (group.linkedProduct) {
      applyInlineImageFlags(group.linkedProduct, query, restaurantProxy);
    }
    for (const item of group.linkedCategory?.items ?? []) {
      applyInlineImageFlags(item, query, restaurantProxy);
    }
    for (const link of group.linkedCategory?.itemLinks ?? []) {
      if (link.menuItem) {
        applyInlineImageFlags(link.menuItem, query, restaurantProxy);
      }
    }
  }
  for (const deal of node.dealsFromThis ?? []) {
    if (deal.dealItem) {
      applyInlineImageFlags(deal.dealItem, query, restaurantProxy);
    }
  }
  for (const offer of node.offersFromThis ?? []) {
    if (offer.offeredItem) {
      applyInlineImageFlags(offer.offeredItem, query, restaurantProxy);
    }
  }
}

/**
 * Prefer selected CDN `imageUrl` values; fall back to `/image` proxy only for
 * legacy base64. Sync — no extra presence queries.
 */
export function attachRestaurantLazyImages<T>(item: T): T {
  applyInlineImageFlags(item as T & LinkedMenuNode, null, true);
  return item;
}

/** Prefer selected CDN URLs on customer menu trees (sync). */
export function attachCustomerLazyImages<T>(
  item: T,
  query: { slug?: string | null; subdomain?: string | null }
): T {
  applyInlineImageFlags(item as T & LinkedMenuNode, query, false);
  return item;
}

/** Customize first paint: keep CDN URLs when selected, else proxy. */
export function stampCustomerDetailLazyUrls<T>(
  item: T,
  query: { slug?: string | null; subdomain?: string | null }
): T {
  applyInlineImageFlags(item as T & LinkedMenuNode, query, false);
  return item;
}

/** Resolve a category image from selected column or legacy proxy. */
export function resolveCategoryImageUrl(
  category: {
    id: string;
    imageUrl?: string | null;
    updatedAt?: Date | string | number | null;
  },
  query: {
    slug?: string | null;
    subdomain?: string | null;
    restaurantProxy?: boolean;
  }
): string | null {
  const proxy = query.restaurantProxy
    ? restaurantMenuCategoryImageUrl(category.id, category.updatedAt)
    : customerCategoryImageUrl(category.id, {
        slug: query.slug,
        subdomain: query.subdomain,
        updatedAt: category.updatedAt,
      });
  return resolveStoredImageUrl(category.imageUrl, proxy);
}
