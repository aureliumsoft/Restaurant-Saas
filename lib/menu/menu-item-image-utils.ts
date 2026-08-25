import { db } from '@/lib/db';

export async function hasImageByMenuItemIds(
  ids: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;

  for (const id of ids) map.set(id, false);

  // Select only ids — never pull imageUrl blobs just to test presence.
  const rows = await db.menuItem.findMany({
    where: {
      id: { in: ids },
      AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
    },
    select: { id: true },
  });

  for (const row of rows) {
    map.set(row.id, true);
  }
  return map;
}

export function customerMenuItemImageUrl(
  itemId: string,
  query: { slug?: string | null; subdomain?: string | null }
): string {
  const params = new URLSearchParams();
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  const qs = params.toString();
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}/image${qs ? `?${qs}` : ''}`;
}

export function restaurantMenuItemImageUrl(itemId: string): string {
  return `/api/restaurant/menu/items/${encodeURIComponent(itemId)}/image`;
}

export async function hasImageByVariationIds(
  ids: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;

  for (const id of ids) map.set(id, false);

  const rows = await db.menuItemVariation.findMany({
    where: {
      id: { in: ids },
      AND: [{ imageUrl: { not: null } }, { NOT: { imageUrl: '' } }],
    },
    select: { id: true },
  });

  for (const row of rows) {
    map.set(row.id, true);
  }
  return map;
}

export function customerMenuVariationImageUrl(
  itemId: string,
  variationId: string,
  query: { slug?: string | null; subdomain?: string | null }
): string {
  const params = new URLSearchParams();
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  const qs = params.toString();
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}/variations/${encodeURIComponent(variationId)}/image${qs ? `?${qs}` : ''}`;
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
  const flags = await hasImageByVariationIds(ids);
  for (const item of items) {
    for (const variation of item.variations ?? []) {
      const hasImage = flags.get(variation.id) ?? false;
      variation.hasImage = hasImage;
      variation.imageUrl = hasImage
        ? customerMenuVariationImageUrl(item.id, variation.id, query)
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
  for (const offer of node.offersFromThis ?? []) {
    collectVariationRefs(offer.offeredItem, refs);
  }
}

function applyLazyImageFlags(
  node: LinkedMenuNode,
  itemFlags: Map<string, boolean>,
  variationFlags: Map<string, boolean>,
  query: { slug?: string | null; subdomain?: string | null }
) {
  if (node.id) {
    const hasImage = itemFlags.get(node.id) ?? false;
    node.hasImage = hasImage;
    node.imageUrl = hasImage ? customerMenuItemImageUrl(node.id, query) : null;
    for (const variation of node.variations ?? []) {
      if (!variation.id) continue;
      const hasVariationImage = variationFlags.get(variation.id) ?? false;
      variation.hasImage = hasVariationImage;
      variation.imageUrl = hasVariationImage
        ? customerMenuVariationImageUrl(node.id, variation.id, query)
        : null;
    }
  }
  for (const group of node.attributeGroups ?? []) {
    if (group.linkedProduct) {
      applyLazyImageFlags(group.linkedProduct, itemFlags, variationFlags, query);
    }
    for (const item of group.linkedCategory?.items ?? []) {
      applyLazyImageFlags(item, itemFlags, variationFlags, query);
    }
  }
  for (const offer of node.offersFromThis ?? []) {
    if (offer.offeredItem) {
      applyLazyImageFlags(offer.offeredItem, itemFlags, variationFlags, query);
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
  const [itemFlags, variationFlags] = await Promise.all([
    hasImageByMenuItemIds([...itemIds]),
    hasImageByVariationIds(variationRefs.map((ref) => ref.variationId)),
  ]);
  applyLazyImageFlags(node, itemFlags, variationFlags, query);
  return item;
}
