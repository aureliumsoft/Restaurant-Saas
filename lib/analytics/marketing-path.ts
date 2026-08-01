/** Operational / tenant routes — skip marketing tags (GA4 / GTM). */
export const MARKETING_ANALYTICS_SKIP_PREFIXES = [
  '/admin',
  '/pos',
  '/kds',
  '/kds-screen',
  '/order-display',
  '/web-app',
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
  return !MARKETING_ANALYTICS_SKIP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
