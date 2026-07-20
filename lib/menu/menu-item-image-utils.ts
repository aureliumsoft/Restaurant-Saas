import { db } from '@/lib/db';

export async function hasImageByMenuItemIds(
  ids: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;

  for (const id of ids) map.set(id, false);

  const rows = await db.menuItem.findMany({
    where: { id: { in: ids }, NOT: { imageUrl: null } },
    select: { id: true, imageUrl: true },
  });

  for (const row of rows) {
    map.set(row.id, Boolean(row.imageUrl?.trim()));
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
