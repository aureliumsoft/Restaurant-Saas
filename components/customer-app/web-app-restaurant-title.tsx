'use client';

import { useState, type ReactNode } from 'react';

import { useRestaurantBranding } from '@/components/layout/restaurant-branding-provider';
import { cn } from '@/lib/utils';

type Props = {
  restaurantName?: string | null;
  logoUrl?: string | null;
  subtitle?: ReactNode;
  className?: string;
  size?: 'default' | 'compact';
};

export function WebAppRestaurantTitle({
  restaurantName,
  logoUrl,
  subtitle,
  className,
  size = 'default',
}: Props) {
  const brand = useRestaurantBranding();
  const [logoFailed, setLogoFailed] = useState(false);

  const name =
    restaurantName?.trim() || brand.restaurantName.trim() || 'Restaurant';
  const logo = logoUrl?.trim() || brand.logoUrl?.trim() || null;
  const showLogo = Boolean(logo) && !logoFailed;

  const logoSize = size === 'compact' ? 'h-10 w-10' : 'h-12 w-12';
  const titleSize =
    size === 'compact' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl';

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20',
          logoSize
        )}
      >
        {showLogo && logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="text-lg font-bold text-primary">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <h1 className={cn('truncate font-bold leading-tight', titleSize)}>
          {name}
        </h1>
        {subtitle ? (
          <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
