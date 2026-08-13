/** Operational / tenant routes — skip marketing tags (GA4 / GTM). */
import { isCustomerAppRoute } from '@/lib/customer-storefront-paths';

export const MARKETING_ANALYTICS_SKIP_PREFIXES = [
  '/admin',
  '/pos',
  '/kds',
  '/kds-screen',
  '/order-display',
  '/kiosk',
  '/dashboard',
  '/sales',
  '/branched',
  '/tables',
  '/categories',
  '/variations',
  '/product',
  '/configurations',
  '/records',
  '/settings',
  '/invite',
  '/employees',
  '/roles',
] as const;

export function shouldLoadMarketingAnalytics(
  pathname: string | null
): boolean {
  if (!pathname) return true;
  if (isCustomerAppRoute(pathname)) return false;
  return !MARKETING_ANALYTICS_SKIP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
