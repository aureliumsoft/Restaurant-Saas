/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Globe, Menu, User } from 'lucide-react';

import { useUiLanguageSnapshot } from '@/components/i18n/ui-language-context';
import { LanguageSwitcher } from '@/components/main/language-switcher';
import { useCustomerAccount } from '@/components/customer-app/customer-account-context';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import '@/lib/i18n/client';
import { buildCustomerLightSurfaceVars, buildThemeCssVars } from '@/lib/restaurant-theme';
import type { UiLanguage } from '@/lib/i18n/resources';

const WELCOME_BY_LANG: Record<UiLanguage, string> = {
  en: 'Welcome',
  es: 'Bienvenido',
};

type RestaurantBrand = {
  name: string | null;
  logoUrl: string | null;
  themePrimaryColor?: string | null;
};

export function Header() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const {
    openAccountSheet,
    account,
    setRestaurantContext,
  } = useCustomerAccount();
  const queryRestaurantSlug =
    searchParams.get('restaurantSlug')?.trim() ||
    searchParams.get('slug')?.trim() ||
    undefined;
  const pathSlugRaw = pathname?.match(/^\/web-app\/([^/]+)/)?.[1] ?? undefined;
  const pathSlug =
    pathSlugRaw && pathSlugRaw !== 'order' && pathSlugRaw !== 'track-order'
      ? decodeURIComponent(pathSlugRaw)
      : undefined;
  const isOrderFlowPath =
    pathname?.startsWith('/order/') ||
    pathname === '/order' ||
    pathname?.startsWith('/track-order') ||
    pathname === '/track-order';
  const slugForApi = queryRestaurantSlug ?? (isOrderFlowPath ? undefined : pathSlug);
  const isStorefront = Boolean(pathSlug && !isOrderFlowPath);

  const [brand, setBrand] = useState<RestaurantBrand>({
    name: 'Restaurant',
    logoUrl: null,
    themePrimaryColor: null,
  });
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);
  const languageSnapshot = useUiLanguageSnapshot();
  const { t } = useTranslation();

  useEffect(() => {
    setLocaleReady(true);
  }, []);

  const inferredSubdomain = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const hostname = window.location.hostname || '';
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    if (rootDomain) {
      const suffix = `.${rootDomain}`;
      if (hostname.endsWith(suffix)) {
        const sub = hostname.slice(0, -suffix.length);
        return sub || null;
      }
    }

    const parts = hostname.split('.');
    return parts.length >= 3 ? parts[0] : null;
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        let url: string | null = null;
        if (slugForApi) {
          url = `/api/customer/restaurant?slug=${encodeURIComponent(slugForApi)}`;
        } else {
          const subdomain = inferredSubdomain;
          if (!subdomain) return;
          url = `/api/customer/restaurant?subdomain=${encodeURIComponent(subdomain)}`;
        }

        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const r = data?.data;
        if (!r) return;
        setBrand({
          name: r?.name ?? 'Restaurant',
          logoUrl:
            typeof r?.logoUrl === 'string' && r.logoUrl.trim().length > 0
              ? r.logoUrl.trim()
              : null,
          themePrimaryColor: r?.themePrimaryColor ?? null,
        });
        setRestaurantContext({
          restaurantSlug: slugForApi ?? undefined,
          themePrimaryColor: r?.themePrimaryColor ?? null,
        });
        setLogoLoadFailed(false);
      } catch {
        // Keep current default values if the request fails.
      }
    };

    void run();
  }, [inferredSubdomain, setRestaurantContext, slugForApi]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const host = document.querySelector('.web-app-customer') as HTMLElement | null;
    if (!host) return;
    const vars = buildThemeCssVars(brand.themePrimaryColor);
    Object.entries(vars).forEach(([key, value]) => host.style.setProperty(key, value));
  }, [brand.themePrimaryColor]);

  const normalizedLogoUrl =
    typeof brand.logoUrl === 'string' && brand.logoUrl.trim().length > 0
      ? brand.logoUrl.trim()
      : null;

  const openLogin = () => {
    openAccountSheet({ restaurantSlug: slugForApi ?? pathSlug ?? null });
  };

  const openMyOrders = () => {
    openAccountSheet({
      restaurantSlug: slugForApi ?? pathSlug ?? null,
      view: 'orders',
    });
  };

  const menuSheetStyle = useMemo(
    () => buildCustomerLightSurfaceVars(brand.themePrimaryColor) as CSSProperties,
    [brand.themePrimaryColor]
  );

  const logoBlock = (
    <div className="flex min-w-0 items-center gap-2.5">
      {normalizedLogoUrl && !logoLoadFailed ? (
        <img
          key={normalizedLogoUrl}
          src={normalizedLogoUrl}
          alt={brand.name ?? 'Restaurant'}
          className="h-9 max-w-[min(160px,42vw)] shrink-0 object-contain object-left sm:h-10 lg:h-10 lg:w-10 lg:max-w-none lg:rounded-full lg:object-cover lg:ring-2 lg:ring-white/25"
          onError={() => setLogoLoadFailed(true)}
        />
      ) : (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white ring-2 ring-white/25 sm:h-10 sm:w-10">
          {(brand.name ?? 'R').charAt(0)}
        </span>
      )}
      <span className="hidden truncate text-sm font-bold uppercase tracking-wide text-primary-foreground sm:text-base lg:inline lg:text-lg">
        {brand.name ?? 'Restaurant'}
      </span>
    </div>
  );

  if (isStorefront) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 bg-primary px-4 py-3 text-primary-foreground sm:px-6">
        <div className="flex h-12 w-full items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center lg:hidden">
            {normalizedLogoUrl && !logoLoadFailed ? (
              logoBlock
            ) : (
              <span className="truncate text-base font-bold uppercase tracking-wide text-primary-foreground">
                {brand.name ?? 'Restaurant'}
              </span>
            )}
          </div>

          <div className="hidden min-w-0 flex-1 justify-center px-2 lg:flex">
            {logoBlock}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 lg:gap-3">
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#f5d76e] transition hover:text-white lg:hidden"
              aria-label={account ? t('customerAuthAccountTitle') : t('storefrontLogin')}
            >
              <User className="h-6 w-6" strokeWidth={1.5} />
            </button>

            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center text-[#f5d76e] transition hover:text-white lg:hidden"
                  aria-label={t('storefrontMenu')}
                >
                  <Menu className="h-6 w-6" strokeWidth={1.5} />
                </button>
              </SheetTrigger>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  className="hidden h-9 rounded-lg border-0 bg-white px-3 text-xs font-bold uppercase tracking-wide text-[#1a1033] shadow-sm hover:bg-white/90 lg:inline-flex"
                >
                  <Menu className="mr-1.5 h-4 w-4" />
                  {t('storefrontMenu')}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[min(100vw-2rem,320px)] border-border bg-background text-foreground"
                style={menuSheetStyle}
              >
                <SheetHeader>
                  <SheetTitle>{brand.name ?? 'Restaurant'}</SheetTitle>
                </SheetHeader>
                <nav
                  className="mt-6 flex flex-col gap-1"
                  aria-label={t('storefrontLogin')}
                >
                  <SheetClose asChild>
                    <button
                      type="button"
                      onClick={openLogin}
                      className="flex items-center gap-2 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground transition hover:bg-muted"
                    >
                      <User className="h-4 w-4" />
                      {account
                        ? account.name || t('customerAuthAccountTitle')
                        : t('storefrontLogin')}
                    </button>
                  </SheetClose>
                  <SheetClose asChild>
                    <button
                      type="button"
                      onClick={openMyOrders}
                      className="flex items-center gap-2 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground transition hover:bg-muted"
                    >
                      <CalendarDays className="h-4 w-4" />
                      {t('customerAuthMyOrders')}
                    </button>
                  </SheetClose>
                </nav>
                <div className="mt-6 border-t border-border pt-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    {t('language')}
                  </div>
                  <LanguageSwitcher variant="toggle" tone="default" />
                </div>
              </SheetContent>
            </Sheet>

            <button
              type="button"
              onClick={openLogin}
              className="hidden items-center gap-1.5 text-sm font-medium text-primary-foreground/90 transition hover:text-white lg:inline-flex"
            >
              <User className="h-4 w-4" />
              {account
                ? account.name || t('customerAuthAccountTitle')
                : t('storefrontLogin')}
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 z-50 border-b border-primary bg-primary px-6 py-4 text-primary-foreground shadow-md backdrop-blur supports-[backdrop-filter]:bg-primary/95">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 ring-1 ring-white/40">
            {normalizedLogoUrl && !logoLoadFailed ? (
              <img
                key={normalizedLogoUrl}
                src={normalizedLogoUrl}
                alt={brand.name ?? 'Restaurant'}
                className="h-full w-full object-cover"
                onError={() => setLogoLoadFailed(true)}
              />
            ) : (
              <span className="text-xl font-bold text-white">
                {(brand.name ?? 'Restaurant').charAt(0)}
              </span>
            )}
          </span>
          <span className="truncate text-lg font-semibold tracking-wide text-primary-foreground">
            {brand.name ?? 'Restaurant'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <span
            className="hidden text-sm text-primary-foreground/85 sm:inline"
            suppressHydrationWarning
          >
            {localeReady
              ? t('headerWelcome')
              : WELCOME_BY_LANG[languageSnapshot]}
          </span>
          <LanguageSwitcher variant="toggle" tone="onPrimary" />
        </div>
      </div>
    </header>
  );
}
