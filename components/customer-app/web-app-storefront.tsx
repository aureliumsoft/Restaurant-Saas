'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';

import { Sidebar } from '@/components/customer-app/sidebar';
import { StorefrontBrandHero } from '@/components/customer-app/storefront/storefront-brand-hero';
import { buildStorefrontThemeVars } from '@/lib/restaurant-theme';

type RestaurantBrand = {
  name: string;
  mainBannerUrl: string | null;
  logoUrl: string | null;
  themePrimaryColor: string | null;
};

export function WebAppStorefront({ slug }: { slug: string }) {
  const [brand, setBrand] = useState<RestaurantBrand | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);

  const [mode, setMode] = useState<'delivery' | 'takeaway'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [apartmentDoorNumber, setApartmentDoorNumber] = useState('');
  const [gateCode, setGateCode] = useState('');
  const [addressName, setAddressName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBrandLoading(true);
      try {
        const res = await fetch(
          `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json().catch(() => ({}));
        const data = json?.data as
          | {
              name?: string;
              mainBannerUrl?: string | null;
              logoUrl?: string | null;
              themePrimaryColor?: string | null;
            }
          | null
          | undefined;
        if (cancelled) return;
        setBrand({
          name: data?.name?.trim() || slug,
          mainBannerUrl:
            typeof data?.mainBannerUrl === 'string' && data.mainBannerUrl.trim()
              ? data.mainBannerUrl.trim()
              : null,
          logoUrl:
            typeof data?.logoUrl === 'string' && data.logoUrl.trim()
              ? data.logoUrl.trim()
              : null,
          themePrimaryColor:
            typeof data?.themePrimaryColor === 'string' &&
            data.themePrimaryColor.trim()
              ? data.themePrimaryColor.trim()
              : null,
        });
      } catch {
        if (!cancelled) {
          setBrand({
            name: slug,
            mainBannerUrl: null,
            logoUrl: null,
            themePrimaryColor: null,
          });
        }
      } finally {
        if (!cancelled) setBrandLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const themeVars = buildStorefrontThemeVars(
    brand?.themePrimaryColor
  ) as CSSProperties;

  const displayName = brand?.name ?? slug;
  const bannerUrl = brand?.mainBannerUrl?.trim() ?? '';
  const logoUrl = brand?.logoUrl?.trim() ?? '';

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white"
      style={themeVars}
    >
      {brandLoading ? (
        <div className="flex min-h-[60vh] flex-1 items-center justify-center">
          <Loader2
            className="h-8 w-8 animate-spin text-primary"
            aria-label="Loading"
          />
        </div>
      ) : (
        <div className="relative w-full lg:pt-[72px]">
          <section
            aria-label={displayName}
            className="relative hidden min-h-[calc(100dvh-72px)] w-full lg:block lg:pr-[min(100%,420px)]"
          >
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt={`${displayName} banner`}
                className="block h-full min-h-[calc(100dvh-72px)] w-full object-cover object-center"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <StorefrontBrandHero
                restaurantName={displayName}
                logoUrl={logoUrl || null}
              />
            )}
          </section>

          <aside
            id="order"
            className="fixed inset-x-0 top-[72px] z-30 h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain bg-white lg:inset-x-auto lg:right-0 lg:w-[min(100%,420px)]"
          >
            <Sidebar
              mode={mode}
              setMode={setMode}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              apartmentDoorNumber={apartmentDoorNumber}
              setApartmentDoorNumber={setApartmentDoorNumber}
              gateCode={gateCode}
              setGateCode={setGateCode}
              addressName={addressName}
              setAddressName={setAddressName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              selectedStoreId={selectedStoreId}
              setSelectedStoreId={setSelectedStoreId}
              restaurantSlug={slug}
              variant="storefront"
            />
          </aside>
        </div>
      )}
    </div>
  );
}
