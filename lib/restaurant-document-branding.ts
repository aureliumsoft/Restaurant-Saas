import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import {
  isCustomerOrderFlowPath,
  parseStorefrontSlugFromPath,
} from '@/lib/customer-storefront-paths';

export const DEFAULT_DOCUMENT_TITLE = 'Foodluk';
export const DEFAULT_FAVICON_HREF = '/Logo.png';

/** Standalone routes outside `(root)` that still belong to a restaurant tenant. */
const STANDALONE_PAGE_TITLES: Record<string, string> = {
  '/pos': 'POS',
  '/kds-screen': 'KDS',
  '/order-display': 'Order Display',
};

export function dashboardModuleTitleForPath(pathname: string): string | null {
  const path = pathname.split('?')[0] ?? pathname;
  const exact = DASHBOARD_MODULES.find((m) => m.path === path);
  if (exact) return exact.title;
  const nested = DASHBOARD_MODULES.find((m) => path.startsWith(`${m.path}/`));
  return nested?.title ?? null;
}

export function pageTitleSuffixForPath(pathname: string): string | null {
  const path = pathname.split('?')[0] ?? pathname;
  if (STANDALONE_PAGE_TITLES[path]) return STANDALONE_PAGE_TITLES[path];
  return dashboardModuleTitleForPath(path);
}

export type CustomerBrandingRoute = {
  slug: string | null;
  pageSuffix: string | null;
};

function webAppPageSuffix(path: string): string | null {
  if (path.includes('/checkout')) return 'Checkout';
  if (path.includes('/cart')) return 'Cart';
  if (path.includes('/success')) return 'Order confirmed';
  if (path.includes('/order/')) return 'Order';
  if (path.includes('/track-order')) return 'Track order';
  return null;
}

/** Resolve kiosk / web-app tenant from path + query (client-side). */
export function customerBrandingRouteFromLocation(
  pathname: string,
  search?: string
): CustomerBrandingRoute | null {
  const path = pathname.split('?')[0] ?? pathname;
  const parts = path.split('/').filter(Boolean);
  const searchString =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(searchString);

  const slugFromQuery =
    params.get('restaurantSlug')?.trim() || params.get('slug')?.trim() || null;

  if (parts[0] === 'kiosk' && parts[1]) {
    return {
      slug: decodeURIComponent(parts[1]),
      pageSuffix: 'Kiosk',
    };
  }

  const orderFlow =
    isCustomerOrderFlowPath(path) ||
    path === '/track-order' ||
    path.startsWith('/track-order/');

  if (orderFlow) {
    return {
      slug: slugFromQuery,
      pageSuffix: webAppPageSuffix(path),
    };
  }

  const pathSlug = parseStorefrontSlugFromPath(path);
  if (pathSlug) {
    return {
      slug: pathSlug,
      pageSuffix: webAppPageSuffix(path),
    };
  }

  if (slugFromQuery) {
    return {
      slug: slugFromQuery,
      pageSuffix: webAppPageSuffix(path),
    };
  }

  return null;
}

export function inferCustomerSubdomainFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname || '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain) {
    const suffix = `.${rootDomain}`;
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, -suffix.length);
      if (sub && sub !== 'www') return sub;
    }
  }
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.replace('.localhost', '');
    if (sub && sub !== 'www') return sub;
  }
  const hostParts = hostname.split('.');
  return hostParts.length >= 3 ? hostParts[0] : null;
}

export function buildRestaurantDocumentTitle(
  restaurantName: string,
  pageSuffix?: string | null
): string {
  const name = restaurantName.trim() || 'Restaurant';
  const suffix = pageSuffix?.trim();
  if (suffix) return `${name} · ${suffix}`;
  return name;
}

/** Only update links Next/metadata already rendered — never append to `<head>`. */
function updateExistingLinkHrefs(rel: string, href: string): void {
  document
    .querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)
    .forEach((link) => {
      link.href = href;
    });
}

export function applyRestaurantDocumentBranding(opts: {
  restaurantName: string;
  logoUrl?: string | null;
  pageSuffix?: string | null;
  logoFailed?: boolean;
}): void {
  if (typeof document === 'undefined') return;

  document.title = buildRestaurantDocumentTitle(
    opts.restaurantName,
    opts.pageSuffix
  );

  const iconHref =
    opts.logoUrl && !opts.logoFailed ? opts.logoUrl : DEFAULT_FAVICON_HREF;

  updateExistingLinkHrefs('icon', iconHref);
  updateExistingLinkHrefs('apple-touch-icon', iconHref);
}

export function restoreDefaultDocumentBranding(): void {
  if (typeof document === 'undefined') return;
  document.title = DEFAULT_DOCUMENT_TITLE;
  updateExistingLinkHrefs('icon', DEFAULT_FAVICON_HREF);
  updateExistingLinkHrefs('apple-touch-icon', DEFAULT_FAVICON_HREF);
}
