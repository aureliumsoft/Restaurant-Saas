'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { AcceptedPaymentMethods } from '@/components/payments/accepted-payment-methods';
import { cn } from '@/lib/utils';
import '@/lib/i18n/client';
import { parseStorefrontSlugFromPath } from '@/lib/customer-storefront-paths';
import { buildThemeCssVars } from '@/lib/restaurant-theme';

const LEGAL_LINKS = [
  { key: 'storefrontFooterTermsOfSale', href: '/refund-policy' },
  { key: 'storefrontFooterTermsOfUse', href: '/policies' },
  { key: 'storefrontFooterCookiePolicy', href: '/privacy-policy' },
  { key: 'storefrontFooterPrivacyPolicy', href: '/privacy-policy' },
  { key: 'storefrontFooterLegalNotice', href: '/policies' },
] as const;

type FooterPlacement = 'layout' | 'column';

export function Footer({
  placement = 'layout',
  className,
}: {
  placement?: FooterPlacement;
  className?: string;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const slug = useMemo(
    () => (pathname ? parseStorefrontSlugFromPath(pathname) : null),
    [pathname]
  );

  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setRestaurantName(null);
      setLogoUrl(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        const data = json?.data;
        setRestaurantName(
          typeof data?.name === 'string' ? data.name.trim() : null
        );
        setLogoUrl(
          typeof data?.logoUrl === 'string' && data.logoUrl.trim()
            ? data.logoUrl.trim()
            : null
        );

        if (typeof document !== 'undefined') {
          const host = document.querySelector(
            '.web-app-customer'
          ) as HTMLElement | null;
          if (host) {
            const vars = buildThemeCssVars(data?.themePrimaryColor);
            Object.entries(vars).forEach(([key, value]) =>
              host.style.setProperty(key, value)
            );
          }
        }
      } catch {
        if (!cancelled) {
          setRestaurantName(null);
          setLogoUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const brandLabel = restaurantName ?? 'Foodluk';
  const initial = brandLabel.charAt(0).toUpperCase();
  const isColumn = placement === 'column';

  return (
    <footer
      className={cn(
        'relative z-40 shrink-0 overflow-hidden bg-primary text-primary-foreground',
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.14),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.22),transparent_50%)]"
      />

      {isColumn ? (
        <div className="relative space-y-3 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15 text-xs font-bold text-white ring-1 ring-white/20">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {brandLabel}
              </p>
              <p className="truncate text-[11px] text-white/65">
                {t('storefrontFooterTagline')}
              </p>
            </div>
          </div>

          <nav
            className="flex flex-wrap gap-x-2.5 gap-y-1"
            aria-label={t('storefrontFooterLegal')}
          >
            {LEGAL_LINKS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="text-[10px] text-white/75 transition hover:text-white"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <AcceptedPaymentMethods variant="on-dark" size="sm" showPayPal />

          <p className="text-[10px] leading-relaxed text-white/55">
            © {year} {brandLabel}. {t('storefrontFooterRights')}
          </p>
        </div>
      ) : (
        <div className="relative px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="flex max-w-md items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-lg font-bold text-white ring-1 ring-white/20">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">
                {brandLabel}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                {t('storefrontFooterTagline')}
              </p>
            </div>
          </div>

          <div className="lg:min-w-[min(100%,320px)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              {t('storefrontFooterLegal')}
            </p>
            <nav
              className="mt-4 flex flex-col sm:gap-y-2"
              aria-label={t('storefrontFooterLegal')}
            >
              {LEGAL_LINKS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="text-sm text-white/75 transition hover:text-white"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md sm:w-auto sm:min-w-[240px]">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
              {t('storefrontFooterPayments')}
            </p>
            <AcceptedPaymentMethods variant="on-dark" size="sm" showPayPal />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brandLabel}. {t('storefrontFooterRights')}
          </p>
          <p className="text-white/60">
            {t('storefrontFooterPoweredBy')}{' '}
            <span className="font-medium text-white/90">Foodluk</span>
          </p>
        </div>
        </div>
      )}
    </footer>
  );
}
