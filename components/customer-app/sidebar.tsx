import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  IconBike,
  IconChevronLeft,
  IconChevronRight,
  IconCrosshair,
  IconShoppingBag,
  IconShoppingCart,
  IconTruck,
} from '@tabler/icons-react';
import { Loader2 } from 'lucide-react';
import { useCustomerAccountOptional } from '@/components/customer-app/customer-account-context';
import { cn } from '@/lib/utils';
import { WEB_CUSTOMER_TAKEAWAY_NAME } from '@/lib/web-customer';
import { writeOrderContext } from '@/lib/order-context-storage';
import { encodeUrlIdClient } from '@/lib/encode-url-id-client';
import {
  getBranchCloseTimeToday,
  isBranchOpenNow,
  type BranchOpeningHours,
} from '@/lib/order-time-slots';
import type { OrderInfo } from '@/components/order/order-types';

function splitAddressLines(address: string): [string, string] {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [address, ''];
  return [parts[0] ?? address, parts.slice(1).join(', ')];
}

type Store = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  collectionFrom?: string;
  openingHours?: BranchOpeningHours | null;
};

type SidebarProps = {
  mode: 'delivery' | 'takeaway';
  setMode: (mode: 'delivery' | 'takeaway') => void;
  deliveryAddress: string;
  setDeliveryAddress: (value: string) => void;
  apartmentDoorNumber: string;
  setApartmentDoorNumber: (value: string) => void;
  gateCode: string;
  setGateCode: (value: string) => void;
  addressName: string;
  setAddressName: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  selectedStoreId: string | null;
  setSelectedStoreId: (id: string | null) => void;
  restaurantSlug?: string;
  className?: string;
  variant?: 'storefront' | 'default';
};

export function Sidebar({
  mode,
  setMode,
  deliveryAddress,
  setDeliveryAddress,
  apartmentDoorNumber,
  setApartmentDoorNumber,
  gateCode,
  setGateCode,
  addressName,
  setAddressName,
  customerPhone,
  setCustomerPhone,
  selectedStoreId,
  setSelectedStoreId,
  restaurantSlug,
  className,
  variant = 'default',
}: SidebarProps) {
  const { t } = useTranslation();
  const customerAccount = useCustomerAccountOptional();
  const customerName = customerAccount?.account?.name?.trim() ?? '';
  const [activeStores, setActiveStores] = useState<Store[]>();
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [menuBanners, setMenuBanners] = useState<string[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [deliveryInfoOpen, setDeliveryInfoOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [isStartingOrder, setIsStartingOrder] = useState(false);

  const selectDeliveryBranch = (storeId: string) => {
    setSelectedStoreId(storeId);
    const store = activeStores?.find((s) => s.id === storeId);
    if (!isBranchOpenNow(store?.openingHours)) return;
    setDeliveryInfoOpen(true);
  };

  const canProceedDelivery =
    Boolean(selectedStoreId) &&
    deliveryAddress.trim().length > 0 &&
    addressName.trim().length > 0 &&
    customerPhone.trim().length > 0;

  useEffect(() => {
    if (!restaurantSlug?.trim()) return;
    let cancelled = false;
    (async () => {
      setBranchesLoading(true);
      try {
        const res = await fetch(
          `/api/customer/branches?slug=${encodeURIComponent(restaurantSlug)}`
        );
        const json = await res.json().catch(() => ({}));
        const rows = Array.isArray(json?.data) ? json.data : [];
        if (cancelled) return;
        if (rows.length === 0) {
          setActiveStores([]);
          return;
        }
        setActiveStores(
          rows.map(
            (b: {
              id: unknown;
              name?: unknown;
              address?: unknown;
              phone?: unknown;
              openingHours?: BranchOpeningHours | null;
            }) => ({
              id: String(b.id),
              name: String(b.name || 'Branch'),
              address: String(b.address || 'No address'),
              phone: b.phone ? String(b.phone) : undefined,
              openingHours: Array.isArray(b.openingHours) ? b.openingHours : null,
            })
          )
        );
      } catch {
        if (!cancelled) setActiveStores([]);
      } finally {
        if (!cancelled) setBranchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  useEffect(() => {
    if (!restaurantSlug?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/customer/restaurant?slug=${encodeURIComponent(restaurantSlug)}`
        );
        const json = await res.json().catch(() => ({}));
        const urls = Array.isArray(json?.data?.menuBannerUrls)
          ? (json.data.menuBannerUrls as string[]).filter(
              (u) => typeof u === 'string' && u.trim() !== ''
            )
          : [];
        if (!cancelled) {
          const name =
            typeof json?.data?.name === 'string' ? json.data.name.trim() : '';
          setRestaurantName(name);
          setMenuBanners(urls);
          setBannerIndex(0);
        }
      } catch {
        if (!cancelled) {
          setMenuBanners([]);
          setBannerIndex(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug]);

  useEffect(() => {
    if (menuBanners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % menuBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [menuBanners]);

  const createOrder = async () => {
    if (isStartingOrder) return;

    const rawOrderId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `id${Date.now().toString(16)}`;

    const selectedStore = activeStores?.find((s) => s.id === selectedStoreId);

    const orderType = mode === 'delivery' ? 'delivery' : 'pickUp';
    const orderInfo: OrderInfo = {
      mode: orderType,
      storeId: selectedStoreId || '',
      storeName: selectedStore?.name || '',
      storeAddress: selectedStore?.address || '',
      address: deliveryAddress.trim(),
      apartment: '',
      gateCode: '',
      addressName:
        mode === 'takeaway' ? WEB_CUSTOMER_TAKEAWAY_NAME : addressName,
      customerPhone: mode === 'takeaway' ? '' : customerPhone,
      ...(restaurantSlug?.trim() ? { restaurantSlug: restaurantSlug.trim() } : {}),
      ...(restaurantName ? { restaurantName } : {}),
    };

    setIsStartingOrder(true);
    setDeliveryInfoOpen(false);

    const orderId = await encodeUrlIdClient(rawOrderId);
    writeOrderContext(orderId, orderInfo);

    const path =
      orderType === 'delivery'
        ? `/order/delivery/${encodeURIComponent(orderId)}`
        : `/order/pickUp/${encodeURIComponent(orderId)}`;

    window.location.href = path;
  };

  const handleGeolocate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: 'application/json' } }
          );
          const data = await res.json().catch(() => null);
          const label =
            typeof data?.display_name === 'string'
              ? data.display_name
              : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setDeliveryAddress(label);
        } catch {
          setDeliveryAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally {
          setGeoLoading(false);
        }
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const bannerCarousel = (
    <>
      {menuBanners.length > 0 ? (
        <div className="relative overflow-hidden rounded-xl bg-[#f8fafc]">
          <img
            src={menuBanners[bannerIndex]}
            alt={`Promotion ${bannerIndex + 1}`}
            className="h-36 w-full object-cover sm:h-40"
          />
          {menuBanners.length > 1 && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/90 shadow"
                onClick={() =>
                  setBannerIndex((prev) =>
                    prev === 0 ? menuBanners.length - 1 : prev - 1
                  )
                }
              >
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/90 shadow"
                onClick={() =>
                  setBannerIndex((prev) => (prev + 1) % menuBanners.length)
                }
              >
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ) : null}
      {menuBanners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {menuBanners.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`h-1.5 rounded-full transition-all ${
                idx === bannerIndex ? 'w-5 bg-primary' : 'w-1.5 bg-[#cbd5e1]'
              }`}
              onClick={() => setBannerIndex(idx)}
              aria-label={`Go to promotion ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </>
  );

  const modeToggle = (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-1">
      <button
        type="button"
        onClick={() => {
          setMode('delivery');
          setDeliveryInfoOpen(false);
        }}
        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${
          mode === 'delivery'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-[#64748b] hover:bg-white'
        }`}
      >
        <IconTruck className="h-5 w-5 shrink-0" />
        {t('delivery')}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode('takeaway');
          setDeliveryInfoOpen(false);
        }}
        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${
          mode === 'takeaway'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-[#64748b] hover:bg-white'
        }`}
      >
        <IconShoppingBag className="h-5 w-5 shrink-0" />
        {t('takeAwayLabel')}
      </button>
    </div>
  );

  const branchList = (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
        {t('selectBranch')}
      </p>
      {!selectedStoreId ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#ececf0] bg-[#f8fafc] px-3 py-2 text-sm text-[#8e8e9a]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
          <span>{t('branchClosed')} · {t('selectBranchToContinue')}</span>
        </div>
      ) : null}
      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {branchesLoading && (
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />
        )}
        {!branchesLoading && activeStores?.length === 0 && (
          <p className="text-xs text-[#64748b]">{t('noBranchesTakeaway')}</p>
        )}
        {activeStores?.map((store) => {
          const openNow = isBranchOpenNow(store.openingHours);
          const closeTime = getBranchCloseTimeToday(store.openingHours);
          const methodLabel =
            mode === 'delivery' ? t('delivery') : t('takeAwayLabel');
          const statusLabel = openNow
            ? t('orderMethodAvailableTill', {
                method: methodLabel,
                time: closeTime ?? '',
              })
            : t('branchClosed');
          return (
          <button
            key={store.id}
            type="button"
            onClick={() =>
              mode === 'delivery'
                ? selectDeliveryBranch(store.id)
                : setSelectedStoreId(store.id)
            }
            className={`flex w-full items-start justify-between rounded-xl border px-3 py-3 text-left transition ${
              selectedStoreId === store.id
                ? 'border-primary bg-primary/5'
                : 'border-[#e5e7eb] bg-white hover:border-primary/40'
            }`}
          >
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-sm font-semibold text-[#0f172a]">{store.name}</p>
              <p className="mt-0.5 text-xs text-[#64748b]">{store.address}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-[#64748b]">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    openNow ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <span>{statusLabel}</span>
              </div>
            </div>
            <IconChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#94a3b8]" />
          </button>
          );
        })}
      </div>
    </div>
  );

  const deliveryDialog = (
    <Dialog open={deliveryInfoOpen} onOpenChange={setDeliveryInfoOpen}>
      <DialogContent className="web-app-customer max-w-md rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-[#0f172a]">{t('customerDetails')}</DialogTitle>
          <DialogDescription className="text-[#64748b]">
            {t('deliveryInfoHint')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder={t('yourName')}
            value={addressName}
            onChange={(event) => setAddressName(event.target.value)}
            className="rounded-xl border-[#e2e8f0]"
            autoComplete="name"
          />
          <Input
            type="tel"
            placeholder={t('phoneNumber')}
            value={customerPhone}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '');
              setCustomerPhone(value);
            }}
            className="rounded-xl border-[#e2e8f0]"
            autoComplete="tel"
          />
          <Input
            placeholder={t('yourAddressRequired')}
            value={deliveryAddress}
            onChange={(event) => {
              setDeliveryAddress(event.target.value);
              if (apartmentDoorNumber) setApartmentDoorNumber('');
            }}
            className={
              deliveryAddress.trim()
                ? 'rounded-xl border-[#e2e8f0]'
                : 'rounded-xl border-primary/70 ring-1 ring-primary/30'
            }
            autoComplete="street-address"
          />
          {!canProceedDelivery ? (
            <p className="text-xs text-[#64748b]">
              {t('deliveryProceedRequired')}
            </p>
          ) : null}
        </div>
        <DialogFooter className="w-full border-t border-[#e2e8f0] pt-4">
          <Button
            className="w-full gap-2 bg-primary text-primary-foreground hover:brightness-95"
            onClick={createOrder}
            disabled={!canProceedDelivery || isStartingOrder}
          >
            {isStartingOrder ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <IconShoppingCart className="h-4 w-4" aria-hidden />
            )}
            {isStartingOrder ? t('processing') : t('proceedOrder')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );


  if (variant === 'storefront') {
    const handleTakeawayProceed = () => {
      if (!selectedStoreId || isStartingOrder) return;
      createOrder();
    };

    return (
      <section
        className={cn(
          'flex flex-col gap-5 bg-white px-4 pb-8 pt-4 sm:gap-6 sm:px-5 sm:pb-10 sm:pt-5 lg:px-5 lg:pb-8 lg:pt-5',
          className
        )}
      >
        <p className="text-[1.65rem] font-bold leading-tight text-primary">
          {customerName
            ? `${t('storefrontHi')} ${customerName}`
            : t('storefrontHi')}
        </p>

        {menuBanners.length > 0 ? (
          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex gap-3 transition-transform duration-300 ease-out"
                style={{
                  transform: `translateX(calc(-${bannerIndex} * (88% + 0.75rem)))`,
                }}
              >
                {menuBanners.map((url, idx) => (
                  <div key={url + idx} className="w-[88%] shrink-0">
                    <img
                      src={url}
                      alt={`Promotion ${idx + 1}`}
                      className="h-[168px] w-full rounded-2xl object-cover sm:h-48"
                    />
                  </div>
                ))}
              </div>
            </div>
            {menuBanners.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-md transition hover:scale-105"
                  onClick={() =>
                    setBannerIndex((prev) =>
                      prev === 0 ? menuBanners.length - 1 : prev - 1
                    )
                  }
                  aria-label="Previous promotion"
                >
                  <IconChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="absolute right-6 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-md transition hover:scale-105"
                  onClick={() =>
                    setBannerIndex((prev) => (prev + 1) % menuBanners.length)
                  }
                  aria-label="Next promotion"
                >
                  <IconChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setMode('delivery');
              setDeliveryInfoOpen(false);
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-2.5 rounded-2xl px-3 py-7 transition-colors sm:gap-3 sm:py-8',
              mode === 'delivery'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-[#f4f4f6] text-primary hover:bg-[#ececf0]'
            )}
          >
            <IconBike className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" stroke={1.5} />
            <span className="text-sm font-semibold">{t('delivery')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('takeaway');
              setDeliveryInfoOpen(false);
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-2.5 rounded-2xl px-3 py-7 transition-colors sm:gap-3 sm:py-8',
              mode === 'takeaway'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-[#f4f4f6] text-primary hover:bg-[#ececf0]'
            )}
          >
            <IconShoppingBag className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" stroke={1.5} />
            <span className="text-sm font-semibold">{t('takeAwayLabel')}</span>
          </button>
        </div>

        {mode === 'delivery' ? (
          <div className="space-y-3">
            <p className="text-sm font-bold leading-snug text-primary">
              {t('storefrontDeliveryAddressHint')}
            </p>

            <div className="flex overflow-hidden rounded-2xl bg-[#f4f4f6]">
              <input
                type="text"
                placeholder={t('storefrontAddAddress')}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                autoComplete="street-address"
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3.5 text-sm text-[#1f1f2e] outline-none placeholder:text-[#9ca3af]"
              />
              <button
                type="button"
                className="flex w-14 shrink-0 items-center justify-center bg-primary text-primary-foreground transition hover:brightness-95 disabled:opacity-60"
                onClick={handleGeolocate}
                disabled={geoLoading}
                aria-label={t('storefrontGeolocate')}
              >
                {geoLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <IconCrosshair className="h-5 w-5" stroke={1.75} />
                )}
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {branchesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : null}
          {!branchesLoading && activeStores?.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#8e8e9a]">
              {t('noBranchesTakeaway')}
            </p>
          ) : null}
          {!branchesLoading && !selectedStoreId && (activeStores?.length ?? 0) > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl border border-[#ececf0] bg-[#f8fafc] px-4 py-3 text-sm text-[#8e8e9a]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
              <span>
                {t('branchClosed')} · {t('selectBranchToContinue')}
              </span>
            </div>
          ) : null}
          {activeStores?.map((store) => {
            const [line1, line2] = splitAddressLines(store.address);
            const selected = selectedStoreId === store.id;
            const openNow = isBranchOpenNow(store.openingHours);
            const closeTime = getBranchCloseTimeToday(store.openingHours);
            const methodLabel =
              mode === 'delivery' ? t('delivery') : t('takeAwayLabel');
            const statusLabel = openNow
              ? t('orderMethodAvailableTill', {
                  method: methodLabel,
                  time: closeTime ?? '',
                })
              : t('branchClosed');

            return (
              <button
                key={store.id}
                type="button"
                onClick={() =>
                  mode === 'delivery'
                    ? selectDeliveryBranch(store.id)
                    : setSelectedStoreId(store.id)
                }
                className={cn(
                  'w-full rounded-2xl border bg-white p-4 text-left transition',
                  selected
                    ? 'border-primary shadow-[0_0_0_1px_var(--primary)]'
                    : 'border-[#ececf0] hover:border-primary/30'
                )}
              >
                <p className="text-base font-bold text-primary">{store.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#8e8e9a]">
                  {line1}
                </p>
                {line2 ? (
                  <p className="text-sm leading-relaxed text-[#8e8e9a]">{line2}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-2 text-sm text-[#8e8e9a]">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      openNow ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span>{statusLabel}</span>
                </div>
              </button>
            );
          })}
        </div>

        {mode === 'delivery' &&
        selectedStoreId &&
        deliveryAddress.trim() &&
        isBranchOpenNow(
          activeStores?.find((s) => s.id === selectedStoreId)?.openingHours
        ) ? (
          <Button
            className="h-12 w-full rounded-2xl text-sm font-semibold"
            onClick={() => setDeliveryInfoOpen(true)}
          >
            {t('enterDeliveryDetails')}
          </Button>
        ) : null}

        {mode === 'takeaway' &&
        selectedStoreId &&
        isBranchOpenNow(
          activeStores?.find((s) => s.id === selectedStoreId)?.openingHours
        ) ? (
          <Button
            className="h-12 w-full gap-2 rounded-2xl text-sm font-semibold"
            onClick={handleTakeawayProceed}
            disabled={isStartingOrder}
          >
            {isStartingOrder ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <IconShoppingCart className="h-4 w-4" aria-hidden />
            )}
            {isStartingOrder ? t('processing') : t('proceedOrder')}
          </Button>
        ) : null}

        {deliveryDialog}
      </section>
    );
  }

  return (
    <section
      className={`md:sticky flex max-w-2xl flex-col gap-6 self-start rounded-3xl border border-[#e2e8f0] bg-white p-6 text-[#0f172a] shadow-[0_10px_40px_-10px_rgba(15,23,42,0.12)] md:top-20 md:z-50 ${className ?? ''}`}
    >
      {bannerCarousel}
      {modeToggle}
      {branchList}
      {deliveryDialog}
    </section>
  );
}
