'use client';

import { useTranslation } from 'react-i18next';
import { UtensilsCrossed } from 'lucide-react';

import { StorefrontBackground } from '@/components/customer-app/storefront-background';

type StorefrontBrandHeroProps = {
  restaurantName: string;
  logoUrl?: string | null;
};

export function StorefrontBrandHero({
  restaurantName,
  logoUrl,
}: StorefrontBrandHeroProps) {
  const { t } = useTranslation();
  const initial = restaurantName.charAt(0).toUpperCase();
  const normalizedLogo =
    typeof logoUrl === 'string' && logoUrl.trim() ? logoUrl.trim() : null;

  return (
    <div className="relative h-full min-h-[240px] w-full overflow-hidden sm:min-h-[320px] lg:min-h-[calc(100dvh-72px)]">
      <StorefrontBackground hasBanner={false} />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `linear-gradient(
              135deg,
              var(--restaurant-primary, #7c3aed) 0%,
              transparent 45%,
              var(--restaurant-glow, #fbbf24) 100%
            )`,
        }}
      />

      <div className="relative z-10 flex h-full min-h-[inherit] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--restaurant-glass-border,#e2e8f0)] bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur-sm">
          <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
          {t('storefrontOrderOnline')}
        </div>

        <div className="relative mb-6">
          <div
            aria-hidden
            className="absolute -inset-3 rounded-[2rem] opacity-40 blur-xl"
            style={{
              background:
                'radial-gradient(circle, var(--restaurant-primary, #7c3aed), transparent 70%)',
            }}
          />
          {normalizedLogo ? (
            <img
              src={normalizedLogo}
              alt=""
              className="relative h-28 w-28 rounded-[1.75rem] object-cover shadow-2xl ring-4 ring-white/80 sm:h-32 sm:w-32"
            />
          ) : (
            <span className="relative flex h-28 w-28 items-center justify-center rounded-[1.75rem] bg-primary text-5xl font-bold text-primary-foreground shadow-2xl ring-4 ring-white/80 sm:h-32 sm:w-32">
              {initial}
            </span>
          )}
        </div>

        <h1 className="max-w-xl text-3xl font-bold tracking-tight text-[#0f172a] sm:text-4xl lg:text-5xl">
          {restaurantName}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[#64748b] sm:text-base">
          {t('storefrontTagline')}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t('delivery')}
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t('takeAwayLabel')}
          </span>
        </div>
      </div>
    </div>
  );
}
