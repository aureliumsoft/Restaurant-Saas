'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconMinus, IconPlus, IconTrash } from '@tabler/icons-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { OrderInfo } from '@/components/order/order-types';
import {
  buildCustomerMenuRequestUrl,
  inferHostSubdomainForMenu,
} from '@/lib/customer-menu-client';
import { resolveWebCustomerName } from '@/lib/web-customer';
import {
  buildProductImageByIdMap,
  cartLineTitle,
  cartModifierDisplayLines,
  resolveCartLineImageUrl,
} from '@/lib/cart-line-display';
import { cartLineTotal, cartLineUnitTotal, normalizeCartModifiers } from '@/lib/cart-normalize';
import {
  onlineCartStorageKey,
  writeCartToLocalStorage,
} from '@/lib/cart-storage';
import { orderPathWithQuery } from '@/lib/order-search-params';
import { WebAppRestaurantTitle } from '@/components/customer-app/web-app-restaurant-title';
import { CutleryOption } from '@/components/order/cutlery-option';
import { OrderPreferencesSummary } from '@/components/order/order-preferences-summary';
import { buildThemeCssVars } from '@/lib/restaurant-theme';
import { useRestaurantServiceCharges } from '@/hooks/use-restaurant-service-charges';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
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

type CustomerMenuProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  salePrice: number | null;
  categoryId: string;
  offersFromThis?: {
    id: string;
    sortOrder: number;
    offeredItem: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      price: number;
      salePrice: number | null;
    };
  }[];
};

type CustomerMenuCategory = {
  id: string;
  name: string;
  items: CustomerMenuProduct[];
};

type CustomerMenuRestaurant = {
  id: string;
  menus: CustomerMenuCategory[];
};

type CustomerMenuResponse =
  | {
      data: CustomerMenuRestaurant | null;
    }
  | CustomerMenuRestaurant;

type OfferedProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  unitPrice: number;
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

      const maybeLine = row as Partial<CartLine> & { lineId?: string; baseUnitPrice?: number };
      if (typeof maybeLine.lineId === 'string' && typeof maybeLine.baseUnitPrice === 'number') {
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
      if (legacy?.product?.id && typeof legacy.quantity === 'number' && typeof legacy.product.price === 'number') {
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

export default function CartPageClient({ orderType, orderId, orderInfo }: CartPageProps) {
  const { t } = useTranslation();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [menuRestaurant, setMenuRestaurant] = useState<CustomerMenuRestaurant | null>(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cutlery, setCutlery] = useState(false);
  const [comment, setComment] = useState('');
  const router = useRouter();

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
    router.push(
      orderPathWithQuery(
        `/order/${orderType}/${encodeURIComponent(orderId)}/checkout`,
        orderInfoWithCustomer
      )
    );
  };

  const updateCart = (next: CartLine[]) => {
    setCart(next);
    writeCartToLocalStorage(onlineCartStorageKey(orderId), next);
  };

  const adjustQuantity = (lineId: string, delta: number) => {
    const newCart = cart
      .map((item) => (item.lineId === lineId ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0);
    updateCart(newCart);
  };

  const removeFromCart = (lineId: string) => {
    updateCart(cart.filter((item) => item.lineId !== lineId));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + lineTotal(item), 0), [cart]);
  const { serviceChargeAmount } = useRestaurantServiceCharges(
    orderInfo?.restaurantSlug,
    'online'
  );
  const { formatMoney } = useRestaurantRegional(orderInfo?.restaurantSlug);
  const grandTotal = total + serviceChargeAmount;

  const productImageById = useMemo(() => {
    if (!menuRestaurant) return new Map<string, string | null>();
    return buildProductImageByIdMap(
      menuRestaurant.menus.flatMap((category) => category.items)
    );
  }, [menuRestaurant]);

  const offeredProducts: OfferedProduct[] = useMemo(() => {
    if (!menuRestaurant || cart.length === 0) return [];

    const byId = new Map<string, OfferedProduct>();

    for (const line of cart) {
      const product = menuRestaurant.menus
        .flatMap((c) => c.items)
        .find((p) => p.id === line.menuItemId);
      if (!product) continue;

      const offers = product.offersFromThis ?? [];
      for (const offer of offers) {
        const item = offer.offeredItem;
        // Skip products already in cart
        if (cart.some((l) => l.menuItemId === item.id)) continue;

        if (!byId.has(item.id)) {
          const base =
            item.salePrice != null &&
            item.salePrice > 0 &&
            item.salePrice < item.price
              ? item.salePrice
              : item.price;
          byId.set(item.id, {
            id: item.id,
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            unitPrice: base,
          });
        }
      }
    }

    return Array.from(byId.values());
  }, [cart, menuRestaurant]);

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

  const offersDialogVars = useMemo(() => {
    const primaryVars = buildThemeCssVars(themePrimaryColor);
    return {
      ...primaryVars,
      '--background': 'oklch(0.9383 0.0042 236.4993)',
      '--foreground': 'oklch(0.3211 0 0)',
      '--card': 'oklch(1 0 0)',
      '--card-foreground': 'oklch(0.3211 0 0)',
      '--popover': 'oklch(1 0 0)',
      '--popover-foreground': 'oklch(0.3211 0 0)',
      '--secondary': 'oklch(0.967 0.0029 264.5419)',
      '--secondary-foreground': 'oklch(0.4461 0.0263 256.8018)',
      '--muted': 'oklch(0.9846 0.0017 247.8389)',
      '--muted-foreground': 'oklch(0.551 0.0234 264.3637)',
      '--border': 'oklch(0.9022 0.0052 247.8822)',
      '--input': 'oklch(0.97 0.0029 264.542)',
      colorScheme: 'light',
    } as CSSProperties;
  }, [themePrimaryColor]);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const hostSubdomain = inferHostSubdomainForMenu();
        const queryStoreId =
          orderInfo?.storeId && orderInfo.storeId.trim().length > 0
            ? orderInfo.storeId.trim()
            : null;
        const menuUrl = buildCustomerMenuRequestUrl(
          orderInfo?.restaurantSlug,
          queryStoreId,
          hostSubdomain
        );

        if (!menuUrl) {
          setMenuRestaurant(null);
          return;
        }

        const res = await fetch(menuUrl);
        if (!res.ok) {
          setMenuRestaurant(null);
          return;
        }

        const payload = (await res.json()) as CustomerMenuResponse;
        const restaurant =
          'data' in payload
            ? (payload.data ?? null)
            : (payload as CustomerMenuRestaurant);
        setMenuRestaurant(restaurant);
      } catch {
        setMenuRestaurant(null);
      }
    };

    void loadMenu();
  }, [orderInfo?.storeId, orderInfo?.restaurantSlug]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 space-y-4">
          <WebAppRestaurantTitle
            restaurantName={orderInfo?.restaurantName}
            subtitle={
              <>
                {orderType === 'delivery' ? 'Delivery' : 'Pick-Up'} order ·{' '}
                {orderId}
              </>
            }
          />
          <h2 className="text-2xl font-bold">{t('yourCart')}</h2>
        </div>

        {orderInfo && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t('orderDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div>
                  <strong>{t('mode')}:</strong> {orderInfo.mode}
                </div>
                <div>
                  <strong>{t('name')}:</strong>{' '}
                  {resolvedCustomerName || 'N/A'}
                </div>
                <div>
                  <strong>{t('phoneLabel')}:</strong>{' '}
                  {customerPhone.trim() || orderInfo.customerPhone || 'N/A'}
                </div>
                {orderInfo.mode === 'delivery' ? (
                  <>
                    <div>
                      <strong>{t('address')}:</strong> {orderInfo.address || 'N/A'}
                    </div>
                    <div>
                      <strong>{t('apartment')}:</strong> {orderInfo.apartment || 'N/A'}
                    </div>
                    <div>
                      <strong>{t('gateCode')}:</strong> {orderInfo.gateCode || 'N/A'}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>{t('store')}:</strong> {orderInfo.storeName || 'N/A'}
                    </div>
                    <div>
                      <strong>{t('storeAddress')}:</strong> {orderInfo.storeAddress || 'N/A'}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {cart.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">{t('cartEmpty')}</p>
              <Button
                className="mt-4 gap-2"
                variant="outline"
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
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 space-y-4">
              {cart.map((line) => {
                const modifierLines = cartModifierDisplayLines(line.modifiers);
                const displayImageUrl = resolveCartLineImageUrl(
                  line,
                  productImageById
                );
                return (
                <Card key={line.lineId}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4 min-w-0">
                      {displayImageUrl ? (
                        <img src={displayImageUrl} alt={line.productName} className="h-16 w-16 rounded object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                          —
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          {cartLineTitle(line.productName, line.variationName)}
                        </h3>
                        {modifierLines.length > 0 ? (
                          <div className="mt-2 space-y-0.5">
                            {modifierLines.map((modLine, index) => (
                              <p
                                key={`${line.lineId}-mod-${index}`}
                                className={`truncate text-xs text-muted-foreground${
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
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('unitPrice')}: {formatMoney(lineUnitTotal(line))}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => adjustQuantity(line.lineId, -1)}
                          disabled={line.quantity <= 1}
                          type="button"
                        >
                          <IconMinus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {line.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => adjustQuantity(line.lineId, 1)}
                          type="button"
                        >
                          <IconPlus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-right font-semibold">
                          {formatMoney(lineTotal(line))}
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeFromCart(line.lineId)}
                          type="button"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                        
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <CutleryOption value={cutlery} onChange={setCutleryChoice} />
                <div>
                  <p className="text-sm font-semibold">{t('comment')}</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setCommentChoice(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('commentPlaceholder')}
                    rows={3}
                  />
                </div>
                <OrderPreferencesSummary cutlery={cutlery} comment={comment} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span>{formatMoney(total)}</span>
                </div>
                {serviceChargeAmount > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('serviceFees')}</span>
                    <span>{formatMoney(serviceChargeAmount)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-lg font-semibold">{t('total')}</span>
                  <span className="text-lg font-bold">{formatMoney(grandTotal)}</span>
                </div>
                {offeredProducts.length > 0 ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    type="button"
                    onClick={() => setOffersOpen(true)}
                  >
                    {t('viewRecommendedAddons')}
                  </Button>
                ) : null}
                <Button
                  className="w-full"
                  disabled={cart.length === 0 || !customerDetailsValid}
                  onClick={proceedToCheckout}
                  type="button"
                >
                  {t('proceedToCheckout')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={offersOpen} onOpenChange={setOffersOpen}>
        <DialogContent
          className="border-border bg-background text-foreground"
          style={offersDialogVars}
        >
          <DialogHeader>
            <DialogTitle>{t('recommendedAddons')}</DialogTitle>
          </DialogHeader>
          {offeredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('noExtraProducts')}
            </p>
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto py-1">
              {offeredProducts.map((p) => (
              
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 text-sm cursor-pointer"
                  onClick={() => handleAddOffered(p)}
                >
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {formatMoney(p.unitPrice)}
                    </span>
                    <Button
                      size="sm"
                      type="button"
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

