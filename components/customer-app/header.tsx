/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { useUiLanguageSnapshot } from '@/components/i18n/ui-language-context';
import { LanguageSwitcher } from '@/components/main/language-switcher';
import '@/lib/i18n/client';
import { buildThemeCssVars } from '@/lib/restaurant-theme';
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
        setLogoLoadFailed(false);
      } catch {
        // Keep current default values if the request fails.
      }
    };

    void run();
  }, [inferredSubdomain, slugForApi]);

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

  return (
    <header className="sticky top-0 z-50 border-b border-primary bg-primary px-6 py-4 text-primary-foreground shadow-md backdrop-blur supports-[backdrop-filter]:bg-primary/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
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
          <LanguageSwitcher variant="inline" tone="onPrimary" />
        </div>
      </div>
    </header>
  );
}
