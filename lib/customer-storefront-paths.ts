/**
 * Customer storefront URLs live under the `(web-app)` route group — the group name
 * does not appear in paths. Storefront home is `/{slug}`; order flow is `/order/...`.
 */

import { pathSegmentId } from '@/lib/url-id-path';

/** @deprecated Legacy prefix — only used for redirects from old links. */
export const LEGACY_WEB_APP_PREFIX = '/web-app';

/** First path segments that are never restaurant slugs. */
export const STOREFRONT_RESERVED_SEGMENTS = new Set([
  'admin',
  'analytics',
  'api',
  'blog',
  'branched',
  'categories',
  'configurations',
  'dashboard',
  'demo-request',
  'demo-store',
  'documentation',
  'employees',
  'invite',
  'kds',
  'kds-screen',
  'kiosk',
  'login',
  'no-access',
  'onboarding',
  'order',
  'order-display',
  'order-path',
  'orders',
  'payment',
  'policies',
  'pos',
  'pricing',
  'privacy',
  'privacy-policy',
  'product',
  'records',
  'recommendations',
  'refund-policy',
  'register',
  'reset-password',
  'restaurant-signup',
  'role',
  'sales',
  'settings',
  'sitemap',
  'subscription-returns',
  'tables',
  'technologies',
  'track-order',
  'variations',
  'web-app',
]);

function normalizeSlug(slug: string): string {
  return slug.trim();
}

function encodeSlug(slug: string): string {
  return encodeURIComponent(normalizeSlug(slug));
}

export function restaurantStorefrontPath(slug: string): string {
  return `/${encodeSlug(slug)}`;
}

export function restaurantTrackOrderPath(
  slug: string,
  query?: { orderId?: string }
): string {
  const base = `/${encodeSlug(slug)}/track-order`;
  const orderId = query?.orderId?.trim();
  if (!orderId) return base;
  return `${base}?orderId=${encodeURIComponent(pathSegmentId(orderId))}`;
}

export function restaurantOrdersPath(slug: string): string {
  return `/${encodeSlug(slug)}/orders`;
}

export function restaurantOrderDetailPath(slug: string, orderId: string): string {
  return `/${encodeSlug(slug)}/orders/${encodeURIComponent(pathSegmentId(orderId))}`;
}

export function isCustomerOrderFlowPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  return (
    (path === '/order' || path.startsWith('/order/')) && !path.startsWith('/orders')
  );
}

function isReservedSegment(segment: string): boolean {
  return STOREFRONT_RESERVED_SEGMENTS.has(segment.toLowerCase());
}

/** Slug from `/{slug}` or `/{slug}/orders|track-order` (not order flow or reserved paths). */
export function parseStorefrontSlugFromPath(pathname: string): string | null {
  const path = pathname.split('?')[0] ?? pathname;
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  const first = decodeURIComponent(parts[0] ?? '');
  if (!first || isReservedSegment(first)) return null;

  if (parts.length === 1) return first;

  const second = parts[1]?.toLowerCase();
  if (second === 'orders' || second === 'track-order') return first;

  return null;
}

export function isStorefrontHomePath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  const match = path.match(/^\/([^/]+)$/);
  if (!match?.[1]) return false;
  const slug = decodeURIComponent(match[1]);
  return !isReservedSegment(slug);
}

export function isCustomerAppRoute(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (isCustomerOrderFlowPath(path)) return true;
  if (path === '/track-order' || path.startsWith('/track-order/')) return true;
  return parseStorefrontSlugFromPath(path) !== null;
}

/** Strip legacy `/web-app` prefix for redirects. */
export function legacyWebAppRedirectPath(pathname: string): string {
  if (pathname === '/web-app') return '/';
  if (pathname.startsWith('/web-app/')) {
    const next = pathname.slice('/web-app'.length);
    return next.length > 0 ? next : '/';
  }
  return pathname;
}
