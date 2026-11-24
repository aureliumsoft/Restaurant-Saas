import { isCustomerAppRoute } from '@/lib/customer-storefront-paths';

/** Staff dashboard / POS / KDS routes that need the restaurant bootstrap. */
export function isRestaurantStaffRoute(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/login') || path.startsWith('/register')) return false;
  if (path === '/' || path.startsWith('/pricing')) return false;
  if (isCustomerAppRoute(path)) return false;
  if (path.startsWith('/kiosk') || path.startsWith('/invite')) return false;
  return (
    path.startsWith('/dashboard') ||
    path.startsWith('/sales') ||
    path.startsWith('/pos') ||
    path.startsWith('/kds') ||
    path.startsWith('/order-display') ||
    path.startsWith('/branched') ||
    path.startsWith('/categories') ||
    path.startsWith('/product') ||
    path.startsWith('/variations') ||
    path.startsWith('/tables') ||
    path.startsWith('/recommendations') ||
    path.startsWith('/configurations') ||
    path.startsWith('/records') ||
    path.startsWith('/expenses') ||
    path.startsWith('/reports') ||
    path.startsWith('/settings') ||
    path.startsWith('/no-access') ||
    path === '/kds-screen'
  );
}
