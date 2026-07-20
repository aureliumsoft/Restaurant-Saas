export type CustomerMenuQuery = {
  slug?: string | null;
  subdomain?: string | null;
};

export function buildCustomerMenuItemDetailUrl(
  itemId: string,
  query: CustomerMenuQuery
): string | null {
  const slug = query.slug?.trim();
  const subdomain = query.subdomain?.trim();
  if (!slug && !subdomain) return null;
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (subdomain) params.set('subdomain', subdomain);
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}?${params}`;
}

export async function fetchCustomerMenuProductDetail<T>(
  itemId: string,
  query: CustomerMenuQuery
): Promise<T | null> {
  const url = buildCustomerMenuItemDetailUrl(itemId, query);
  if (!url) return null;
  const res = await fetch(url, { cache: 'default' });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: T };
  return body.data ?? null;
}

export async function fetchRestaurantMenuProductDetail<T>(
  itemId: string
): Promise<T | null> {
  const res = await fetch(
    `/api/restaurant/menu/items/${encodeURIComponent(itemId)}`,
    { cache: 'default' }
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: T };
  return body.data ?? null;
}

export function productNeedsDetailFetch(product: {
  attributeGroups?: Array<{
    sourceType?: string | null;
    required?: boolean;
    linkedProduct?: { id?: string; name?: string } | null;
    linkedCategory?: { items?: unknown[] | null } | null;
  }> | null;
  personalizeGroups?: Array<{ parentName?: string; options?: unknown[] }> | null;
}): boolean {
  if ((product.personalizeGroups?.length ?? 0) > 0) {
    if (!product.personalizeGroups?.[0]?.parentName) return true;
  }
  for (const g of product.attributeGroups ?? []) {
    if (g.sourceType === 'CATEGORY') {
      if (!g.linkedCategory?.items?.length) return true;
    }
    if (g.sourceType === 'PRODUCT' && g.required && !g.linkedProduct?.name) {
      return true;
    }
  }
  return false;
}
