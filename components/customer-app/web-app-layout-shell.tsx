'use client';

import type { ReactNode } from 'react';
import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { Header } from '@/components/customer-app/header';
import { Footer } from '@/components/customer-app/footer';
import {
  CustomerAccountProvider,
  useCustomerAccount,
} from '@/components/customer-app/customer-account-context';
import { CustomerAccountSheetHost } from '@/components/customer-app/customer-account-sheet';
import { CustomerRegionalProvider } from '@/components/layout/customer-regional-provider';
import {
  isCustomerOrderFlowPath,
  isStorefrontHomePath,
  parseStorefrontSlugFromPath,
} from '@/lib/customer-storefront-paths';
import { cn } from '@/lib/utils';

function CustomerAccountSlugSync({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setRestaurantContext } = useCustomerAccount();

  useEffect(() => {
    const querySlug =
      searchParams.get('restaurantSlug')?.trim() ||
      searchParams.get('slug')?.trim() ||
      null;
    const pathSlug = pathname ? parseStorefrontSlugFromPath(pathname) : null;
    const slug = querySlug || pathSlug;
    if (slug) {
      setRestaurantContext({ restaurantSlug: slug });
    }
  }, [pathname, searchParams, setRestaurantContext]);

  return <>{children}</>;
}

function CustomerGoogleAuthReturnHandler() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { setSheetOpen, refreshSession } = useCustomerAccount();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const err = searchParams.get('customerAuthError')?.trim();
    if (!err || handled.current === err) return;
    handled.current = err;

    toast.error(t('customerAuthGoogleError'));
    setSheetOpen(true);
    void refreshSession();

    const next = new URLSearchParams(searchParams.toString());
    next.delete('customerAuthError');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, t, setSheetOpen, refreshSession]);

  return null;
}

export function WebAppLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideLayoutFooter = isStorefrontHomePath(pathname ?? '');
  const hideLayoutChrome = isCustomerOrderFlowPath(pathname ?? '');

  return (
    <CustomerAccountProvider>
      <div className="web-app-customer flex min-h-screen flex-col bg-white text-[#0f172a] antialiased">
        <div className="flex min-h-screen flex-col">
          <Suspense fallback={null}>
            <CustomerGoogleAuthReturnHandler />
          </Suspense>
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
