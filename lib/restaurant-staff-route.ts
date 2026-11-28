import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import { isCustomerAppRoute } from '@/lib/customer-storefront-paths';

/** Paths that are staff tools but are not a `DASHBOARD_MODULES` entry. */
const EXTRA_STAFF_PREFIXES = [
  '/sales',
  '/branched',
  '/tables',
  '/recommendations',
  '/no-access',
  '/kds-screen',
] as const;

function staffPathPrefixes(): string[] {
  const prefixes = new Set<string>(EXTRA_STAFF_PREFIXES);
  for (const mod of DASHBOARD_MODULES) {
    const path = mod.path.split('?')[0] ?? '';
    if (path.startsWith('/')) prefixes.add(path);
  }
  return [...prefixes];
}

/** Staff dashboard / POS / KDS routes that need the restaurant bootstrap. */
export function isRestaurantStaffRoute(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/login') || path.startsWith('/register')) return false;
  if (path === '/' || path.startsWith('/pricing')) return false;
  if (path.startsWith('/kiosk') || path.startsWith('/invite')) return false;
  const staffPath = staffPathPrefixes().some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
  if (staffPath) return true;
  if (isCustomerAppRoute(path)) return false;
  return false;
}
