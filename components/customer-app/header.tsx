/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Filter, Menu, User, X } from 'lucide-react';

import { useUiLanguageSnapshot } from '@/components/i18n/ui-language-context';
import { LanguageSwitcher } from '@/components/main/language-switcher';
import { useCustomerAccount } from '@/components/customer-app/customer-account-context';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import '@/lib/i18n/client';
import {
  buildCustomerLightSurfaceVars,
  buildThemeCssVars,
} from '@/lib/restaurant-theme';
import type { UiLanguage } from '@/lib/i18n/resources';
import {
  isCustomerOrderFlowPath,
  parseStorefrontSlugFromPath,
} from '@/lib/customer-storefront-paths';
import type { CSSProperties } from 'react';

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
  const pathSlug = pathname ? parseStorefrontSlugFromPath(pathname) ?? undefined : undefined;
  const isOrderFlowPath = pathname ? isCustomerOrderFlowPath(pathname) : false;
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

  const logoBlock = (
    <div className="flex min-w-0 items-center">
      {normalizedLogoUrl && !logoLoadFailed ? (
        <img
          key={normalizedLogoUrl}
          src={normalizedLogoUrl}
          alt={brand.name ?? 'Restaurant'}
          className="h-10 max-h-10 w-auto max-w-[min(220px,58vw)] object-contain object-left sm:h-11 sm:max-h-11 sm:max-w-[260px]"
          onError={() => setLogoLoadFailed(true)}
        />
      ) : (
        <span className="inline-flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-bold text-white ring-2 ring-white/30 sm:h-11 sm:w-11">
            {(brand.name ?? 'R').charAt(0)}
          </span>
          <span
            className="truncate text-lg font-extrabold uppercase tracking-wide sm:text-xl"
            style={{
              color: 'var(--restaurant-glow, #f5d76e)',
              textShadow:
                '0 1px 0 color-mix(in srgb, var(--restaurant-primary, #501d8e) 85%, black)',
            }}
          >
            {brand.name ?? 'Restaurant'}
          </span>
        </span>
      )}
    </div>
  );

  if (isStorefront) {
    const loginLabel = account
      ? account.name || t('customerAuthAccountTitle')
      : t('storefrontToLogIn');

    return (
      <header className="fixed inset-x-0 top-0 z-50 bg-primary px-4 py-2.5 text-primary-foreground sm:px-6">
        <div className="flex h-[52px] w-full items-center justify-between gap-3 sm:h-14">
          {/* Left: logo + name (Enjoy Tacos style) */}
          <Link
            href={pathSlug ? `/${encodeURIComponent(pathSlug)}` : '/'}
            className="flex min-w-0 flex-1 items-center no-underline"
          >
            {logoBlock}
          </Link>

          {/* Right: To log in + MENU */}
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center gap-2 text-sm font-medium transition hover:brightness-110"
              style={{ color: 'var(--restaurant-glow, #f5d76e)' }}
              aria-label={loginLabel}
            >
              <User className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">{loginLabel}</span>
            </button>

            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-bold uppercase tracking-wide text-primary shadow-sm transition hover:bg-white/90 sm:px-4"
                  aria-label={t('storefrontMenu')}
                >
                  <Menu className="h-5 w-5" strokeWidth={2} />
                  <span className="hidden sm:inline">{t('storefrontMenu')}</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex h-full w-[min(100vw,420px)] max-w-[420px] flex-col gap-0 border-0 bg-white p-0 text-[#1f1f2e] shadow-2xl sm:w-[min(32vw,420px)]"
                style={
                  {
                    ...buildCustomerLightSurfaceVars(brand.themePrimaryColor),
                    ...buildThemeCssVars(brand.themePrimaryColor),
                  } as CSSProperties
                }
              >
                <div className="flex shrink-0 items-center justify-between bg-primary px-5 py-6 text-primary-foreground">
                  <SheetTitle className="m-0 text-left text-[15px] font-extrabold uppercase tracking-[0.06em] text-primary-foreground">
                    {account
                      ? account.name || t('customerAuthAccountTitle')
                      : t('storefrontGuestMode')}
                  </SheetTitle>
                  <SheetClose asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center text-primary-foreground transition hover:opacity-80"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </SheetClose>
                </div>

                <nav
                  className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-white"
                  aria-label={t('storefrontMenu')}
                >
                  <SheetClose asChild>
                    <button
                      type="button"
                      onClick={openLogin}
                      className="flex w-full items-center gap-3.5 border-b border-[#e8e8ec] px-5 py-[1.15rem] text-left text-[15px] font-medium text-[#1f1f2e] transition hover:bg-[#fafafa]"
                    >
                      <User
                        className="h-[18px] w-[18px] shrink-0 text-primary"
                        strokeWidth={1.75}
                      />
                      {loginLabel}
                    </button>
                  </SheetClose>

                  <SheetClose asChild>
                    <button
                      type="button"
                      onClick={openMyOrders}
                      className="flex w-full items-center gap-3.5 border-b border-[#e8e8ec] px-5 py-[1.15rem] text-left text-[15px] font-medium text-[#1f1f2e] transition hover:bg-[#fafafa]"
                    >
                      <CalendarDays
                        className="h-[18px] w-[18px] shrink-0 text-primary"
                        strokeWidth={1.75}
                      />
                      {t('customerAuthMyOrders')}
                    </button>
                  </SheetClose>

                  <SheetClose asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3.5 border-b border-[#e8e8ec] px-5 py-[1.15rem] text-left text-[15px] font-medium text-[#1f1f2e] transition hover:bg-[#fafafa]"
                      onClick={() =>
                        openAccountSheet({
                          restaurantSlug: slugForApi ?? pathSlug ?? null,
                        })
                      }
                    >
                      <Filter
                        className="h-[18px] w-[18px] shrink-0 text-primary"
                        strokeWidth={1.75}
                      />
                      {t('storefrontDietary')}
                    </button>
                  </SheetClose>
                </nav>

                <div className="relative z-10 shrink-0 overflow-visible border-t border-[#e8e8ec] bg-white px-5 py-5">
                  <p className="mb-2.5 text-sm font-medium text-[#1f1f2e]">
                    {t('language')}
                  </p>
                  <LanguageSwitcher variant="toggle" tone="brand" />
                </div>
              </SheetContent>
            </Sheet>
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
