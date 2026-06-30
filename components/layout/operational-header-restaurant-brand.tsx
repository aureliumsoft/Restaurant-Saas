'use client';

import { useState } from 'react';

import { useStaffRestaurantBranding } from '@/hooks/use-staff-permissions';

export function OperationalHeaderRestaurantBrand() {
  const { restaurantName, logoUrl: bootstrapLogo } =
    useStaffRestaurantBranding();
  const [logoFailed, setLogoFailed] = useState(false);

  const name = restaurantName || 'Restaurant';
  const logoUrl = bootstrapLogo;
  const initial = (name || 'R').charAt(0).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoUrl && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- dashboard URLs from restaurant settings
        <img
          src={logoUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-sm font-semibold text-muted-foreground"
          aria-hidden
        >
          {initial}
        </span>
      )}
      <h1 className="truncate text-lg font-semibold tracking-tight">{name}</h1>
    </div>
  );
}
