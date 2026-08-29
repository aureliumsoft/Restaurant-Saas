'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import type { OrderInfo } from '@/components/order/order-types';
import { ProductLineDetails } from '@/components/orders/product-line-details';
import { cartLineTotal, cartLineUnitTotal, normalizeCartModifiers } from '@/lib/cart-normalize';
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
import { useOrderInfo } from '@/hooks/use-order-info';
import {
  clearOnlineOrderPreferences,
  readCutleryPreference,
  readOrderCommentPreference,
  writeCutleryPreference,
  writeOrderCommentPreference,
} from '@/lib/online-order-preferences';
import { readOrderSchedule } from '@/lib/order-time-slots';
import {
  buildCustomerLightSurfaceVars,
  buildStorefrontThemeVars,
} from '@/lib/restaurant-theme';
import { cn } from '@/lib/utils';

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
};

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
          variationPriceOverride: (maybeLine as CartLine).variationPriceOverride,
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

export default function CheckoutPageClient({
  orderType,
  orderId,
  orderInfo: initialOrderInfo,
}: CheckoutPageProps) {
  const orderInfo = useOrderInfo(orderId, orderType, initialOrderInfo);
  const { t } = useTranslation();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const router = useRouter();
  const [cutlery, setCutlery] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );

  useEffect(() => {
    const slug = orderInfo?.restaurantSlug?.trim();
    if (!slug) {
      setThemePrimaryColor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`,
          { cache: 'no-store' }
        );
        const json = await res.json().catch(() => ({}));
        const c =
          typeof json?.data?.themePrimaryColor === 'string'
            ? json.data.themePrimaryColor.trim()
            : '';
        if (!cancelled) setThemePrimaryColor(c || null);
      } catch {
        if (!cancelled) setThemePrimaryColor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderInfo?.restaurantSlug]);

  const pageThemeVars = useMemo(
    () =>
      ({
        ...buildStorefrontThemeVars(themePrimaryColor),
        ...buildCustomerLightSurfaceVars(themePrimaryColor),
        colorScheme: 'light',
      }) as CSSProperties,
    [themePrimaryColor]
  );

  const panelClass =
    'overflow-hidden border border-[#e8eaef] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.08)]';

  useEffect(() => {
    const slug = orderInfo?.restaurantSlug?.trim();
    if (!slug) {
      setPaymentConfig(null);
      setPaymentConfigLoading(false);
      return;
    }
    let cancelled = false;
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
  }, [orderInfo?.restaurantSlug]);

  useLayoutEffect(() => {
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
    orderInfo?.restaurantSlug,
    'online'
  );
  const { formatMoney, regional } = useRestaurantRegional(orderInfo?.restaurantSlug);
  const grandTotal = total + serviceChargeAmount;

  const placeOrder = async () => {
    const slug = orderInfo?.restaurantSlug?.trim();
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
          restaurantName: orderInfo?.restaurantName,
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
          variationId: line.variationId,
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
    const slug = orderInfo?.restaurantSlug?.trim();
    if (!slug) return null;
    return {
      restaurantSlug: slug,
      orderType,
      orderInfo: {
        mode: orderType,
        restaurantName: orderInfo?.restaurantName,
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
        variationId: line.variationId,
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
        className="web-app-customer flex min-h-screen items-center justify-center bg-[#f4f4f6] text-[#1f1f2e]"
        style={pageThemeVars}
      >
        <div className={cn(panelClass, 'w-full max-w-md p-6 text-center')}>
          <h2 className="text-lg font-bold text-primary">
            {t('preparingCheckout')}
          </h2>
          <p className="mt-2 text-sm text-[#8e8e9a]">{t('loadingYourCart')}</p>
          <Button
            type="button"
            className="mt-6 gap-2"
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
    );
  }

  if (cart.length === 0) {
    return (
      <div
        className="web-app-customer flex min-h-screen items-center justify-center bg-[#f4f4f6] text-[#1f1f2e]"
        style={pageThemeVars}
      >
        <div className={cn(panelClass, 'w-full max-w-md p-6 text-center')}>
          <h2 className="text-lg font-bold text-primary">
            {t('noItemsToCheckout')}
          </h2>
          <p className="mt-2 text-sm text-[#8e8e9a]">{t('cartEmpty')}</p>
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
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('backToOrder')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="web-app-customer min-h-screen bg-[#f4f4f6] text-[#1f1f2e]"
      style={pageThemeVars}
      aria-busy={submitting}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <WebAppRestaurantTitle
              restaurantName={orderInfo?.restaurantName}
              subtitle={
                <span className="font-medium text-[#8e8e9a]">
                  {orderType === 'delivery'
                    ? t('delivery')
                    : t('orderPickUpLabel')}
                </span>
              }
            />
            <h2 className="text-2xl font-bold text-primary">{t('checkout')}</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 gap-2 border-[#e8eaef] bg-white text-primary hover:bg-white"
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] lg:gap-6">
          <div className="space-y-4">
            <section className={panelClass}>
              <div className="border-b border-[#ececf0] bg-primary px-4 py-3 text-primary-foreground">
                <h3 className="text-sm font-bold">{t('orderInformation')}</h3>
              </div>
              <div className="grid gap-2.5 px-4 py-4 text-sm text-[#1f1f2e]">
                {orderInfo?.mode === 'delivery' ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="shrink-0 text-[#8e8e9a]">
                        {t('deliveryAddress')}
                      </span>
                      <span className="break-words text-right font-semibold">
                        {orderInfo.address || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#8e8e9a]">{t('name')}</span>
                      <span className="font-semibold">
                        {orderInfo.addressName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#8e8e9a]">{t('phoneLabel')}</span>
                      <span className="font-semibold">
                        {orderInfo.customerPhone || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#8e8e9a]">{t('apartmentDoor')}</span>
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
                      <span className="text-[#8e8e9a]">{t('pickupLocation')}</span>
                      <span className="break-words text-right font-semibold">
                        {orderInfo?.storeName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="shrink-0 text-[#8e8e9a]">
                        {t('storeAddress')}
                      </span>
                      <span className="break-words text-right font-semibold">
                        {orderInfo?.storeAddress || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#8e8e9a]">{t('name')}</span>
                      <span className="font-semibold">
                        {orderInfo?.addressName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#8e8e9a]">{t('phoneLabel')}</span>
                      <span className="font-semibold">
                        {orderInfo?.customerPhone || 'N/A'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className={cn(panelClass, 'p-4')}>
              <h3 className="mb-3 text-sm font-bold text-primary">
                {t('orderDetailsCard')}
              </h3>
              <CutleryOption value={cutlery} onChange={setCutleryChoice} />
              <div className="mt-4">
                <p className="text-sm font-bold text-primary">{t('comment')}</p>
                <textarea
                  value={comment}
                  onChange={(e) => setCommentChoice(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#e8eaef] bg-[#f4f4f6] p-3 text-sm text-[#1f1f2e] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t('commentPlaceholder')}
                  rows={4}
                />
              </div>
            </section>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <section className={panelClass}>
              <div className="border-b border-[#ececf0] bg-primary px-4 py-3 text-primary-foreground">
                <h3 className="text-sm font-bold">{t('basket')}</h3>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-3">
                  {cart.map((line) => {
                    return (
                      <div key={line.lineId} className="space-y-1">
                        <div className="flex justify-between gap-3 text-sm">
                          <div className="min-w-0 flex-1">
                            <ProductLineDetails
                              productName={line.productName}
                              variationName={line.variationName}
                              modifiers={line.modifiers}
                              showPrices
                              formatMoney={formatMoney}
                              titleClassName="font-bold text-primary"
                              sectionLabelClassName="text-[10px] font-semibold uppercase tracking-wide text-primary/60"
                              lineClassName="text-xs text-primary/75"
                            />
                          </div>
                          <p className="shrink-0 font-bold text-primary">
                            {formatMoney(lineTotal(line))}
                          </p>
                        </div>
                        <p className="text-xs text-[#8e8e9a]">x{line.quantity}</p>
                      </div>
                    );
                  })}
                </div>

                <OrderPreferencesSummary
                  cutlery={cutlery}
                  comment={comment}
                  className="border-[#ececf0] bg-[#f8f8fa] text-[#1f1f2e]"
                />

                <div className="space-y-2 border-t border-[#ececf0] pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#8e8e9a]">{t('subtotal')}</span>
                    <span className="font-semibold">{formatMoney(total)}</span>
                  </div>
                  {serviceChargeAmount > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-[#8e8e9a]">{t('serviceFees')}</span>
                      <span className="font-semibold">
                        {formatMoney(serviceChargeAmount)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-1">
                    <span className="text-base font-bold text-primary">
                      {t('total')}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {formatMoney(grandTotal)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {orderInfo?.restaurantSlug ? (
                    paymentConfigLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    ) : paymentConfig?.ready &&
                      paymentConfig.provider === 'PAYPAL' ? (
                      <PayPalCheckoutButtons
                        amount={grandTotal}
                        currency={
                          paymentConfig.currencyCode ?? regional.currencyCode
                        }
                        restaurantSlug={orderInfo.restaurantSlug}
                        title={`Online order (${
                          orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                        })`}
                        source="online"
                        endpoint="/api/customer/orders"
                        payload={buildPaidOrderPayload('PayPal')}
                        metadata={{
                          source: 'online',
                          restaurantSlug: orderInfo.restaurantSlug,
                          orderType,
                        }}
                        disabled={submitting}
                        onProcessingChange={setSubmitting}
                        onApproved={async ({ capture }) => {
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
                        currency={
                          paymentConfig.currencyCode ?? regional.currencyCode
                        }
                        restaurantSlug={orderInfo.restaurantSlug}
                        title={`Online order (${
                          orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                        })`}
                        source="online"
                        endpoint="/api/customer/orders"
                        payload={buildPaidOrderPayload('Stripe')}
                        metadata={{
                          source: 'online',
                          restaurantSlug: orderInfo.restaurantSlug,
                          orderType,
                        }}
                        successPath={`/order/${orderType}/${encodeURIComponent(
                          orderId
                        )}/success?session_id={CHECKOUT_SESSION_ID}&restaurantSlug=${encodeURIComponent(
                          orderInfo.restaurantSlug
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
                      <div className="space-y-2">
                        {paymentConfig.wallets?.jazzcash?.ready ? (
                          <JazzCashCheckoutButton
                            amount={grandTotal}
                            currency={
                              paymentConfig.currencyCode ??
                              regional.currencyCode
                            }
                            restaurantSlug={orderInfo.restaurantSlug}
                            title={`Online order (${
                              orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                            })`}
                            source="online"
                            endpoint="/api/customer/orders"
                            payload={buildPaidOrderPayload('JazzCash')}
                            metadata={{
                              source: 'online',
                              restaurantSlug: orderInfo.restaurantSlug,
                              orderType,
                            }}
                            successPath={`/order/${orderType}/${encodeURIComponent(
                              orderId
                            )}/success?orderId={orderId}&restaurantSlug=${encodeURIComponent(
                              orderInfo.restaurantSlug
                            )}`}
                            cancelPath={orderPathWithQuery(
                              `/order/${orderType}/${encodeURIComponent(
                                orderId
                              )}/checkout`,
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
                            restaurantSlug={orderInfo.restaurantSlug}
                            title={`Online order (${
                              orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                            })`}
                            source="online"
                            endpoint="/api/customer/orders"
                            payload={buildPaidOrderPayload('Easypaisa')}
                            metadata={{
                              source: 'online',
                              restaurantSlug: orderInfo.restaurantSlug,
                              orderType,
                            }}
                            successPath={`/order/${orderType}/${encodeURIComponent(
                              orderId
                            )}/success?orderId={orderId}&restaurantSlug=${encodeURIComponent(
                              orderInfo.restaurantSlug
                            )}`}
                            cancelPath={orderPathWithQuery(
                              `/order/${orderType}/${encodeURIComponent(orderId)}`,
                              orderInfo
                            )}
                            disabled={submitting}
                            onProcessingChange={setSubmitting}
                            onError={(msg) => toast.error(msg)}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Online payments are not available for this restaurant
                        yet. The owner must configure PayPal, Stripe, or
                        JazzCash / Easypaisa wallets in settings.
                      </p>
                    )
                  ) : (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Missing store link. Reopen the menu from your restaurant
                      page.
                    </p>
                  )}
                </div>
                <p className="text-xs text-[#8e8e9a]">{t('confirmOrderHint')}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
