'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { OrderInfo } from '@/components/order/order-types';
import {
  cartLineTitle,
  cartModifierDisplayLines,
} from '@/lib/cart-line-display';
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
  orderInfo,
}: CheckoutPageProps) {
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('preparingCheckout')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{t('loadingYourCart')}</p>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('noItemsToCheckout')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{t('cartEmpty')}</p>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      aria-busy={submitting}
    >
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-4">
            <WebAppRestaurantTitle
              restaurantName={orderInfo?.restaurantName}
              subtitle={
                <>
                  {orderType === 'delivery' ? 'Delivery' : 'Pick-Up'} order ·{' '}
                  {orderId}
                </>
              }
            />
            <h2 className="text-2xl font-bold">{t('checkout')}</h2>
          </div>
          <Button
            type="button"
            variant="default"
            className="shrink-0 gap-2"
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
            <Card>
              <CardHeader>
                <CardTitle>{t('orderInformation')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm text-muted-foreground">
                  {orderInfo?.mode === 'delivery' ? (
                    <>
                      <div>
                        <strong>{t('deliveryAddress')}:</strong>{' '}
                        {orderInfo.address || 'N/A'}
                      </div>
                      <div>
                        <strong>{t('name')}:</strong>{' '}
                        {orderInfo.addressName || 'N/A'}
                      </div>
                      <div>
                        <strong>{t('phoneLabel')}:</strong>{' '}
                        {orderInfo.customerPhone || 'N/A'}
                      </div>
                      <div>
                        <strong>{t('apartmentDoor')}:</strong>{' '}
                        {orderInfo.apartment || 'N/A'}
                      </div>
                      <div>
                        <strong>{t('gateCode')}:</strong>{' '}
                        {orderInfo.gateCode || 'N/A'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{t('pickupLocation')}:</strong>{' '}
                        {orderInfo?.storeName || 'N/A'}
                      </div>
                      <div>
                        <strong>{t('storeAddress')}:</strong>{' '}
                        {orderInfo?.storeAddress || 'N/A'}
                      </div>
                      <div>
                        <strong>{t('name')}:</strong>{' '}
                        {orderInfo?.addressName || 'N/A'}
                      </div>
                      <div>
                        <strong>{t('phoneLabel')}:</strong>{' '}
                        {orderInfo?.customerPhone || 'N/A'}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t('orderDetailsCard')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CutleryOption value={cutlery} onChange={setCutleryChoice} />
                <div className="mt-4">
                  <p className="text-sm font-semibold">{t('comment')}</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setCommentChoice(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('commentPlaceholder')}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* <Card>
              <CardHeader>
                <CardTitle>{t('promotions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 justify-between rounded-lg border border-border bg-card px-3 py-3">
                  <input id="promo-code" type="text" className="text-sm p-2 rounded-lg w-full" placeholder={t('addPromoCode')} />
                  <Button type="button" className="w-full" >{t('apply')}</Button>
                </div>
              </CardContent>
            </Card> */}
          </div>

          <div className="space-y-4">
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>{t('basket')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cart.map((line) => {
                    const modifierLines = cartModifierDisplayLines(line.modifiers);
                    return (
                    <div key={line.lineId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <p className="font-medium">
                          {cartLineTitle(line.productName, line.variationName)}
                        </p>
                        <p>{formatMoney(lineTotal(line))}</p>
                      </div>
                      {modifierLines.length > 0 ? (
                        <div className="space-y-0.5">
                          {modifierLines.map((modLine, index) => (
                            <p
                              key={`${line.lineId}-mod-${index}`}
                              className={`text-xs text-muted-foreground${
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
                      <p className="text-xs text-muted-foreground">
                        x{line.quantity}
                      </p>
                    </div>
                    );
                  })}
                </div>

                <OrderPreferencesSummary
                  className="mt-3"
                  cutlery={cutlery}
                  comment={comment}
                />

                <div className="mt-4 space-y-2 border-t border-border pt-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t('subtotal')}</span>
                    <span>{formatMoney(total)}</span>
                  </div>
                  {serviceChargeAmount > 0 ? (
                    <div className="flex justify-between">
                      <span>{t('serviceFees')}</span>
                      <span>{formatMoney(serviceChargeAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-bold">
                    <span>{t('total')}</span>
                    <span>{formatMoney(grandTotal)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {orderInfo?.restaurantSlug ? (
                    paymentConfigLoading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    ) : paymentConfig?.ready &&
                      paymentConfig.provider === 'PAYPAL' ? (
                      <PayPalCheckoutButtons
                        amount={grandTotal}
                        currency={paymentConfig.currencyCode ?? regional.currencyCode}
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
                          const slug = orderInfo?.restaurantSlug ?? '';
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
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Online payments are not available for this restaurant
                        yet. The owner must configure PayPal, Stripe, or
                        JazzCash / Easypaisa wallets in settings.
                      </p>
                    )
                  ) : (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Missing store link. Reopen the menu from your restaurant
                      page.
                    </p>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('confirmOrderHint')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
