'use client';

import type { ReactNode } from 'react';
import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { Header } from '@/components/customer-app/header';
import { Footer } from '@/components/customer-app/footer';
import {
  CustomerAccountProvider,
  useCustomerAccount,
} from '@/components/customer-app/customer-account-context';
import { CustomerAccountSheetHost } from '@/components/customer-app/customer-account-sheet';
import { CustomerRegionalProvider } from '@/components/layout/customer-regional-provider';
import { cn } from '@/lib/utils';

function isStorefrontHome(pathname: string | null) {
  if (!pathname) return false;
  const match = pathname.match(/^\/web-app\/([^/]+)$/);
  if (!match) return false;
  const slug = match[1];
  return slug !== 'order' && slug !== 'track-order';
}

function isOrderFlow(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname === '/order' ||
    pathname.startsWith('/order/') ||
    pathname === '/web-app/order' ||
    pathname.startsWith('/web-app/order/')
  );
}

function CustomerAccountSlugSync({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setRestaurantContext } = useCustomerAccount();

  useEffect(() => {
    const querySlug =
      searchParams.get('restaurantSlug')?.trim() ||
      searchParams.get('slug')?.trim() ||
      null;
    const pathSlugRaw = pathname?.match(/^\/web-app\/([^/]+)/)?.[1] ?? null;
    const pathSlug =
      pathSlugRaw &&
      pathSlugRaw !== 'order' &&
      pathSlugRaw !== 'track-order'
        ? decodeURIComponent(pathSlugRaw)
        : null;
    const slug = querySlug || pathSlug;
    if (slug) {
      setRestaurantContext({ restaurantSlug: slug });
    }
  }, [pathname, searchParams, setRestaurantContext]);

  return <>{children}</>;
}

export function WebAppLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideLayoutFooter = isStorefrontHome(pathname);
  const hideLayoutChrome = isOrderFlow(pathname);

  return (
    <CustomerAccountProvider>
      <div className="web-app-customer flex min-h-screen flex-col bg-white text-[#0f172a] antialiased">
        <div className="flex min-h-screen flex-col">
          <Suspense fallback={null}>
            <CustomerAccountSlugSync>
              {!hideLayoutChrome ? (
                <div className="relative z-50">
                  <Suspense
                    fallback={
                      <header className="sticky top-0 z-50 h-[72px] border-b border-primary bg-primary px-6 py-4 shadow-md" />
                    }
                  >
                    <Header />
                  </Suspense>
                </div>
              ) : null}

              <main
                className={cn(
                  'relative z-10 flex min-h-0 flex-1 flex-col',
                  hideLayoutChrome && 'min-h-screen'
                )}
              >
                <Suspense fallback={children}>
                  <CustomerRegionalProvider>{children}</CustomerRegionalProvider>
                </Suspense>
              </main>

              {!hideLayoutChrome && !hideLayoutFooter ? (
                <Footer />
              ) : !hideLayoutChrome && hideLayoutFooter ? (
                <Footer className="hidden lg:block" />
              ) : null}
            </CustomerAccountSlugSync>
          </Suspense>
        </div>
        <CustomerAccountSheetHost />
      </div>
    </CustomerAccountProvider>
  );
}
