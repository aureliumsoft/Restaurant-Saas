'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';

import { Sidebar } from '@/components/customer-app/sidebar';
import { StorefrontBrandHero } from '@/components/customer-app/storefront/storefront-brand-hero';
import { ORDER_SIDEBAR_WIDTH_PX } from '@/components/order/order-menu-header';
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
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
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
              fulfillmentSettings?: { deliveryEnabled?: boolean };
            }
          | null
          | undefined;
        if (cancelled) return;
        const deliveryOn = data?.fulfillmentSettings?.deliveryEnabled !== false;
        setDeliveryEnabled(deliveryOn);
        if (!deliveryOn) {
          setMode('takeaway');
        }
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
      className="flex min-h-0 flex-1 flex-col bg-[#f4f4f6]"
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
        <div className="relative w-full lg:mt-[72px] lg:h-[calc(100dvh-72px)] lg:max-h-[calc(100dvh-72px)] lg:overflow-hidden">
          {/* Desktop: poster fills remaining viewport height; never taller than screen */}
          <section
            aria-label={displayName}
            className="relative hidden h-full bg-white lg:block"
            style={{ width: `calc(100% - ${ORDER_SIDEBAR_WIDTH_PX}px)` }}
          >
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt={`${displayName} banner`}
                className="absolute inset-0 h-full w-full object-cover object-center"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0">
                <StorefrontBrandHero
                  restaurantName={displayName}
                  logoUrl={logoUrl || null}
                />
              </div>
            )}
          </section>

          <aside
            id="order"
            className="fixed inset-x-0 top-[72px] z-30 flex h-[calc(100dvh-72px)] max-h-[calc(100dvh-72px)] flex-col bg-[#f4f4f6] p-3 lg:inset-x-auto lg:right-0 lg:w-[var(--order-sidebar-width)]"
            style={
              {
                ['--order-sidebar-width' as string]: `${ORDER_SIDEBAR_WIDTH_PX}px`,
              } as CSSProperties
            }
          >
            <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col lg:mx-0 lg:max-w-none">
              <div className="flex h-full min-h-0 flex-col overflow-hidden border border-[#e8eaef] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.08)]">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    deliveryEnabled={deliveryEnabled}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
