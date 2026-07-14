'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

import eventBus from '@/lib/even';
import {
  selectStaffBootstrap,
  useStaffBootstrapSWR,
} from '@/hooks/use-staff-bootstrap-swr';
import {
  applyRestaurantDocumentBranding,
  customerBrandingRouteFromLocation,
  inferCustomerSubdomainFromHost,
  pageTitleSuffixForPath,
  restoreDefaultDocumentBranding,
} from '@/lib/restaurant-document-branding';

type RestaurantBranding = {
  restaurantName: string;
  restaurantSlug: string | null;
  logoUrl: string | null;
  logoFailed: boolean;
  setLogoFailed: (failed: boolean) => void;
};

const RestaurantBrandingContext = createContext<RestaurantBranding | null>(null);

/** Staff dashboard / POS / KDS routes (authenticated). */
function isRestaurantStaffRoute(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/login') || path.startsWith('/register')) return false;
  if (path === '/' || path.startsWith('/pricing')) return false;
  if (
    path.startsWith('/web-app') ||
    path.startsWith('/kiosk') ||
    path.startsWith('/invite')
  ) {
    return false;
  }
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
    path.startsWith('/settings') ||
    path.startsWith('/no-access') ||
    path === '/kds-screen'
  );
}

export function RestaurantBrandingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { status: sessionStatus } = useSession();
  const [restaurantName, setRestaurantName] = useState('Restaurant');
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  const staffRoute = isRestaurantStaffRoute(pathname);
  const customerRoute = useMemo(
    () => customerBrandingRouteFromLocation(pathname, locationSearch),
    [pathname, locationSearch]
  );

  const staffPageSuffix = useMemo(
    () => pageTitleSuffixForPath(pathname),
    [pathname]
  );

  const pageSuffix = staffRoute ? staffPageSuffix : customerRoute?.pageSuffix;

  useEffect(() => {
    const syncSearch = () => {
      if (typeof window !== 'undefined') {
        setLocationSearch(window.location.search);
      }
    };
    syncSearch();
    window.addEventListener('popstate', syncSearch);
    return () => window.removeEventListener('popstate', syncSearch);
  }, [pathname]);

  const staffBootstrap = useStaffBootstrapSWR();
  const staffRestaurant = selectStaffBootstrap(staffBootstrap.data)?.restaurant;

  useEffect(() => {
    const isStaff = staffRoute && sessionStatus === 'authenticated';
    if (!isStaff || !staffRestaurant) return;
    setRestaurantName(staffRestaurant.name?.trim() || 'Restaurant');
    const slug = staffRestaurant.slug?.trim();
    setRestaurantSlug(slug && slug.length > 0 ? slug : null);
    const logo = staffRestaurant.logoUrl?.trim();
    setLogoUrl(logo && logo.length > 0 ? logo : null);
    setLogoFailed(false);
  }, [staffRoute, sessionStatus, staffRestaurant]);

  useEffect(() => {
    const isStaff = staffRoute && sessionStatus === 'authenticated';
    const isCustomer = Boolean(customerRoute);

    if (!isStaff && !isCustomer) return;
    // Staff branding comes from bootstrap — don't race a second /api/restaurant
    // while bootstrap is still in flight.
    if (isStaff) {
      if (staffBootstrap.isLoading && !staffRestaurant) return;
      if (staffRestaurant) return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        let url: string | null = null;

        if (isStaff) {
          // Only after bootstrap settled without a restaurant (edge / failure).
          url = '/api/restaurant';
        } else if (customerRoute?.slug) {
          url = `/api/customer/restaurant?slug=${encodeURIComponent(customerRoute.slug)}`;
        } else {
          const subdomain = inferCustomerSubdomainFromHost();
          if (subdomain) {
            url = `/api/customer/restaurant?subdomain=${encodeURIComponent(subdomain)}`;
          }
        }

        if (!url) return;

        const res = await fetch(url, { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as {
          data?: {
            name?: string | null;
            slug?: string | null;
            logoUrl?: string | null;
          } | null;
        };
        if (cancelled) return;
        const d = json?.data;
        setRestaurantName(d?.name?.trim() || 'Restaurant');
        const slug = d?.slug?.trim();
        setRestaurantSlug(slug && slug.length > 0 ? slug : null);
        const logo = d?.logoUrl?.trim();
        setLogoUrl(logo && logo.length > 0 ? logo : null);
        setLogoFailed(false);
      } catch {
        if (!cancelled) {
          setRestaurantName('Restaurant');
          setRestaurantSlug(null);
          setLogoUrl(null);
        }
      }
    };

    void load();
    const onRefresh = () => void load();
    eventBus.on('fetchStoreData', onRefresh);
    eventBus.on('realtime:config.branding', onRefresh);

    return () => {
      cancelled = true;
      eventBus.removeListener('fetchStoreData', onRefresh);
      eventBus.removeListener('realtime:config.branding', onRefresh);
    };
  }, [
    staffRoute,
    sessionStatus,
    customerRoute,
    staffRestaurant,
    staffBootstrap.isLoading,
  ]);

  useEffect(() => {
    const isStaff = staffRoute && sessionStatus === 'authenticated';
    const isCustomer = Boolean(customerRoute);

    if (!isStaff && !isCustomer) {
      const id = requestAnimationFrame(() => restoreDefaultDocumentBranding());
      return () => cancelAnimationFrame(id);
    }

    const id = requestAnimationFrame(() => {
      applyRestaurantDocumentBranding({
        restaurantName,
        logoUrl,
        pageSuffix,
        logoFailed,
      });
    });

    return () => cancelAnimationFrame(id);
  }, [
    staffRoute,
    sessionStatus,
    customerRoute,
    restaurantName,
    logoUrl,
    pageSuffix,
    logoFailed,
  ]);

  const value = useMemo<RestaurantBranding>(
    () => ({
      restaurantName,
      restaurantSlug,
      logoUrl,
      logoFailed,
      setLogoFailed,
    }),
    [restaurantName, restaurantSlug, logoUrl, logoFailed]
  );

  return (
    <RestaurantBrandingContext.Provider value={value}>
      {children}
    </RestaurantBrandingContext.Provider>
  );
}

export function useRestaurantBranding(): RestaurantBranding {
  const ctx = useContext(RestaurantBrandingContext);
  if (!ctx) {
    return {
      restaurantName: 'Restaurant',
      restaurantSlug: null,
      logoUrl: null,
      logoFailed: false,
      setLogoFailed: () => {},
    };
  }
  return ctx;
}
