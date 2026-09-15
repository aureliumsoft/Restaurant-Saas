import { db } from '@/lib/db';
import { withImageCacheBust } from '@/lib/image-cache-bust';
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
  T extends { id: string; imageUrl?: string | null },
>(
  item: T,
  hasImage: boolean,
  imageUrl: string | null
): Omit<T, 'imageUrl'> & { hasImage: boolean; imageUrl: string | null } {
  const { imageUrl: _drop, ...rest } = item;
  return {
    ...rest,
    hasImage,
    imageUrl,
  };
}

export async function stampBrowseVariationImages<
  T extends {
    id: string;
    variations?: Array<{ id: string; hasImage?: boolean; imageUrl?: string | null }>;
  },
>(
  items: T[],
  query: { slug?: string | null; subdomain?: string | null }
): Promise<T[]> {
  const ids = items.flatMap((item) => (item.variations ?? []).map((v) => v.id));
  const meta = await imageMetaByVariationIds(ids);
  for (const item of items) {
    for (const variation of item.variations ?? []) {
      const row = meta.get(variation.id);
      const hasImage = row?.hasImage ?? false;
      variation.hasImage = hasImage;
      variation.imageUrl = hasImage
        ? customerMenuVariationImageUrl(item.id, variation.id, {
            ...query,
            updatedAt: row?.updatedAt,
          })
        : null;
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
    linkedCategory?: { items?: LinkedMenuNode[] | null } | null;
  }> | null;
  dealsFromThis?: Array<{
    dealItem?: LinkedMenuNode | null;
  }> | null;
  offersFromThis?: Array<{
    offeredItem?: LinkedMenuNode | null;
  }> | null;
};

function collectLinkedMenuItemIds(node: LinkedMenuNode | null | undefined, ids: Set<string>) {
  if (!node?.id) return;
  ids.add(node.id);
  for (const group of node.attributeGroups ?? []) {
    collectLinkedMenuItemIds(group.linkedProduct, ids);
    for (const item of group.linkedCategory?.items ?? []) {
      collectLinkedMenuItemIds(item, ids);
    }
  }
  for (const deal of node.dealsFromThis ?? []) {
    collectLinkedMenuItemIds(deal.dealItem, ids);
  }
  for (const offer of node.offersFromThis ?? []) {
    collectLinkedMenuItemIds(offer.offeredItem, ids);
  }
}

function collectVariationRefs(
  node: LinkedMenuNode | null | undefined,
  refs: Array<{ itemId: string; variationId: string }>
) {
  if (!node?.id) return;
  for (const variation of node.variations ?? []) {
    if (variation.id) refs.push({ itemId: node.id, variationId: variation.id });
  }
  for (const group of node.attributeGroups ?? []) {
    collectVariationRefs(group.linkedProduct, refs);
    for (const item of group.linkedCategory?.items ?? []) {
      collectVariationRefs(item, refs);
    }
  }
  for (const deal of node.dealsFromThis ?? []) {
    collectVariationRefs(deal.dealItem, refs);
  }
  for (const offer of node.offersFromThis ?? []) {
    collectVariationRefs(offer.offeredItem, refs);
  }
}

function applyLazyImageFlags(
  node: LinkedMenuNode,
  itemMeta: Map<string, MenuItemImageMeta>,
  variationMeta: Map<string, VariationImageMeta>,
  query: { slug?: string | null; subdomain?: string | null }
) {
  if (node.id) {
    const row = itemMeta.get(node.id);
    const hasImage = row?.hasImage ?? false;
    node.hasImage = hasImage;
    node.imageUrl = hasImage
      ? customerMenuItemImageUrl(node.id, {
          ...query,
          updatedAt: row?.updatedAt,
        })
      : null;
    for (const variation of node.variations ?? []) {
      if (!variation.id) continue;
      const variationRow = variationMeta.get(variation.id);
      const hasVariationImage = variationRow?.hasImage ?? false;
      variation.hasImage = hasVariationImage;
      variation.imageUrl = hasVariationImage
        ? customerMenuVariationImageUrl(node.id, variation.id, {
            ...query,
            updatedAt: variationRow?.updatedAt,
          })
        : null;
    }
  }
  for (const group of node.attributeGroups ?? []) {
    if (group.linkedProduct) {
      applyLazyImageFlags(group.linkedProduct, itemMeta, variationMeta, query);
    }
    for (const item of group.linkedCategory?.items ?? []) {
      applyLazyImageFlags(item, itemMeta, variationMeta, query);
    }
  }
  for (const deal of node.dealsFromThis ?? []) {
    if (deal.dealItem) {
      applyLazyImageFlags(deal.dealItem, itemMeta, variationMeta, query);
    }
  }
  for (const offer of node.offersFromThis ?? []) {
    if (offer.offeredItem) {
      applyLazyImageFlags(offer.offeredItem, itemMeta, variationMeta, query);
    }
  }
}

/** Stamp hasImage + lazy /image URLs onto a product, variations, and nested add-on items. */
export async function attachCustomerLazyImages<T>(
  item: T,
  query: { slug?: string | null; subdomain?: string | null }
): Promise<T> {
  const node = item as T & LinkedMenuNode;
  const itemIds = new Set<string>();
  collectLinkedMenuItemIds(node, itemIds);
  const variationRefs: Array<{ itemId: string; variationId: string }> = [];
  collectVariationRefs(node, variationRefs);
  const [itemMeta, variationMeta] = await Promise.all([
    imageMetaByMenuItemIds([...itemIds]),
    imageMetaByVariationIds(variationRefs.map((ref) => ref.variationId)),
  ]);
  applyLazyImageFlags(node, itemMeta, variationMeta, query);
  return item;
}
