'use client';

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconArrowLeft,
  IconArrowRight,
  IconMinus,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { OrderInfo } from '@/components/order/order-types';
import { inferHostSubdomainForMenu } from '@/lib/customer-menu-client';
import { resolveWebCustomerName } from '@/lib/web-customer';
import { ProductLineDetails } from '@/components/orders/product-line-details';
import {
  resolveCartLineImageUrl,
} from '@/lib/cart-line-display';
import {
  cartLineTotal,
  cartLineUnitTotal,
  normalizeCartModifiers,
} from '@/lib/cart-normalize';
import {
  onlineCartStorageKey,
  writeCartToLocalStorage,
} from '@/lib/cart-storage';
import { orderPathWithQuery } from '@/lib/order-search-params';
import { WebAppRestaurantTitle } from '@/components/customer-app/web-app-restaurant-title';
import { CutleryOption } from '@/components/order/cutlery-option';
import { OrderPreferencesSummary } from '@/components/order/order-preferences-summary';
import { buildCustomerLightSurfaceVars, buildStorefrontThemeVars } from '@/lib/restaurant-theme';
import { cn } from '@/lib/utils';
import { useRestaurantServiceCharges } from '@/hooks/use-restaurant-service-charges';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useOrderInfo } from '@/hooks/use-order-info';
import {
  readCutleryPreference,
  readOrderCommentPreference,
  writeCutleryPreference,
  writeOrderCommentPreference,
} from '@/lib/online-order-preferences';

type CartModifierSelection = {
  attributeGroupId: string;
  groupName: string;
  selections: { menuItemId: string; name: string; unitPrice: number }[];
};

type CartLine = {
  lineId: string;
  menuItemId: string;
  productName: string;
  description: string | null;
  imageUrl: string | null;
  baseUnitPrice: number;
  quantity: number;
  variationId?: string | null;
  variationName?: string | null;
  variationPriceOverride?: number;
  modifiers: CartModifierSelection[];
  modifiersSignature: string;
};

type CartPageProps = {
  orderType: 'delivery' | 'pickUp';
  orderId: string;
  orderInfo?: OrderInfo;
};

type OfferedProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  unitPrice: number;
};

type CartOfferItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  salePrice: number | null;
};

function lineUnitTotal(line: CartLine) {
  return cartLineUnitTotal(line);
}

function lineTotal(line: CartLine) {
  return cartLineTotal(line);
}

function parseCartFromStorage(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const out: CartLine[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;

      const maybeLine = row as Partial<CartLine> & {
        lineId?: string;
        baseUnitPrice?: number;
      };
      if (
        typeof maybeLine.lineId === 'string' &&
        typeof maybeLine.baseUnitPrice === 'number'
      ) {
        out.push({
          lineId: maybeLine.lineId,
          menuItemId: String(maybeLine.menuItemId ?? ''),
          productName: String((maybeLine as any).productName ?? ''),
          description: (maybeLine as any).description ?? null,
          imageUrl: (maybeLine as any).imageUrl ?? null,
          baseUnitPrice: maybeLine.baseUnitPrice,
          quantity: Number(maybeLine.quantity ?? 1),
          variationId: (maybeLine as CartLine).variationId ?? null,
          variationName: (maybeLine as CartLine).variationName ?? null,
          variationPriceOverride: (maybeLine as CartLine)
            .variationPriceOverride,
          modifiers: normalizeCartModifiers((maybeLine as any).modifiers),
          modifiersSignature: String(maybeLine.modifiersSignature ?? ''),
        });
        continue;
      }

      // Legacy: { product: {id,name,price,image,description...}, quantity }
      const legacy = row as any;
      if (
        legacy?.product?.id &&
        typeof legacy.quantity === 'number' &&
        typeof legacy.product.price === 'number'
      ) {
        const p = legacy.product;
        out.push({
          lineId: `legacy-${p.id}`,
          menuItemId: p.id,
          productName: String(p.name ?? p.id),
          description: p.description ?? null,
          imageUrl: p.imageUrl ?? p.image ?? null,
          baseUnitPrice: Number(p.price),
          quantity: legacy.quantity,
          modifiers: [],
          modifiersSignature: '',
        });
      }
    }

    return out;
  } catch {
    return [];
  }
}

export default function CartPageClient({
  orderType,
  orderId,
  orderInfo: initialOrderInfo,
}: CartPageProps) {
  const orderInfo = useOrderInfo(orderId, orderType, initialOrderInfo);
  const { t } = useTranslation();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productImages, setProductImages] = useState<
    Record<string, string | null>
  >({});
  const [cartOffers, setCartOffers] = useState<CartOfferItem[]>([]);
  const [offersOpen, setOffersOpen] = useState(false);
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cutlery, setCutlery] = useState(false);
  const [comment, setComment] = useState('');
  const router = useRouter();
  const [isProceeding, startProceedTransition] = useTransition();

  useEffect(() => {
    setCart(parseCartFromStorage(localStorage.getItem(`cart-${orderId}`)));
    setCutlery(readCutleryPreference(orderId));
    setComment(readOrderCommentPreference(orderId));
  }, [orderId]);

  const setCutleryChoice = (next: boolean) => {
    setCutlery(next);
    writeCutleryPreference(orderId, next);
  };

  const setCommentChoice = (next: string) => {
    setComment(next);
    writeOrderCommentPreference(orderId, next);
  };

  useEffect(() => {
    setCustomerName(orderInfo?.addressName?.trim() ?? '');
    setCustomerPhone(orderInfo?.customerPhone?.trim() ?? '');
  }, [orderInfo?.addressName, orderInfo?.customerPhone, orderId]);

  const resolvedCustomerName = resolveWebCustomerName(
    orderType,
    customerName.trim() || orderInfo?.addressName
  );
  const resolvedCustomerPhone =
    customerPhone.trim() || orderInfo?.customerPhone?.trim() || '';

  const orderInfoWithCustomer = useMemo((): OrderInfo | undefined => {
    if (!orderInfo) return undefined;
    return {
      ...orderInfo,
      addressName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
    };
  }, [orderInfo, resolvedCustomerName, resolvedCustomerPhone]);

  const customerDetailsValid = useMemo(() => {
    if (orderType === 'pickUp') {
      return true;
    }
    return (
      resolvedCustomerName.length > 0 &&
      resolvedCustomerPhone.length > 0 &&
      Boolean(orderInfo?.address?.trim())
    );
  }, [
    orderType,
    resolvedCustomerName,
    resolvedCustomerPhone,
    orderInfo?.address,
  ]);

  const proceedToCheckout = () => {
    if (!customerDetailsValid) {
      toast.error(t('customerDetailsRequired'));
      return;
    }
    startProceedTransition(() => {
      router.push(
        orderPathWithQuery(
          `/order/${orderType}/${encodeURIComponent(orderId)}/checkout`,
          orderInfoWithCustomer
        )
      );
    });
  };

  const updateCart = (next: CartLine[]) => {
    setCart(next);
    writeCartToLocalStorage(onlineCartStorageKey(orderId), next);
  };

  const adjustQuantity = (lineId: string, delta: number) => {
    const newCart = cart
      .map((item) =>
        item.lineId === lineId
          ? { ...item, quantity: item.quantity + delta }
          : item
      )
      .filter((item) => item.quantity > 0);
    updateCart(newCart);
  };

  const removeFromCart = (lineId: string) => {
    updateCart(cart.filter((item) => item.lineId !== lineId));
  };

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + lineTotal(item), 0),
    [cart]
  );
  const { serviceChargeAmount } = useRestaurantServiceCharges(
    orderInfo?.restaurantSlug,
    'online'
  );
  const { formatMoney } = useRestaurantRegional(orderInfo?.restaurantSlug);
  const grandTotal = total + serviceChargeAmount;

  const productImageById = useMemo(() => {
    return new Map<string, string | null>(Object.entries(productImages));
  }, [productImages]);

  const offeredProducts: OfferedProduct[] = useMemo(() => {
    if (cartOffers.length === 0 || cart.length === 0) return [];
    const inCart = new Set(cart.map((l) => l.menuItemId));
    const out: OfferedProduct[] = [];
    for (const item of cartOffers) {
      if (inCart.has(item.id)) continue;
      const unitPrice =
        item.salePrice != null &&
        item.salePrice > 0 &&
        item.salePrice < item.price
          ? item.salePrice
          : item.price;
      out.push({
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        unitPrice,
      });
    }
    return out;
  }, [cart, cartOffers]);

  useEffect(() => {
    if (offeredProducts.length > 0) {
      setOffersOpen(true);
    }
  }, [offeredProducts.length]);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const slug = orderInfo?.restaurantSlug?.trim();
        const store = orderInfo?.storeId?.trim();
        const subdomain = inferHostSubdomainForMenu();
        const lookup = slug
          ? `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`
          : store || subdomain
            ? `/api/customer/restaurant?subdomain=${encodeURIComponent(
                store || subdomain || ''
              )}`
            : null;
        if (!lookup) return;
        const res = await fetch(lookup);
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const c =
          typeof json?.data?.themePrimaryColor === 'string'
            ? json.data.themePrimaryColor.trim()
            : '';
        setThemePrimaryColor(c || null);
      } catch {
        // noop
      }
    };
    void loadTheme();
  }, [orderInfo?.restaurantSlug, orderInfo?.storeId]);

  const pageThemeVars = useMemo(
    () =>
      ({
        ...buildStorefrontThemeVars(themePrimaryColor),
        ...buildCustomerLightSurfaceVars(themePrimaryColor),
        colorScheme: 'light',
      }) as CSSProperties,
    [themePrimaryColor]
  );

  const offersDialogVars = pageThemeVars;

  useEffect(() => {
    const loadOffers = async () => {
      try {
        const hostSubdomain = inferHostSubdomainForMenu();
        const slug = orderInfo?.restaurantSlug?.trim() || null;
        const queryStoreId =
          orderInfo?.storeId && orderInfo.storeId.trim().length > 0
            ? orderInfo.storeId.trim()
            : null;
        const query = slug
          ? `slug=${encodeURIComponent(slug)}`
          : queryStoreId || hostSubdomain
            ? `subdomain=${encodeURIComponent(queryStoreId || hostSubdomain || '')}`
            : null;

        const itemIds = [
          ...new Set(cart.map((l) => l.menuItemId).filter(Boolean)),
        ];
        if (!query || itemIds.length === 0) {
          setProductImages({});
          setCartOffers([]);
          return;
        }

        const res = await fetch(
          `/api/customer/menu/cart-offers?${query}&itemIds=${encodeURIComponent(itemIds.join(','))}`
        );
        if (!res.ok) {
          setProductImages({});
          setCartOffers([]);
          return;
        }

        const payload = (await res.json()) as {
          data?: {
            images?: Record<string, string | null>;
            offers?: CartOfferItem[];
          };
        };
        setProductImages(payload.data?.images ?? {});
        setCartOffers(payload.data?.offers ?? []);
      } catch {
        setProductImages({});
        setCartOffers([]);
      }
    };

    void loadOffers();
  }, [cart, orderInfo?.storeId, orderInfo?.restaurantSlug]);

  const handleAddOffered = (p: OfferedProduct) => {
    const line: CartLine = {
      lineId:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `l${Date.now()}-${Math.random().toString(16).slice(2)}`,
      menuItemId: p.id,
      productName: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      baseUnitPrice: p.unitPrice,
      quantity: 1,
      modifiers: [],
      modifiersSignature: '',
    };
    const next = [...cart, line];
    updateCart(next);
  };

  const panelClass =
    'overflow-hidden border border-[#e8eaef] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.08)]';

  return (
    <div
      className="web-app-customer min-h-screen bg-[#f4f4f6] text-[#1f1f2e]"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-3xl px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-8">
        <div className="mb-6 space-y-3">
          <WebAppRestaurantTitle
            restaurantName={orderInfo?.restaurantName}
            subtitle={
              <span className="font-medium text-[#8e8e9a]">
                {orderType === 'delivery' ? t('delivery') : t('orderPickUpLabel')}
              </span>
            }
          />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-primary">{t('yourCart')}</h2>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 border-[#e8eaef] bg-white text-primary hover:bg-white"
              onClick={() =>
                router.push(
                  orderPathWithQuery(
                    `/order/${orderType}/${encodeURIComponent(orderId)}`,
                    orderInfo
                  )
                )
              }
            >
              <IconArrowLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('backToOrder')}</span>
            </Button>
          </div>
        </div>

        {orderInfo && (
          <section className={cn(panelClass, 'mb-4')}>
            <div className="border-b border-[#ececf0] bg-primary px-4 py-3 text-primary-foreground">
              <h3 className="text-sm font-bold">{t('orderDetails')}</h3>
            </div>
            <div className="grid gap-2.5 px-4 py-4 text-sm text-[#1f1f2e]">
              <div className="flex justify-between gap-3">
                <span className="text-[#8e8e9a]">{t('mode')}</span>
                <span className="font-semibold capitalize">{orderInfo.mode}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8e8e9a]">{t('name')}</span>
                <span className="font-semibold">{resolvedCustomerName || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8e8e9a]">{t('phoneLabel')}</span>
                <span className="font-semibold">
                  {customerPhone.trim() || orderInfo.customerPhone || 'N/A'}
                </span>
              </div>
              {orderInfo.mode === 'delivery' ? (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 text-[#8e8e9a]">{t('address')}</span>
                    <span className="break-words text-right font-semibold">
                      {orderInfo.address || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8e8e9a]">{t('apartment')}</span>
                    <span className="font-semibold">
                      {orderInfo.apartment || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8e8e9a]">{t('gateCode')}</span>
                    <span className="font-semibold">
                      {orderInfo.gateCode || 'N/A'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#8e8e9a]">{t('store')}</span>
                    <span className="break-words text-right font-semibold">
                      {orderInfo.storeName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 text-[#8e8e9a]">{t('storeAddress')}</span>
                    <span className="break-words text-right font-semibold">
                      {orderInfo.storeAddress || 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {cart.length === 0 ? (
          <section className={cn(panelClass, 'px-6 py-12 text-center')}>
            <p className="text-lg font-bold text-primary">{t('cartEmpty')}</p>
            <p className="mt-2 text-sm text-[#8e8e9a]">{t('orderCartEmptyHint')}</p>
            <Button
              className="mt-6 gap-2"
              onClick={() =>
                router.push(
                  orderPathWithQuery(
                    `/order/${orderType}/${encodeURIComponent(orderId)}`,
                    orderInfo
                  )
                )
              }
              type="button"
            >
              <IconArrowLeft className="h-4 w-4" aria-hidden />
              {t('backToOrder')}
            </Button>
          </section>
        ) : (
          <>
            <section className={cn(panelClass, 'mb-4 divide-y divide-[#ececf0]')}>
              {cart.map((line) => {
                const displayImageUrl = resolveCartLineImageUrl(
                  line,
                  productImageById
                );
                return (
                  <div
                    key={line.lineId}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {displayImageUrl ? (
                        <img
                          src={displayImageUrl}
                          alt={line.productName}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f6] text-xs text-[#8e8e9a]">
                          —
                        </div>
                      )}
                      <div className="min-w-0">
                        <ProductLineDetails
                          productName={line.productName}
                          variationName={line.variationName}
                          modifiers={line.modifiers}
                          showPrices
                          formatMoney={formatMoney}
                          titleClassName="text-sm font-bold leading-snug text-primary"
                          sectionLabelClassName="text-[10px] font-semibold uppercase tracking-wide text-primary/60"
                          lineClassName="truncate text-xs text-primary/75"
                        />
                        <p className="mt-1.5 text-xs text-[#8e8e9a]">
                          {t('unitPrice')}: {formatMoney(lineUnitTotal(line))}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground transition hover:brightness-95 disabled:opacity-40"
                          onClick={() => adjustQuantity(line.lineId, -1)}
                          disabled={line.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <IconMinus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold text-[#1f1f2e]">
                          {String(line.quantity).padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground transition hover:brightness-95"
                          onClick={() => adjustQuantity(line.lineId, 1)}
                          aria-label="Increase quantity"
                        >
                          <IconPlus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-primary">
                          {formatMoney(lineTotal(line))}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center bg-[#fee2e2] text-[#b91c1c] transition hover:bg-[#fecaca]"
                          onClick={() => removeFromCart(line.lineId)}
                          aria-label="Remove item"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className={cn(panelClass, 'p-4 space-y-4')}>
              <CutleryOption value={cutlery} onChange={setCutleryChoice} />
              <div>
                <p className="text-sm font-bold text-primary">{t('comment')}</p>
                <textarea
                  value={comment}
                  onChange={(e) => setCommentChoice(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#e8eaef] bg-[#f4f4f6] p-3 text-sm text-[#1f1f2e] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t('commentPlaceholder')}
                  rows={3}
                />
              </div>
              <OrderPreferencesSummary
                cutlery={cutlery}
                comment={comment}
                className="border-[#ececf0] bg-[#f8f8fa] text-[#1f1f2e]"
              />
              <div className="space-y-2 border-t border-[#ececf0] pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#8e8e9a]">{t('subtotal')}</span>
                  <span className="font-semibold text-[#1f1f2e]">
                    {formatMoney(total)}
                  </span>
                </div>
                {serviceChargeAmount > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8e8e9a]">{t('serviceFees')}</span>
                    <span className="font-semibold text-[#1f1f2e]">
                      {formatMoney(serviceChargeAmount)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-base font-bold text-primary">{t('total')}</span>
                  <span className="text-lg font-bold text-primary">
                    {formatMoney(grandTotal)}
                  </span>
                </div>
              </div>
              {offeredProducts.length > 0 ? (
                <Button
                  variant="outline"
                  className="h-11 w-full border-[#e8eaef] bg-white text-primary"
                  type="button"
                  onClick={() => setOffersOpen(true)}
                >
                  {t('viewRecommendedAddons')}
                </Button>
              ) : null}
              <Button
                className="h-12 w-full gap-2 rounded-none text-sm font-bold"
                disabled={
                  cart.length === 0 || !customerDetailsValid || isProceeding
                }
                onClick={proceedToCheckout}
                type="button"
              >
                {isProceeding ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <IconArrowRight className="h-4 w-4" aria-hidden />
                )}
                {isProceeding ? t('processing') : t('proceedToCheckout')}
              </Button>
            </section>
          </>
        )}
      </div>

      <Dialog open={offersOpen} onOpenChange={setOffersOpen}>
        <DialogContent
          className="max-w-[min(100vw-2rem,32rem)] border-[#e8eaef] bg-white text-[#1f1f2e]"
          style={offersDialogVars}
        >
          <DialogHeader>
            <DialogTitle className="text-primary">{t('recommendedAddons')}</DialogTitle>
          </DialogHeader>
          {offeredProducts.length === 0 ? (
            <p className="text-sm text-[#8e8e9a]">{t('noExtraProducts')}</p>
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto py-1">
              {offeredProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#e8eaef] bg-[#fafafa] p-2.5 text-sm"
                  onClick={() => handleAddOffered(p)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f6] text-xs text-[#8e8e9a]">
                        —
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-primary">
                        {p.name}
                      </div>
                      {p.description ? (
                        <div className="truncate text-xs text-[#8e8e9a]">
                          {p.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-primary">
                      {formatMoney(p.unitPrice)}
                    </span>
                    <Button
                      size="sm"
                      type="button"
                      className="h-9"
                      onClick={() => handleAddOffered(p)}
                    >
                      {t('add')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-[#e8eaef]"
              onClick={() => setOffersOpen(false)}
            >
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
