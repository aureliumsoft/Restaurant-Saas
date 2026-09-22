'use client';

import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import type { OrderInfo } from '@/components/order/order-types';
import {
  cartLineTitle,
  cartModifierDisplayLines,
} from '@/lib/cart-line-display';
import { orderPathWithQuery } from '@/lib/order-search-params';
import { submitCustomerOrder } from '@/lib/offline/submit-order';
import { WebAppRestaurantTitle } from '@/components/customer-app/web-app-restaurant-title';
import { PayPalCheckoutButtons } from '@/components/payments/paypal-checkout-buttons';
import { StripeCheckoutButton } from '@/components/payments/stripe-checkout-button';
import { JazzCashCheckoutButton } from '@/components/payments/jazzcash-checkout-button';
import { EasypaisaCheckoutButton } from '@/components/payments/easypaisa-checkout-button';
import { CutleryOption } from '@/components/order/cutlery-option';
import { OrderPreferencesSummary } from '@/components/order/order-preferences-summary';
import { useRestaurantServiceCharges } from '@/hooks/use-restaurant-service-charges';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useRestaurantBranding } from '@/components/layout/restaurant-branding-provider';
import { useCustomerAccount } from '@/components/customer-app/customer-account-context';
import { useOrderInfo } from '@/hooks/use-order-info';
import { inferHostSubdomainForMenu } from '@/lib/customer-menu-client';
import {
  buildCustomerLightSurfaceVars,
  buildStorefrontThemeVars,
} from '@/lib/restaurant-theme';
import {
  LAST_CUSTOMER_RESTAURANT_SLUG_KEY,
  readCachedRestaurantThemePrimary,
  writeCachedRestaurantThemePrimary,
} from '@/lib/restaurant-theme-persist';
import {
  clearOnlineOrderPreferences,
  readCutleryPreference,
  readOrderCommentPreference,
  writeCutleryPreference,
  writeOrderCommentPreference,
} from '@/lib/online-order-preferences';
import { readOrderSchedule } from '@/lib/order-time-slots';

function formatOrderApiError(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return 'Could not place order. Please try again.';
  }
  const err = (body as { error?: unknown }).error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const flat = err as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
    const fieldMsg = Object.values(flat.fieldErrors ?? {})
      .flat()
      .find((m): m is string => typeof m === 'string' && m.length > 0);
    if (fieldMsg) return fieldMsg;
    if (flat.formErrors?.[0]) return flat.formErrors[0];
    return 'Invalid order data';
  }
  return 'Could not place order. Please try again.';
}

type CheckoutPageProps = {
  orderType: 'delivery' | 'pickUp';
  orderId: string;
  orderInfo?: OrderInfo;
  initialThemePrimaryColor?: string | null;
};

type CartModifierSelection = {
  attributeGroupId: string;
  groupName: string;
  parentSelectionKey?: string;
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

function lineUnitTotal(line: CartLine) {
  const base =
    line.variationId && line.variationPriceOverride != null
      ? line.variationPriceOverride
      : line.baseUnitPrice;
  const modTotal = line.modifiers.reduce(
    (sum, m) => sum + m.selections.reduce((s2, sel) => s2 + sel.unitPrice, 0),
    0
  );
  return base + modTotal;
}

function lineTotal(line: CartLine) {
  return lineUnitTotal(line) * line.quantity;
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
          variationPriceOverride: (maybeLine as CartLine).variationPriceOverride,
          modifiers: Array.isArray((maybeLine as any).modifiers)
            ? (maybeLine as any).modifiers
            : [],
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

export default function CheckoutPageClient({
  orderType,
  orderId,
  orderInfo: initialOrderInfo,
  initialThemePrimaryColor = null,
}: CheckoutPageProps) {
  const { t } = useTranslation();
  const orderInfo = useOrderInfo(orderId, orderType, initialOrderInfo);
  const brand = useRestaurantBranding();
  const { restaurantSlug: accountRestaurantSlug } = useCustomerAccount();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const router = useRouter();
  const [cutlery, setCutlery] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    initialThemePrimaryColor
  );
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);

  const [paymentConfig, setPaymentConfig] = useState<{
    provider: 'NONE' | 'PAYPAL' | 'STRIPE' | 'WALLETS';
    ready: boolean;
    currencyCode?: string;
    wallets?: {
      jazzcash?: { ready: true };
      easypaisa?: { ready: true };
    };
  } | null>(null);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(true);

  const effectiveSlug = useMemo(() => {
    return (
      orderInfo?.restaurantSlug?.trim() ||
      resolvedSlug?.trim() ||
      accountRestaurantSlug?.trim() ||
      brand?.restaurantSlug?.trim() ||
      (typeof window !== 'undefined'
        ? localStorage.getItem(LAST_CUSTOMER_RESTAURANT_SLUG_KEY)?.trim()
        : null) ||
      ''
    );
  }, [
    orderInfo?.restaurantSlug,
    resolvedSlug,
    accountRestaurantSlug,
    brand?.restaurantSlug,
  ]);

  useLayoutEffect(() => {
    const slug =
      orderInfo?.restaurantSlug?.trim() ||
      accountRestaurantSlug?.trim() ||
      brand?.restaurantSlug?.trim() ||
      null;
    const cached =
      initialThemePrimaryColor || readCachedRestaurantThemePrimary(slug);
    if (!cached) return;
    setThemePrimaryColor((prev) => prev || cached);
    writeCachedRestaurantThemePrimary(slug, cached);
  }, [
    accountRestaurantSlug,
    brand?.restaurantSlug,
    initialThemePrimaryColor,
    orderInfo?.restaurantSlug,
  ]);

  useEffect(() => {
    if (effectiveSlug) {
      try {
        localStorage.setItem(LAST_CUSTOMER_RESTAURANT_SLUG_KEY, effectiveSlug);
      } catch {
        // ignore
      }
    }
  }, [effectiveSlug]);

  useEffect(() => {
    let cancelled = false;
    const loadThemeAndSlug = async () => {
      try {
        const slug =
          orderInfo?.restaurantSlug?.trim() ||
          accountRestaurantSlug?.trim() ||
          brand?.restaurantSlug?.trim() ||
          (typeof window !== 'undefined'
            ? localStorage.getItem(LAST_CUSTOMER_RESTAURANT_SLUG_KEY)?.trim()
            : null);
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
        if (cancelled) return;
        const c =
          typeof json?.data?.themePrimaryColor === 'string'
            ? json.data.themePrimaryColor.trim()
            : '';
        setThemePrimaryColor(c || null);
        const fetchedSlug =
          typeof json?.data?.slug === 'string' ? json.data.slug.trim() : '';
        if (fetchedSlug) {
          setResolvedSlug(fetchedSlug);
        }
        writeCachedRestaurantThemePrimary(fetchedSlug || slug, c || null);
      } catch {
        // noop
      }
    };
    void loadThemeAndSlug();
    return () => {
      cancelled = true;
    };
  }, [
    orderInfo?.restaurantSlug,
    orderInfo?.storeId,
    accountRestaurantSlug,
    brand?.restaurantSlug,
  ]);

  const pageThemeVars = useMemo(
    () =>
      ({
        ...buildStorefrontThemeVars(themePrimaryColor),
        ...buildCustomerLightSurfaceVars(themePrimaryColor),
        colorScheme: 'light',
      }) as CSSProperties,
    [themePrimaryColor]
  );

  useEffect(() => {
    const slug = effectiveSlug.trim();
    if (!slug) {
      setPaymentConfig(null);
      setPaymentConfigLoading(false);
      return;
    }
    let cancelled = false;
    setPaymentConfigLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/customer/payment-config?restaurantSlug=${encodeURIComponent(slug)}`,
          { cache: 'no-store' }
        );
        const body = (await res.json().catch(() => ({}))) as {
          data?: {
            provider?: 'NONE' | 'PAYPAL' | 'STRIPE' | 'WALLETS';
            ready?: boolean;
            currencyCode?: string;
            wallets?: {
              jazzcash?: { ready: true };
              easypaisa?: { ready: true };
            };
          };
        };
        if (!cancelled) {
          setPaymentConfig(
            body.data
              ? {
                  provider: body.data.provider ?? 'NONE',
                  ready: body.data.ready === true,
                  currencyCode: body.data.currencyCode,
                  wallets: body.data.wallets,
                }
              : { provider: 'NONE', ready: false }
          );
        }
      } catch {
        if (!cancelled) setPaymentConfig({ provider: 'NONE', ready: false });
      } finally {
        if (!cancelled) setPaymentConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSlug]);

  useEffect(() => {
    setCart(parseCartFromStorage(localStorage.getItem(`cart-${orderId}`)));
    setCutlery(readCutleryPreference(orderId));
    setComment(readOrderCommentPreference(orderId));
    setCartHydrated(true);
  }, [orderId]);

  const setCutleryChoice = (next: boolean) => {
    setCutlery(next);
    writeCutleryPreference(orderId, next);
  };

  const setCommentChoice = (next: string) => {
    setComment(next);
    writeOrderCommentPreference(orderId, next);
  };

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + lineTotal(item), 0),
    [cart]
  );
  const { serviceChargeAmount } = useRestaurantServiceCharges(
    effectiveSlug || undefined,
    'online'
  );
  const { formatMoney, regional } = useRestaurantRegional(effectiveSlug || undefined);
  const grandTotal = total + serviceChargeAmount;

  const placeOrder = async () => {
    const slug = effectiveSlug.trim();
    if (!slug) {
      toast.error(
        'Missing store link. Open the menu from your restaurant page, then checkout again.'
      );
      return;
    }

    const schedule = readOrderSchedule(orderId);

    setSubmitting(true);
    try {
      const result = await submitCustomerOrder({
        restaurantSlug: slug,
        orderType,
        orderInfo: {
          mode: orderType,
          restaurantName: orderInfo?.restaurantName || brand?.restaurantName,
          storeId: orderInfo?.storeId,
          storeName: orderInfo?.storeName,
          storeAddress: orderInfo?.storeAddress,
          address: orderInfo?.address,
          apartment: orderInfo?.apartment,
          gateCode: orderInfo?.gateCode,
          addressName: orderInfo?.addressName,
          customerPhone: orderInfo?.customerPhone,
          restaurantSlug: slug,
        },
        lines: cart.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          unitPrice: lineUnitTotal(line),
          productName: line.productName,
          modifiers: line.modifiers,
        })),
        subtotal: total,
        total: grandTotal,
        cutlery,
        comment: comment.trim() || undefined,
        schedule: schedule
          ? {
              mode: schedule.mode,
              slot: schedule.slot || undefined,
              slotDateTime: schedule.slotDateTime || undefined,
            }
          : undefined,
      });

      if (result.status === 'queued') {
        toast.info(
          'You appear to be offline. This order is saved on this device and will be sent automatically when you are back online.'
        );
        return;
      }

      const placedId = result.data.shortOrderId ?? result.data.orderId;
      toast.success(
        placedId
          ? `Order placed. Reference: ${placedId}`
          : 'Order placed successfully.'
      );
      localStorage.removeItem(`cart-${orderId}`);
      clearOnlineOrderPreferences(orderId);
      router.push(
        orderPathWithQuery(
          `/order/${orderType}/${encodeURIComponent(orderId)}`,
          orderInfo
        )
      );
    } catch (e: unknown) {
      const ex = e as { body?: unknown };
      toast.error(
        ex.body !== undefined
          ? formatOrderApiError(ex.body)
          : 'Could not place order. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const buildPaidOrderPayload = (
    paymentMethod: 'PayPal' | 'Stripe' | 'JazzCash' | 'Easypaisa'
  ) => {
    const slug = effectiveSlug.trim();
    if (!slug) return null;
    return {
      restaurantSlug: slug,
      orderType,
      orderInfo: {
        mode: orderType,
        restaurantName: orderInfo?.restaurantName || brand?.restaurantName,
        storeId: orderInfo?.storeId,
        storeName: orderInfo?.storeName,
        storeAddress: orderInfo?.storeAddress,
        address: orderInfo?.address,
        apartment: orderInfo?.apartment,
        gateCode: orderInfo?.gateCode,
        addressName: orderInfo?.addressName,
        customerPhone: orderInfo?.customerPhone,
        restaurantSlug: slug,
      },
      lines: cart.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        unitPrice: lineUnitTotal(line),
        productName: line.productName,
        modifiers: line.modifiers,
      })),
      subtotal: total,
      total: grandTotal,
      cutlery,
      comment: comment.trim() || undefined,
      schedule: readOrderSchedule(orderId)
        ? {
            mode: readOrderSchedule(orderId)?.mode ?? 'asap',
            slot: readOrderSchedule(orderId)?.slot || undefined,
            slotDateTime: readOrderSchedule(orderId)?.slotDateTime || undefined,
          }
        : undefined,
      paymentStatus: 'completed' as const,
      paymentMethod,
    };
  };

  if (!cartHydrated) {
    return (
      <div
        className="web-app-customer min-h-screen bg-[#f4f4f6] text-[#0f172a] flex items-center justify-center p-4 antialiased"
        style={pageThemeVars}
      >
        <div className="w-full max-w-md rounded-2xl border border-[#e2e8f0] bg-white p-6 text-[#0f172a] shadow-sm">
          <h2 className="text-xl font-bold">{t('preparingCheckout')}</h2>
          <div className="mt-4 space-y-4">
            <p className="text-[#64748b]">{t('loadingYourCart')}</p>
            <Button
              type="button"
              variant="default"
              className="gap-2"
              onClick={() =>
                router.push(
                  orderPathWithQuery(
                    `/order/${orderType}/${encodeURIComponent(orderId)}`,
                    orderInfo
                  )
                )
              }
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('backToOrder')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div
        className="web-app-customer min-h-screen bg-[#f4f4f6] text-[#0f172a] flex items-center justify-center p-4 antialiased"
        style={pageThemeVars}
      >
        <div className="w-full max-w-md rounded-2xl border border-[#e2e8f0] bg-white p-6 text-[#0f172a] shadow-sm">
          <h2 className="text-xl font-bold">{t('noItemsToCheckout')}</h2>
          <div className="mt-4">
            <p className="mb-4 text-[#64748b]">{t('cartEmpty')}</p>
            <Button
              onClick={() =>
                router.push(
                  orderPathWithQuery(
                    `/order/${orderType}/${encodeURIComponent(orderId)}`,
                    orderInfo
                  )
                )
              }
              type="button"
              variant="default"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('backToOrder')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="web-app-customer min-h-screen bg-[#f4f4f6] text-[#0f172a] antialiased"
      style={pageThemeVars}
      aria-busy={submitting}
    >
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-4">
            <WebAppRestaurantTitle
              restaurantName={orderInfo?.restaurantName || brand?.restaurantName}
              subtitle={
                <span className="font-medium text-[#64748b]">
                  {orderType === 'delivery' ? t('delivery') : t('orderPickUpLabel')} order · {orderId}
                </span>
              }
            />
            <h2 className="text-2xl font-bold text-primary">{t('checkout')}</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2 border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-slate-50 hover:text-primary"
            onClick={() =>
              router.push(
                orderPathWithQuery(
                  `/order/${orderType}/${encodeURIComponent(orderId)}`,
                  orderInfo
                )
              )
            }
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('backToOrder')}
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white text-[#0f172a] shadow-sm">
              <div className="border-b border-[#f1f5f9] px-6 py-4">
                <h3 className="text-base font-bold text-[#0f172a]">{t('orderInformation')}</h3>
              </div>
              <div className="p-6">
                <div className="grid gap-3 text-sm text-[#475569]">
                  {orderInfo?.mode === 'delivery' ? (
                    <>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('deliveryAddress')}:</span>
                        <span className="text-right font-semibold text-[#0f172a]">
                          {orderInfo.address || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('name')}:</span>
                        <span className="font-semibold text-[#0f172a]">
                          {orderInfo.addressName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('phoneLabel')}:</span>
                        <span className="font-semibold text-[#0f172a]">
                          {orderInfo.customerPhone || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('apartmentDoor')}:</span>
                        <span className="font-semibold text-[#0f172a]">
                          {orderInfo.apartment || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('gateCode')}:</span>
                        <span className="font-semibold text-[#0f172a]">
                          {orderInfo.gateCode || 'N/A'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('pickupLocation')}:</span>
                        <span className="text-right font-semibold text-[#0f172a]">
                          {orderInfo?.storeName || brand?.restaurantName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('storeAddress')}:</span>
                        <span className="text-right font-semibold text-[#0f172a]">
                          {orderInfo?.storeAddress || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('name')}:</span>
                        <span className="font-semibold text-[#0f172a]">
                          {orderInfo?.addressName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#64748b]">{t('phoneLabel')}:</span>
                        <span className="font-semibold text-[#0f172a]">
                          {orderInfo?.customerPhone || 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white text-[#0f172a] shadow-sm">
              <div className="border-b border-[#f1f5f9] px-6 py-4">
                <h3 className="text-base font-bold text-[#0f172a]">{t('orderDetailsCard')}</h3>
              </div>
              <div className="p-6">
                <CutleryOption value={cutlery} onChange={setCutleryChoice} />
                <div className="mt-4">
                  <p className="text-sm font-semibold text-[#0f172a]">{t('comment')}</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setCommentChoice(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#cbd5e1] bg-white p-3 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={t('commentPlaceholder')}
                    rows={4}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border-2 border-primary bg-white text-[#0f172a] shadow-sm">
              <div className="border-b border-[#f1f5f9] px-6 py-4">
                <h3 className="text-base font-bold text-primary">{t('basket')}</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  {cart.map((line) => {
                    const modifierLines = cartModifierDisplayLines(line.modifiers);
                    return (
                      <div key={line.lineId} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <p className="font-medium text-[#0f172a]">
                            {cartLineTitle(line.productName, line.variationName)}
                          </p>
                          <p className="font-semibold text-[#0f172a]">
                            {formatMoney(lineTotal(line))}
                          </p>
                        </div>
                        {modifierLines.length > 0 ? (
                          <div className="space-y-0.5">
                            {modifierLines.map((modLine, index) => (
                              <p
                                key={`${line.lineId}-mod-${index}`}
                                className={`text-xs text-[#64748b]${
                                  modLine.prefix === 'dash' ? ' pl-3' : ''
                                }`}
                              >
                                {modLine.prefix === 'branch' ? '↳ ' : '- '}
                                {modLine.name}
                                {modLine.unitPrice > 0
                                  ? ` (+${formatMoney(modLine.unitPrice)})`
                                  : ''}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-xs text-[#64748b]">
                          x{line.quantity}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <OrderPreferencesSummary
                  className="mt-3 border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a]"
                  cutlery={cutlery}
                  comment={comment}
                />

                <div className="mt-4 space-y-2 border-t border-[#e2e8f0] pt-3 text-sm">
                  <div className="flex justify-between text-[#475569]">
                    <span>{t('subtotal')}</span>
                    <span className="font-medium text-[#0f172a]">{formatMoney(total)}</span>
                  </div>
                  {serviceChargeAmount > 0 ? (
                    <div className="flex justify-between text-[#475569]">
                      <span>{t('serviceFees')}</span>
                      <span className="font-medium text-[#0f172a]">{formatMoney(serviceChargeAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-[#f1f5f9] pt-2 text-base font-bold text-[#0f172a]">
                    <span>{t('total')}</span>
                    <span className="text-primary">{formatMoney(grandTotal)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {effectiveSlug ? (
                    paymentConfigLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : paymentConfig?.ready &&
                      paymentConfig.provider === 'PAYPAL' ? (
                      <PayPalCheckoutButtons
                        amount={grandTotal}
                        currency={paymentConfig.currencyCode ?? regional.currencyCode}
                        restaurantSlug={effectiveSlug}
                        title={`Online order (${
                          orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                        })`}
                        source="online"
                        endpoint="/api/customer/orders"
                        payload={buildPaidOrderPayload('PayPal')}
                        metadata={{
                          source: 'online',
                          restaurantSlug: effectiveSlug,
                          orderType,
                        }}
                        disabled={submitting}
                        onProcessingChange={setSubmitting}
                        onApproved={async ({ capture }) => {
                          const slug = effectiveSlug;
                          const ref =
                            capture.shortOrderId ?? capture.orderId ?? '';
                          localStorage.removeItem(`cart-${orderId}`);
                          clearOnlineOrderPreferences(orderId);
                          if (!ref) {
                            toast.warn(
                              'Payment captured but order reference missing. Contact support.'
                            );
                            return;
                          }
                          toast.success('Payment received. Order placed.');
                          const qs = new URLSearchParams({
                            orderId: ref,
                            ...(slug ? { restaurantSlug: slug } : {}),
                            ...(typeof capture.ticketNumber === 'number'
                              ? { ticket: String(capture.ticketNumber) }
                              : {}),
                          });
                          router.push(
                            `/order/${orderType}/${encodeURIComponent(
                              orderId
                            )}/success?${qs.toString()}`
                          );
                        }}
                        onError={(msg) => toast.error(msg)}
                        onCancel={() => toast.info('Payment cancelled.')}
                      />
                    ) : paymentConfig?.ready &&
                      paymentConfig.provider === 'STRIPE' ? (
                      <StripeCheckoutButton
                        amount={grandTotal}
                        currency={paymentConfig.currencyCode ?? regional.currencyCode}
                        restaurantSlug={effectiveSlug}
                        title={`Online order (${
                          orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                        })`}
                        source="online"
                        endpoint="/api/customer/orders"
                        payload={buildPaidOrderPayload('Stripe')}
                        metadata={{
                          source: 'online',
                          restaurantSlug: effectiveSlug,
                          orderType,
                        }}
                        successPath={`/order/${orderType}/${encodeURIComponent(
                          orderId
                        )}/success?session_id={CHECKOUT_SESSION_ID}&restaurantSlug=${encodeURIComponent(
                          effectiveSlug
                        )}`}
                        cancelPath={orderPathWithQuery(
                          `/order/${orderType}/${encodeURIComponent(orderId)}`,
                          orderInfo
                        )}
                        disabled={submitting}
                        onProcessingChange={setSubmitting}
                        onError={(msg) => toast.error(msg)}
                      />
                    ) : paymentConfig?.ready &&
                      paymentConfig.provider === 'WALLETS' ? (
                      <div className="flex flex-col gap-2">
                        {paymentConfig.wallets?.jazzcash?.ready ? (
                          <JazzCashCheckoutButton
                            amount={grandTotal}
                            currency={
                              paymentConfig.currencyCode ??
                              regional.currencyCode
                            }
                            restaurantSlug={effectiveSlug}
                            title={`Online order (${
                              orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                            })`}
                            source="online"
                            endpoint="/api/customer/orders"
                            payload={buildPaidOrderPayload('JazzCash')}
                            metadata={{
                              source: 'online',
                              restaurantSlug: effectiveSlug,
                              orderType,
                            }}
                            successPath={`/order/${orderType}/${encodeURIComponent(
                              orderId
                            )}/success?restaurantSlug=${encodeURIComponent(
                              effectiveSlug
                            )}`}
                            cancelPath={orderPathWithQuery(
                              `/order/${orderType}/${encodeURIComponent(
                                orderId
                              )}`,
                              orderInfo
                            )}
                            disabled={submitting}
                            onProcessingChange={setSubmitting}
                            onError={(msg) => toast.error(msg)}
                          />
                        ) : null}
                        {paymentConfig.wallets?.easypaisa?.ready ? (
                          <EasypaisaCheckoutButton
                            amount={grandTotal}
                            currency={
                              paymentConfig.currencyCode ??
                              regional.currencyCode
                            }
                            restaurantSlug={effectiveSlug}
                            title={`Online order (${
                              orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                            })`}
                            source="online"
                            endpoint="/api/customer/orders"
                            payload={buildPaidOrderPayload('Easypaisa')}
                            metadata={{
                              source: 'online',
                              restaurantSlug: effectiveSlug,
                              orderType,
                            }}
                            successPath={`/order/${orderType}/${encodeURIComponent(
                              orderId
                            )}/success?restaurantSlug=${encodeURIComponent(
                              effectiveSlug
                            )}`}
                            cancelPath={orderPathWithQuery(
                              `/order/${orderType}/${encodeURIComponent(
                                orderId
                              )}`,
                              orderInfo
                            )}
                            disabled={submitting}
                            onProcessingChange={setSubmitting}
                            onError={(msg) => toast.error(msg)}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Online payments are not available for this restaurant
                        yet. The owner must configure PayPal, Stripe, or
                        JazzCash / Easypaisa in settings.
                      </p>
                    )
                  ) : (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Missing store link. Reopen the menu from your restaurant
                      page.
                    </p>
                  )}
                </div>
                <p className="mt-2 text-xs text-[#64748b]">
                  {t('confirmOrderHint')}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
