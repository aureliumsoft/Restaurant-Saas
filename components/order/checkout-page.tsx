'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { OrderInfo } from '@/components/order/order-types';
import {
  cartLineTitle,
  cartModifierSelectionNames,
} from '@/lib/cart-line-display';
import { orderPathWithQuery } from '@/lib/order-search-params';
import { submitCustomerOrder } from '@/lib/offline/submit-order';
import { PayPalCheckoutButtons } from '@/components/payments/paypal-checkout-buttons';

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

const SERVICE_FEE = 0.99;

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
  orderInfo,
}: CheckoutPageProps) {
  const { t } = useTranslation();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const router = useRouter();
  const [cutlery, setCutlery] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCart(parseCartFromStorage(localStorage.getItem(`cart-${orderId}`)));
    setCartHydrated(true);
  }, [orderId]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + lineTotal(item), 0),
    [cart]
  );
  const grandTotal = total + SERVICE_FEE;

  const placeOrder = async () => {
    const slug = orderInfo?.restaurantSlug?.trim();
    if (!slug) {
      toast.error(
        'Missing store link. Open the menu from your restaurant page, then checkout again.'
      );
      return;
    }

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

  const buildPaypalPayload = () => {
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
      paymentStatus: 'completed' as const,
      paymentMethod: 'PayPal',
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
          <div>
            <h1 className="text-3xl font-bold">{t('checkout')}</h1>
            <p className="text-muted-foreground">
              {orderType === 'delivery' ? 'Delivery' : 'Pick-Up'} order -{' '}
              {orderId}
            </p>
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
                <CardTitle>{t('orderDetailsCard')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <h3 className="text-sm font-semibold">{t('cutlery')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t('cutleryHint')}
                    </p>
                  </div>
                  <Button
                    variant={cutlery ? 'default' : 'outline'}
                    onClick={() => setCutlery((prev) => !prev)}
                    type="button"
                  >
                    {cutlery ? t('yes') : t('no')}
                  </Button>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold">{t('comment')}</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
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
                    const addonNames = cartModifierSelectionNames(line.modifiers);
                    return (
                    <div key={line.lineId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <p className="font-medium">
                          {cartLineTitle(line.productName, line.variationName)}
                        </p>
                        <p>€{lineTotal(line).toFixed(2)}</p>
                      </div>
                      {addonNames.length > 0 ? (
                        <div className="space-y-0.5">
                          {addonNames.map((name, index) => (
                            <p
                              key={`${line.lineId}-sel-${index}`}
                              className="text-xs text-muted-foreground"
                            >
                              - {name}
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

                <div className="mt-4 space-y-2 border-t border-border pt-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t('subtotal')}</span>
                    <span>€{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('serviceFees')}</span>
                    <span>€{SERVICE_FEE.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>{t('total')}</span>
                    <span>€{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {orderInfo?.restaurantSlug ? (
                    <PayPalCheckoutButtons
                      amount={grandTotal}
                      title={`Online order (${
                        orderType === 'delivery' ? 'Delivery' : 'Pick-up'
                      })`}
                      source="online"
                      endpoint="/api/customer/orders"
                      payload={buildPaypalPayload()}
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
