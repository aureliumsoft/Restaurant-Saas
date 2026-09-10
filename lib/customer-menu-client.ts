/**
 * Client-only helpers for resolving which restaurant’s menu to load.
 */

export function inferHostSubdomainForMenu(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname || '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain) {
    const suffix = `.${rootDomain}`;
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, -suffix.length);
      return sub && sub !== 'www' ? sub : null;
    }
  }

  if (hostname.endsWith('.localhost')) {
    const sub = hostname.replace('.localhost', '');
    return sub && sub !== 'www' ? sub : null;
  }

  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : null;
}

/** Prefer slug (path-based storefront); else subdomain from host or legacy storeId. */
export function buildCustomerMenuRequestUrl(
  restaurantSlug: string | null | undefined,
  storeId: string | null | undefined,
  hostSubdomain: string | null,
  branchId?: string | null
): string | null {
  const slug = restaurantSlug?.trim();
  if (slug) {
    return `/api/customer/menu?slug=${encodeURIComponent(slug)}${branchQuery(branchId)}`;
  }
  const sub = (hostSubdomain?.trim() || storeId?.trim() || '') || null;
  if (!sub) return null;
  return `/api/customer/menu?subdomain=${encodeURIComponent(sub)}${branchQuery(branchId)}`;
}

function branchQuery(branchId?: string | null) {
  return branchId?.trim() ? `&branchId=${encodeURIComponent(branchId.trim())}` : '';
}

function customerMenuQueryString(
  restaurantSlug: string | null | undefined,
  storeId: string | null | undefined,
  hostSubdomain: string | null,
  branchId?: string | null
): string | null {
  const slug = restaurantSlug?.trim();
  if (slug) return `slug=${encodeURIComponent(slug)}${branchQuery(branchId)}`;
  const sub = (hostSubdomain?.trim() || storeId?.trim() || '') || null;
  if (!sub) return null;
  return `subdomain=${encodeURIComponent(sub)}${branchQuery(branchId)}`;
}

/** Progressive menu: category metadata only. */
export function buildCustomerMenuCategoriesUrl(
  restaurantSlug: string | null | undefined,
  storeId: string | null | undefined,
  hostSubdomain: string | null,
  branchId?: string | null
): string | null {
  const query = customerMenuQueryString(
    restaurantSlug,
    storeId,
    hostSubdomain,
    branchId
  );
  if (!query) return null;
  return `/api/customer/menu/categories?${query}`;
}

/** Progressive menu: products for one category (optional page/limit batching). */
export function buildCustomerMenuCategoryItemsUrl(
  categoryId: string,
  restaurantSlug: string | null | undefined,
  storeId: string | null | undefined,
  hostSubdomain: string | null,
  branchId: string | null | undefined,
  opts?: { page?: number; limit?: number }
): string | null {
  const query = customerMenuQueryString(restaurantSlug, storeId, hostSubdomain, branchId);
  if (!query) return null;
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 24;
  return `/api/customer/menu/categories/${encodeURIComponent(categoryId)}?${query}&page=${page}&limit=${limit}`;
}

/** Kiosk progressive menu helpers (slug-only). */
export function buildKioskMenuCategoriesUrl(slug: string, branchId: string): string {
  return `/api/customer/menu/categories?slug=${encodeURIComponent(slug)}${branchQuery(branchId)}`;
}

export function buildKioskMenuCategoryItemsUrl(
  slug: string,
  categoryId: string,
  branchId: string,
  opts?: { page?: number; limit?: number }
): string {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 24;
  return `/api/customer/menu/categories/${encodeURIComponent(categoryId)}?slug=${encodeURIComponent(slug)}${branchQuery(branchId)}&page=${page}&limit=${limit}`;
}

export function buildKioskMenuItemDetailUrl(slug: string, itemId: string): string {
  return `/api/customer/menu/items/${encodeURIComponent(itemId)}?slug=${encodeURIComponent(slug)}`;
}
