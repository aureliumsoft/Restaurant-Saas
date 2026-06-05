import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  IconChevronLeft,
  IconChevronRight,
  IconHeart,
  IconMapPin,
  IconMenu2,
  IconShoppingBag,
  IconShoppingCart,
  IconTruck,
} from '@tabler/icons-react';
import { Loader2, User2Icon, UserIcon } from 'lucide-react';

type Store = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  collectionFrom?: string;
  isFavorite?: boolean;
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
  /** When set (e.g. `/web-app/{slug}`), order flow loads menu via `restaurantSlug` query. */
  restaurantSlug?: string;
  className?: string;
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
}: SidebarProps) {
  const { t } = useTranslation();
  const [activeStores, setActiveStores] = useState<Store[]>();
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [menuBanners, setMenuBanners] = useState<string[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

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
          rows.map((b: any) => ({
            id: String(b.id),
            name: String(b.name || 'Branch'),
            address: String(b.address || 'No address'),
            phone: b.phone ? String(b.phone) : undefined,
          }))
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
    }, 4000);
    return () => clearInterval(interval);
  }, [menuBanners]);

  const createOrder = () => {
    const orderId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `id${Date.now().toString(16)}`;

    const selectedStore = activeStores?.find((s) => s.id === selectedStoreId);

    const paramsObj: Record<string, string> = {
      mode,
      storeId: selectedStoreId || '',
      storeName: selectedStore?.name || '',
      storeAddress: selectedStore?.address || '',
      address: deliveryAddress,
      apartment: apartmentDoorNumber,
      gateCode,
      addressName,
      customerPhone,
    };
    if (restaurantSlug?.trim()) {
      paramsObj.restaurantSlug = restaurantSlug.trim();
    }
    const params = new URLSearchParams(paramsObj).toString();

    const path =
      mode === 'delivery'
        ? `/order/delivery/${orderId}?${params}`
        : `/order/pickUp/${orderId}?${params}`;

    window.location.href = path;
  };

  return (
    <section
      className={`md:sticky max-w-2xl md:top-20 md:z-50 flex flex-col gap-6 self-start rounded-3xl border border-[#e2e8f0] bg-white p-6 text-[#0f172a] shadow-[0_10px_40px_-10px_rgba(15,23,42,0.12)] ${className ?? ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            <User2Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">{t('hiUser')}</p>
            <p className="text-xs text-[#64748b]">{t('welcomeToApp')}</p>
          </div>
        </div>
      </div>
      {menuBanners.length > 0 ? (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-[#e2e8f0]">
            <img
              src={menuBanners[bannerIndex]}
              alt={`Menu banner ${bannerIndex + 1}`}
              className="h-32 w-full object-cover"
            />
            {menuBanners.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 h-7 w-7 -translate-y-1/2"
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
                  className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() =>
                    setBannerIndex((prev) => (prev + 1) % menuBanners.length)
                  }
                >
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          {menuBanners.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {menuBanners.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`h-2 rounded-full transition-all ${
                    idx === bannerIndex
                      ? 'w-5 bg-primary'
                      : 'w-2 bg-[#94a3b8]/50'
                  }`}
                  onClick={() => setBannerIndex(idx)}
                  aria-label={`Go to banner ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold text-[#0f172a]">
              {t('noMenuBanners')}
            </p>
            <p className="text-base font-bold text-[#64748b]">
              {t('addBannersInSettings')}
            </p>
          </div>
        </div>
      )}

      <Card className="overflow-hidden rounded-3xl border border-primary/50 bg-white shadow-xl ">
        <CardContent className="space-y-4 ">
          <div className="flex items-center justify-center gap-2 py-5">
            <Button
              variant={mode === 'delivery' ? 'default' : 'outline'}
              onClick={() => setMode('delivery')}
            >
              <IconTruck className="mr-2" />
              {t('delivery')}
            </Button>
            <Button
              variant={mode === 'takeaway' ? 'default' : 'outline'}
              onClick={() => setMode('takeaway')}
            >
              <IconShoppingBag className="mr-2" />
              {t('takeAwayLabel')}
            </Button>
          </div>

          {mode === 'delivery' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                {t('deliveryAddress')}
              </p>

              <Input
                placeholder={t('yourName')}
                value={addressName}
                onChange={(event) => setAddressName(event.target.value)}
                className="rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#94a3b8]"
              />
              <Input
                type="tel"
                placeholder={t('phoneNumber')}
                value={customerPhone}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, '');
                  setCustomerPhone(value);
                }}
                className="rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#94a3b8]"
              />
              <Input
                placeholder={t('yourAddressRequired')}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                required
                autoComplete="street-address"
                className="rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#94a3b8]"
              />
              <Input
                placeholder={t('apartmentOrDoor')}
                value={apartmentDoorNumber}
                onChange={(event) => setApartmentDoorNumber(event.target.value)}
                className="rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#94a3b8]"
              />
              {/* <Input
                placeholder={t('gateCodeIntercom')}
                value={gateCode}
                onChange={(event) => setGateCode(event.target.value)}
                className="rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#94a3b8]"
              /> */}

              <p className="text-xs text-[#64748b]">{t('deliveryInfoHint')}</p>
              <Button
                className="w-full"
                onClick={createOrder}
                disabled={
                  !deliveryAddress.trim() ||
                  !addressName.trim() ||
                  !customerPhone.trim()
                }
              >
                <IconShoppingCart className="w-4 h-4 mr-2" />
                {t('proceedOrder')}
              </Button>
            </div>
          )}

          {mode === 'takeaway' && (
            <div className="space-y-3">
              <Input
                placeholder={t('yourName')}
                value={addressName}
                onChange={(event) => setAddressName(event.target.value)}
                className="rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#94a3b8]"
              />
              <Input
                type="tel"
                placeholder={t('phoneNumber')}
                value={customerPhone}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, '');
                  setCustomerPhone(value);
                }}
                className="rounded-2xl border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#94a3b8]"
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                {t('selectBranch')}
              </p>
              <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                {branchesLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary text-center mx-auto" />
                )}
                {!branchesLoading && activeStores?.length === 0 && (
                  <p className="text-xs text-[#64748b]">
                    {t('noBranchesTakeaway')}
                  </p>
                )}
                {activeStores?.map((store) => (
                  <div
                    key={store.id}
                    className={`flex items-start justify-between rounded-3xl border bg-[#f8fafc] p-4 transition ${
                      selectedStoreId === store.id
                        ? 'border-primary bg-primary/10'
                        : 'border-[#e2e8f0]'
                    }`}
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="text-sm font-semibold text-[#0f172a]">
                        {store.name}
                      </p>
                      <p className="text-xs text-[#64748b]">{store.address}</p>
                      {store.phone ? (
                        <p className="text-xs text-[#64748b]">
                          {t('phoneLabel')}: {store.phone}
                        </p>
                      ) : null}
                      <p className="text-xs text-[#64748b]">
                        {store.collectionFrom
                          ? t('orderCollectionFrom', {
                              time: store.collectionFrom,
                            })
                          : t('takeawayCollectionAvailable')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant={
                          selectedStoreId === store.id ? 'default' : 'outline'
                        }
                        className={
                          selectedStoreId === store.id
                            ? 'bg-primary text-primary-foreground hover:brightness-95'
                            : 'border-[#e2e8f0] text-[#334155] hover:bg-[#f1f5f9]'
                        }
                        onClick={() => setSelectedStoreId(store.id)}
                      >
                        {selectedStoreId === store.id
                          ? t('selected')
                          : t('select')}
                        <IconChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                      <span className="flex items-center gap-1 text-xs text-[#64748b]">
                        <IconHeart className="h-3.5 w-3.5 text-primary" />
                        {store.isFavorite ? t('favorite') : t('addToFavorites')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                onClick={createOrder}
                disabled={
                  !selectedStoreId ||
                  !addressName.trim() ||
                  !customerPhone.trim()
                }
              >
                <IconShoppingCart className="w-4 h-4 mr-2" />
                {t('proceedOrder')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
