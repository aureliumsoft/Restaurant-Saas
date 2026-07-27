'use client';

import {
  ArrowLeft,
  Banknote,
  CheckCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { MenuOfferChoiceDialog } from '@/components/order/menu-offer-choice-dialog';
import {
  ProductCustomizeDialog,
  type AttributeGroup,
  type SelectedProductVariation,
} from '@/components/order/product-customize-dialog';
import { getCategoryDisplayImageUrl } from '@/lib/menu/category-display-image';
import { findBundleParentProducts } from '@/lib/menu/find-bundle-parent-products';
import { productNeedsCustomizeDialog } from '@/lib/menu/personalize-options';
import {
  fetchCustomerMenuProductDetail,
  productNeedsDetailFetch,
} from '@/lib/menu/fetch-menu-product-detail';
import { LazyMenuProductImage } from '@/components/menu/lazy-menu-product-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buildCustomerAttributeGroup } from '@/lib/menu/build-customer-attribute-group';
import {
  buildProductImageByIdMap,
  cartLineTitle,
  cartModifierSelectionNames,
  cartPersonalizeSelectionNames,
  resolveCartLineImageUrl,
} from '@/lib/cart-line-display';
import { cartLineTotal, cartLineUnitTotal, normalizeCartModifiers } from '@/lib/cart-normalize';
import { compactCartImageUrl, writeCartToLocalStorage } from '@/lib/cart-storage';
import { cn } from '@/lib/utils';
import { buildThemeCssVars } from '@/lib/restaurant-theme';
import { setUiLanguage } from '@/lib/i18n/client';
import type { UiLanguage } from '@/lib/i18n/resources';
import { IconArrowBack } from '@tabler/icons-react';
import {
  kioskBasePath,
  kioskCartStorageKey,
  kioskCheckoutDraftKey,
  kioskSuccessPath,
} from '@/lib/kiosk-path';
import { submitKioskOrder } from '@/lib/offline/submit-order';
import {
  buildKioskMenuCategoriesUrl,
  buildKioskMenuCategoryItemsUrl,
} from '@/lib/customer-menu-client';
import { useProgressiveCustomerMenu } from '@/hooks/use-progressive-customer-menu';
import { ProductCardSkeletonGrid, CategoryPillSkeleton } from '@/components/menu/product-card-skeleton';
import {
  parseRestaurantServiceCharges,
  resolveServiceChargeAmount,
  type RestaurantServiceCharges,
} from '@/lib/restaurant-service-charge';
import { CardPaymentDialogs, useCardPaymentFlow } from '../payments/card-payment-flow';

function formatKioskOrderApiError(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return 'Could not place order.';
  }
  const err = (body as { error?: unknown }).error;
  if (typeof err === 'string') return err;
  return 'Could not place order.';
}

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
  variationId: string | null;
  variationName: string | null;
  variationPriceDelta: number;
  modifiers: CartModifierSelection[];
  modifiersSignature: string;
};

type CustomerMenuProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  hasImage?: boolean;
  price: number;
  salePrice: number | null;
  categoryId: string;
  variations?: {
    id: string;
    name?: string;
    title?: string;
    imageUrl?: string | null;
    swatchHex: string | null;
    priceDelta: number;
    sortOrder: number;
  }[];
  attributeGroups: {
    id: string;
    name: string;
    selectionType: 'SINGLE' | 'MULTIPLE';
    sourceType?: 'CATEGORY' | 'PRODUCT';
    required: boolean;
    minItems: number | null;
    maxItems: number | null;
    linkedProduct?: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      price: number;
      salePrice: number | null;
    } | null;
    linkedCategory: {
      id: string;
      name: string;
      items: {
        id: string;
        name: string;
        description: string | null;
        imageUrl: string | null;
        price: number;
        salePrice: number | null;
        variations?: {
          id: string;
          name?: string;
          title?: string;
          imageUrl?: string | null;
          swatchHex?: string | null;
          priceDelta: number;
          sortOrder?: number;
        }[];
      }[];
    };
  }[];
  personalizeGroups?: {
    id: string;
    parentName: string;
    maxItems: number;
    options: Array<{
      id: string;
      name: string;
      imageUrl?: string | null;
    }>;
  }[];
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
  imageUrl?: string | null;
  items: CustomerMenuProduct[];
};

type MenuRestaurant = {
  id: string;
  name: string;
  logoUrl: string | null;
  mainBannerUrl: string | null;
  themePrimaryColor?: string | null;
  slug: string;
  menus: CustomerMenuCategory[];
  serviceCharges?: RestaurantServiceCharges;
};

type DiningTableOption = {
  id: string;
  name: string;
  sortOrder: number;
};

function effectiveUnitPrice(price: number, salePrice: number | null) {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
}

function getSignature(
  mods: CartModifierSelection[],
  variationId: string | null
): string {
  return [...mods]
    .sort((a, b) => a.attributeGroupId.localeCompare(b.attributeGroupId))
    .map(
      (m) =>
        `${m.attributeGroupId}:${m.selections
          .map((s) => `${s.menuItemId}:${s.name}`)
          .sort()
          .join(',')}`
    )
    .join('|')
    .concat(`::v:${variationId ?? ''}`);
}

function lineUnitTotal(line: CartLine) {
  return cartLineUnitTotal(line);
}

function lineTotal(line: CartLine) {
  return cartLineTotal(line);
}

function loadCart(slug: string, branchId: string): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(kioskCartStorageKey(slug, branchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is CartLine =>
          !!row &&
          typeof row === 'object' &&
          typeof (row as CartLine).lineId === 'string' &&
          typeof (row as CartLine).menuItemId === 'string'
      )
      .map((row) => ({
        ...row,
        productName: String(row.productName ?? 'Item'),
        baseUnitPrice: Number.isFinite(Number(row.baseUnitPrice))
          ? Number(row.baseUnitPrice)
          : 0,
        quantity:
          Number.isFinite(Number(row.quantity)) && Number(row.quantity) > 0
            ? Number(row.quantity)
            : 1,
        variationPriceDelta: Number.isFinite(Number(row.variationPriceDelta))
          ? Number(row.variationPriceDelta)
          : 0,
        modifiers: normalizeCartModifiers(row.modifiers),
      }));
  } catch {
    return [];
  }
}

function saveCart(slug: string, branchId: string, lines: CartLine[]) {
  writeCartToLocalStorage(kioskCartStorageKey(slug, branchId), lines);
}

/** Single-line label for cart / kitchen (matches server `ticketProductName` shape). */
function cartLineDisplayName(line: CartLine): string {
  const base = cartLineTitle(line.productName, line.variationName);
  if (!line.modifiers.length) return base;
  const bits = normalizeCartModifiers(line.modifiers).map((g) => {
    const names = g.selections.map((s) => s.name).join(', ');
    return names ? `${names}, ` : '';
  });
  return bits.some(Boolean) ? `${base} (${bits.join(', ')})` : base;
}

function cartSummaryLines(cart: CartLine[], maxLines: number): string[] {
  return cart
    .slice(0, maxLines)
    .map((l) => `${l.quantity}× ${cartLineDisplayName(l)}`);
}

type Step = 'mode' | 'menu' | 'cart' | 'checkout' | 'done';

export function KioskApp({
  slug,
  branchId,
}: {
  slug: string;
  branchId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatMoney, regional } = useRestaurantRegional(slug);
  const kioskPath = kioskBasePath(slug, branchId);
  const [step, setStep] = useState<Step>('mode');
  const [fulfillment, setFulfillment] = useState<
    'dine_in' | 'take_away' | null
  >(null);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customizeProduct, setCustomizeProduct] =
    useState<CustomerMenuProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customizeLoading, setCustomizeLoading] = useState(false);
  const customizeLoadTokenRef = useRef(0);
  const [menuOfferOpen, setMenuOfferOpen] = useState(false);
  const [menuOfferProduct, setMenuOfferProduct] =
    useState<CustomerMenuProduct | null>(null);
  const [menuOfferBundles, setMenuOfferBundles] = useState<
    CustomerMenuProduct[]
  >([]);
  const [cookingNote, setCookingNote] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [diningTables, setDiningTables] = useState<DiningTableOption[]>([]);
  const [pendingFulfillment, setPendingFulfillment] = useState<
    'dine_in' | null
  >(null);
  const [placing, setPlacing] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card'>('cash');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastTicketNumber, setLastTicketNumber] = useState<number | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branchValid, setBranchValid] = useState<boolean | null>(null);
  const { t, i18n } = useTranslation();
  const uiLang: UiLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'es';

  const categoryItemsUrl = useCallback(
    (id: string, page: number, limit: number) =>
      buildKioskMenuCategoryItemsUrl(slug, id, { page, limit }),
    [slug]
  );

  const {
    restaurantMeta,
    categories: progressiveCategories,
    categoriesLoading,
    error: menuError,
  } = useProgressiveCustomerMenu<CustomerMenuProduct>({
    categoriesUrl: buildKioskMenuCategoriesUrl(slug),
    categoryItemsUrl,
    enabled: Boolean(slug),
  });

  const menu = useMemo((): MenuRestaurant | null => {
    if (!restaurantMeta) return null;
    const menus: CustomerMenuCategory[] = progressiveCategories.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      items: c.items.map((item) => ({ ...item, categoryId: c.id })),
    }));
    return {
      id: String(restaurantMeta.id ?? ''),
      name: String(restaurantMeta.name ?? ''),
      logoUrl: (restaurantMeta.logoUrl as string | null) ?? null,
      mainBannerUrl: (restaurantMeta.mainBannerUrl as string | null) ?? null,
      themePrimaryColor:
        (restaurantMeta.themePrimaryColor as string | null) ?? null,
      slug: String(restaurantMeta.slug ?? slug),
      menus,
      serviceCharges: restaurantMeta.serviceCharges as
        | RestaurantServiceCharges
        | undefined,
    };
  }, [restaurantMeta, progressiveCategories, slug]);

  const menuLoading = categoriesLoading && progressiveCategories.length === 0;

  useEffect(() => {
    const sessionId = searchParams.get('session_id')?.trim();
    if (sessionId) {
      (async () => {
        let paid = false;
        for (let i = 0; i < 6; i += 1) {
          try {
            const res = await fetch(
              `/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`
            );
            const body = (await res.json().catch(() => ({}))) as {
              paid?: boolean;
            };
            if (res.ok && body.paid === true) {
              paid = true;
              break;
            }
          } catch {
            // retry
          }
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }

        if (paid) {
          try {
            localStorage.removeItem(kioskCartStorageKey(slug, branchId));
            localStorage.removeItem(kioskCheckoutDraftKey(slug, branchId));
          } catch {
            // ignore storage errors
          }
          setCart([]);
          setStep('menu');
          toast.success(
            'Payment received. Your order was sent to the kitchen.'
          );
        } else {
          toast.info('Payment is processing. Your order will sync shortly.');
        }
        router.replace(kioskPath);
      })();
      return;
    }
    setCart(loadCart(slug, branchId));
  }, [slug, branchId, kioskPath, searchParams, router]);

  useEffect(() => {
    if (step !== 'checkout') return;
    if (cart.length > 0) return;
    const restored = loadCart(slug, branchId);
    if (restored.length > 0) {
      setCart(restored);
    }
  }, [step, cart.length, slug, branchId]);

  const persistCart = useCallback(
    (next: CartLine[]) => {
      setCart(next);
      saveCart(slug, branchId, next);
    },
    [slug, branchId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/customer/branches?slug=${encodeURIComponent(slug)}`
        );
        const json = (await res.json().catch(() => ({}))) as {
          data?: { id: string; name: string }[];
        };
        if (cancelled) return;
        const match = (json.data ?? []).find((b) => b.id === branchId);
        if (match) {
          setBranchValid(true);
          setBranchName(match.name);
        } else {
          setBranchValid(false);
          setBranchName(null);
        }
      } catch {
        if (!cancelled) {
          setBranchValid(false);
          setBranchName(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, branchId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tableParams = new URLSearchParams({ slug });
        if (branchId?.trim()) {
          tableParams.set('branchId', branchId.trim());
        }
        const res = await fetch(
          `/api/customer/tables?${tableParams.toString()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const body = (await res.json().catch(() => ({}))) as {
          data?: DiningTableOption[];
        };
        if (!cancelled) {
          const list = Array.isArray(body.data) ? body.data : [];
          setDiningTables(list);
          setSelectedTableId((prev) =>
            prev && list.some((t) => t.id === prev) ? prev : ''
          );
        }
      } catch {
        if (!cancelled) {
          setDiningTables([]);
          setSelectedTableId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, branchId]);

  const allProducts = useMemo(() => {
    if (!menu) return [];
    return menu.menus.flatMap((c) =>
      c.items.map((p) => ({ ...p, categoryName: c.name }))
    );
  }, [menu]);

  const productImageById = useMemo(
    () => buildProductImageByIdMap(allProducts),
    [allProducts]
  );

  const displayedProducts = useMemo(() => {
    if (!menu) return [];
    if (categoryId === 'all') return allProducts;
    return menu.menus.find((c) => c.id === categoryId)?.items ?? [];
  }, [menu, categoryId, allProducts]);

  const recommended = useMemo(() => {
    const withDeal = allProducts.filter(
      (p) => p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price
    );
    return withDeal.slice(0, 10);
  }, [allProducts]);

  const offeredPool = useMemo(() => {
    const byId = new Map<string, CustomerMenuProduct>();
    for (const p of allProducts) {
      for (const o of p.offersFromThis ?? []) {
        const it = o.offeredItem;
        if (!it?.id) continue;
        const full = allProducts.find((x) => x.id === it.id);
        const candidate: CustomerMenuProduct = full ?? {
          id: it.id,
          name: it.name,
          description: it.description ?? null,
          imageUrl: it.imageUrl ?? null,
          price: it.price,
          salePrice: it.salePrice ?? null,
          categoryId: p.categoryId,
          attributeGroups: [],
          offersFromThis: undefined,
        };
        if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
      }
    }
    return [...byId.values()].slice(0, 12);
  }, [allProducts]);

  const cartCount = useMemo(
    () => cart.reduce((s, l) => s + l.quantity, 0),
    [cart]
  );
  const cartSubtotal = useMemo(
    () => cart.reduce((s, l) => s + lineTotal(l), 0),
    [cart]
  );
  const serviceChargeAmount = useMemo(
    () =>
      resolveServiceChargeAmount(
        menu?.serviceCharges ?? parseRestaurantServiceCharges(undefined),
        'kiosk'
      ),
    [menu?.serviceCharges]
  );
  const cartGrandTotal = cartSubtotal + serviceChargeAmount;

  const cardPayment = useCardPaymentFlow({
    amount: cartGrandTotal,
    orderIdPrefix: 'KIOSK-PRE',
    formatMoney,
    currency: regional.currencyCode,
  });

  const attributeGroupsForDialog: AttributeGroup[] = useMemo(() => {
    if (!customizeProduct) return [];
    return customizeProduct.attributeGroups.map((g) =>
      buildCustomerAttributeGroup(g, customizeProduct.id)
    );
  }, [customizeProduct]);

  const addToCart = (
    product: CustomerMenuProduct,
    modifiers: CartModifierSelection[],
    variation?: SelectedProductVariation | null
  ) => {
    const baseUnitPrice = effectiveUnitPrice(product.price, product.salePrice);
    const variationId = variation?.id ?? null;
    const modifiersSignature = getSignature(modifiers, variationId);

    setCart((current) => {
      const existing = current.find(
        (l) =>
          l.menuItemId === product.id &&
          l.modifiersSignature === modifiersSignature
      );
      let next: CartLine[];
      if (existing) {
        next = current.map((l) =>
          l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l
        );
      } else {
        const line: CartLine = {
          lineId:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `l${Date.now()}`,
          menuItemId: product.id,
          productName: product.name,
          description: product.description ?? null,
          imageUrl: compactCartImageUrl(product.imageUrl),
          baseUnitPrice,
          quantity: 1,
          variationId,
          variationName: variation?.name ?? null,
          variationPriceDelta: variation?.priceDelta ?? 0,
          modifiers,
          modifiersSignature,
        };
        next = [...current, line];
      }
      saveCart(slug, branchId, next);
      return next;
    });
  };

  const openCustomize = (
    p: CustomerMenuProduct,
    options?: { loading?: boolean }
  ) => {
    setCustomizeProduct(p);
    setCustomizeLoading(options?.loading ?? false);
    setDialogOpen(true);
  };

  const resolveCatalogProduct = (ref: { id: string }) =>
    allProducts.find((p) => p.id === ref.id) ?? null;

  const proceedWithProduct = async (p: CustomerMenuProduct) => {
    if (productNeedsCustomizeDialog(p)) {
      if (productNeedsDetailFetch(p)) {
        const token = ++customizeLoadTokenRef.current;
        openCustomize(p, { loading: true });
        const full = await fetchCustomerMenuProductDetail<CustomerMenuProduct>(
          p.id,
          { slug }
        );
        if (token !== customizeLoadTokenRef.current) return;
        if (!full) {
          setDialogOpen(false);
          setCustomizeProduct(null);
          setCustomizeLoading(false);
          toast.error(t('productNotFoundToModify'));
          return;
        }
        setCustomizeProduct({ ...full, categoryId: p.categoryId });
        setCustomizeLoading(false);
        return;
      }
      customizeLoadTokenRef.current += 1;
      openCustomize(p);
      return;
    }
    addToCart(p, []);
  };

  const handleProductSelect = (p: CustomerMenuProduct) => {
    const bundles = findBundleParentProducts(p.id, allProducts);
    if (bundles.length > 0) {
      setMenuOfferProduct(p);
      setMenuOfferBundles(bundles);
      setMenuOfferOpen(true);
      return;
    }
    proceedWithProduct(p);
  };

  const onProductTap = (p: CustomerMenuProduct) => {
    void handleProductSelect(p);
  };

  const qtyOnMenu = useCallback(
    (productId: string) =>
      cart
        .filter((l) => l.menuItemId === productId)
        .reduce((s, l) => s + l.quantity, 0),
    [cart]
  );

  const bumpProductQty = (productId: string, delta: number) => {
    if (delta > 0) {
      const p = allProducts.find((x) => x.id === productId);
      if (!p) return;
      handleProductSelect(p);
      return;
    }
    setCart((current) => {
      const copy = [...current];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i]!.menuItemId !== productId) continue;
        const line = copy[i]!;
        if (line.quantity <= 1) copy.splice(i, 1);
        else copy[i] = { ...line, quantity: line.quantity - 1 };
        break;
      }
      saveCart(slug, branchId, copy);
      return copy;
    });
  };

  const adjustLine = (lineId: string, delta: number) => {
    const next = cart
      .map((item) =>
        item.lineId === lineId
          ? { ...item, quantity: item.quantity + delta }
          : item
      )
      .filter((item) => item.quantity > 0);
    persistCart(next);
  };

  const removeLine = (lineId: string) => {
    persistCart(cart.filter((l) => l.lineId !== lineId));
  };

  const clearCart = () => persistCart([]);

  function handleSelectPaymentMode(mode: 'cash' | 'card') {
    setPaymentMode(mode);
    cardPayment.resetCardPayment();
  }

  function buildOrderPayload(payment: {
    paymentStatus: 'pending' | 'completed';
    paymentMethod: string;
  }) {
    if (!fulfillment) return null;
    const lines = cart.map((line) => ({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      unitPrice: lineUnitTotal(line),
      productName: cartLineDisplayName(line),
      modifiers: line.modifiers,
    }));
    return {
      restaurantSlug: slug,
      branchId,
      fulfillment,
      tableId:
        fulfillment === 'dine_in' ? selectedTableId || undefined : undefined,
      lines,
      subtotal: cartSubtotal,
      total: cartGrandTotal,
      cookingNote: cookingNote.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentStatus: payment.paymentStatus,
      paymentMethod: payment.paymentMethod,
    };
  }

  const placeOrder = async (payment: {
    paymentStatus: 'pending' | 'completed';
    paymentMethod: string;
  }) => {
    if (!fulfillment || cart.length === 0) return;
    setPlacing(true);
    try {
      const payload = buildOrderPayload(payment);
      if (!payload) return;
      const result = await submitKioskOrder(payload);
      if (result.status === 'queued') {
        toast.info(
          'You appear offline. This order is saved on this device and will send when you are back online.'
        );
        return;
      }
      const placedId = result.data.shortOrderId ?? result.data.orderId;
      const ticketNumber = result.data.ticketNumber ?? null;
      setLastOrderId(placedId);
      setLastTicketNumber(ticketNumber);
      clearCart();
      cardPayment.resetCardPayment();
      setPaymentMode('cash');
      localStorage.removeItem(kioskCheckoutDraftKey(slug, branchId));
      setCookingNote('');
      setCustomerName('');
      setCustomerPhone('');
      toast.success(
        payment.paymentStatus === 'pending'
          ? 'Order placed — pay at counter when ready.'
          : 'Order placed'
      );
      window.location.assign(
        `${kioskSuccessPath(slug, branchId)}?orderId=${encodeURIComponent(placedId)}${
          ticketNumber != null
            ? `&ticket=${encodeURIComponent(String(ticketNumber))}`
            : ''
        }`
      );
    } catch (e: unknown) {
      const ex = e as { body?: unknown };
      toast.error(
        ex.body !== undefined
          ? formatKioskOrderApiError(ex.body)
          : 'Could not place order.'
      );
    } finally {
      setPlacing(false);
    }
  };

  const confirmCheckoutOrder = () => {
    if (paymentMode === 'card') {
      if (!cardPayment.isCardPaymentComplete) {
        toast.warn('Complete card payment before confirming your order.');
        return;
      }
      void placeOrder({ paymentStatus: 'completed', paymentMethod: 'Card' });
      return;
    }
    void placeOrder({ paymentStatus: 'pending', paymentMethod: 'Cash' });
  };

  const startOver = () => {
    setLastOrderId(null);
    setLastTicketNumber(null);
    setStep('mode');
  };

  const ProductCard = ({ p }: { p: CustomerMenuProduct }) => {
    const unit = effectiveUnitPrice(p.price, p.salePrice);
    const showStrike =
      p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price;
    const isCustomizable = productNeedsCustomizeDialog(p);
    const q = qtyOnMenu(p.id);

    return (
      <Card className="overflow-hidden border border-[#e2e8f0] bg-white shadow-sm">
        <CardContent className="p-3">
          <LazyMenuProductImage
            src={p.imageUrl}
            hasImage={p.hasImage ?? Boolean(p.imageUrl)}
            alt={p.name}
            className="aspect-square w-full rounded-lg"
          />
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">
            {p.name}
          </h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-sm font-bold text-primary">
              {formatMoney(unit)}
            </span>
            {showStrike ? (
              <span className="text-xs text-[#94a3b8] line-through">
                {formatMoney(p.price)}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {q > 0 ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => bumpProductQty(p.id, -1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[2ch] text-center text-sm font-medium">
                  {q}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => onProductTap(p)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="w-full bg-primary font-semibold text-primary-foreground hover:brightness-95"
                onClick={() => onProductTap(p)}
              >
                {isCustomizable ? t('customizePlus') : t('addPlus')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const HorizontalRow = ({
    title,
    products,
  }: {
    title: string;
    products: CustomerMenuProduct[];
  }) => {
    if (products.length === 0) return null;
    return (
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {products.map((p) => (
            <div key={p.id} className="w-[140px] shrink-0">
              <ProductCard p={p} />
            </div>
          ))}
        </div>
      </section>
    );
  };

  if (branchValid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
        <Loader2 className="animate-spin text-primary h-10 w-10" />
      </div>
    );
  }

  if (branchValid === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8fafc] p-6">
        <p className="text-center text-[#dc2626]">
          This kiosk branch link is invalid.
        </p>
        <p className="text-center text-sm text-[#64748b]">
          Use a URL like{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            /kiosk/{slug}/[branchId]
          </code>{' '}
          from Settings → Website &amp; kiosk.
        </p>
      </div>
    );
  }

  if (!menuLoading && menuError) {
    const notFound = menuError === 'Restaurant not found for this link.';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8fafc] p-6">
        <p className="text-center text-[#dc2626]">
          {menuError ?? 'Menu unavailable.'}
        </p>
        {notFound ? (
          <p className="text-center text-sm text-[#64748b]">
            Check the URL slug matches your restaurant slug in Settings.
          </p>
        ) : null}
      </div>
    );
  }

  const displayMenu: MenuRestaurant = menu ?? {
    id: '',
    name: '',
    logoUrl: null,
    mainBannerUrl: null,
    themePrimaryColor: null,
    slug,
    menus: progressiveCategories.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      items: [],
    })),
  };

  const bannerSrc = displayMenu.mainBannerUrl?.trim() ?? '';
  const hasBanner = Boolean(bannerSrc);
  const kioskThemeVars = buildThemeCssVars(
    displayMenu.themePrimaryColor
  ) as CSSProperties;

  return (
    <div
      className="relative flex min-h-screen flex-1 flex-col text-[#0f172a]"
      style={kioskThemeVars}
    >
      <div
        className={cn(
          'relative z-10 flex min-h-screen flex-1 flex-col',
          !hasBanner && 'bg-[#f8fafc]'
        )}
      >
        <header className="sticky top-0 z-50 border-b border-[#e2e8f0] bg-white/95 px-4 py-3 text-[#0f172a] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {displayMenu.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayMenu.logoUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full border border-[#e2e8f0] object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate font-semibold">{displayMenu.name}</p>
                {branchName ? (
                  <p className="truncate text-xs text-[#64748b]">
                    {branchName}
                  </p>
                ) : null}
                {fulfillment ? (
                  <p className="text-xs text-[#64748b]">
                    {fulfillment === 'dine_in' ? 'Dine in' : 'Take away'}
                    {fulfillment === 'dine_in' && selectedTableId
                      ? ` · Table ${
                          diningTables.find((t) => t.id === selectedTableId)
                            ?.name ?? selectedTableId
                        }`
                      : ''}
                    {' · '}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setFulfillment(null);
                        setSelectedTableId('');
                        setStep('mode');
                      }}
                    >
                      Change
                    </button>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    className="border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
                  >
                    {t('language')}: {uiLang.toUpperCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setUiLanguage('es');
                    }}
                  >
                    Espanol
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setUiLanguage('en');
                    }}
                  >
                    English
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {step === 'menu' ? (
                <Button
                  type="button"
                  variant="default"
                  className="border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
                  onClick={() => setStep('cart')}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-xs font-medium text-primary mb-2">
                    {cartCount}
                  </span>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {step === 'mode' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 relative z-10">
            {hasBanner ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN URLs */}
                <img
                  src={bannerSrc}
                  alt=""
                  aria-hidden
                  decoding="async"
                  className="pointer-events-none fixed inset-0 z-0 h-[100dvh] min-h-[100svh] w-full object-cover object-center"
                />
                <div
                  aria-hidden
                  className="pointer-events-none fixed inset-0 z-[1] h-[100dvh] min-h-[100svh] bg-black/25"
                />
              </>
            ) : null}
            <div className="text-center bg-black/25 backdrop-blur p-6 rounded-lg shadow-lg relative z-20">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-primary">
                {t('whereEatingToday')}
              </h1>
              <p className="mt-2 text-sm text-white">
                {t('tapOptionToBrowse')}
              </p>
            </div>
            <div className="grid w-full max-w-md grid-cols-2 gap-4 relative z-20">
              <button
                type="button"
                onClick={() => {
                  setPendingFulfillment('dine_in');
                }}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary bg-gradient-to-b from-primary to-primary/90 p-8 text-white shadow-lg transition hover:opacity-95"
              >
                <UtensilsCrossed className="h-10 w-10" />
                <span className="font-semibold">{t('dineIn')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFulfillment('take_away');
                  setStep('menu');
                }}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary bg-gradient-to-b from-primary to-primary/90 p-8 text-white shadow-lg transition hover:opacity-95"
              >
                <ShoppingBag className="h-10 w-10" />
                <span className="font-semibold">{t('takeAway')}</span>
              </button>
            </div>
          </div>
        )}

        {step === 'menu' && (
          <>
            <div className="mx-auto flex w-full max-w-5xl flex-1 gap-0 md:gap-4">
              <aside className="hidden w-36 shrink-0 border-r border-[#e2e8f0] bg-[#fafafa] py-4 md:block">
                <ScrollArea className="h-[calc(100vh-8rem)]">
                  <nav className="flex flex-col gap-1 px-2">
                    {menuLoading ? (
                      <>
                        <CategoryPillSkeleton className="h-14 w-full rounded-lg" />
                        <CategoryPillSkeleton className="h-14 w-full rounded-lg" />
                        <CategoryPillSkeleton className="h-14 w-full rounded-lg" />
                      </>
                    ) : (
                      <>
                    <button
                      type="button"
                      onClick={() => setCategoryId('all')}
                      className={cn(
                        'rounded-lg px-2 py-2 text-left text-xs font-medium transition',
                        categoryId === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-[#f1f5f9]'
                      )}
                    >
                      <Store className="mb-1 h-5 w-5" />
                      All
                    </button>
                    {displayMenu.menus.map((c) => {
                      const thumb = getCategoryDisplayImageUrl(c);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategoryId(c.id)}
                          className={cn(
                            'rounded-lg px-2 py-2 text-left text-xs transition',
                            categoryId === c.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-[#f1f5f9]'
                          )}
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="mb-1 h-10 w-10 rounded-md object-cover"
                            />
                          ) : (
                            <div className="mb-1 h-10 w-10 rounded-md bg-[#e2e8f0]" />
                          )}
                          <span className="line-clamp-2">{c.name}</span>
                        </button>
                      );
                    })}
                      </>
                    )}
                  </nav>
                </ScrollArea>
              </aside>

              <main className="min-w-0 flex-1 px-4 py-4 pb-28">
                <div className="mb-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
                  {menuLoading ? (
                    <>
                      <CategoryPillSkeleton className="h-10 w-24 rounded-full" />
                      <CategoryPillSkeleton className="h-10 w-28 rounded-full" />
                      <CategoryPillSkeleton className="h-10 w-24 rounded-full" />
                    </>
                  ) : (
                    <>
                  <Button
                    type="button"
                    variant={categoryId === 'all' ? 'default' : 'outline'}
                    onClick={() => setCategoryId('all')}
                  >
                    All
                  </Button>
                  {displayMenu.menus.map((c) => {
                    const thumb = getCategoryDisplayImageUrl(c);
                    return (
                      <Button
                        key={c.id}
                        type="button"
                        variant={categoryId === c.id ? 'default' : 'outline'}
                        onClick={() => setCategoryId(c.id)}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : null}
                        {c.name}
                      </Button>
                    );
                  })}
                    </>
                  )}
                </div>

                {menuLoading ? (
                  <ProductCardSkeletonGrid
                    count={6}
                    variant="kiosk"
                    gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  />
                ) : (
                  <>
                <HorizontalRow
                  title={t('recommended')}
                  products={recommended}
                />
                <HorizontalRow
                  title={t('offersAndAddons')}
                  products={offeredPool}
                />

                {categoryId === 'all' ? (
                  progressiveCategories.map((category) => (
                    <section key={category.id} className="mb-6">
                      <h2 className=" mb-3 text-lg font-bold">{category.name}</h2>
                      {category.loading ||
                      (!category.loaded && category.items.length === 0) ? (
                        <ProductCardSkeletonGrid
                          count={4}
                          variant="kiosk"
                          gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                        />
                      ) : category.items.length === 0 ? (
                        <p className="text-sm text-[#64748b]">
                          {t('noProductsInCategory')}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {category.items.map((p) => (
                            <ProductCard
                              key={p.id}
                              p={{ ...p, categoryId: category.id }}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  ))
                ) : (
                  <section>
                    <h2 className="mb-3 text-lg font-bold">
                      {displayMenu.menus.find((c) => c.id === categoryId)?.name}
                    </h2>
                    {(() => {
                      const active = progressiveCategories.find(
                        (c) => c.id === categoryId
                      );
                      if (
                        active?.loading ||
                        (active && !active.loaded && active.items.length === 0)
                      ) {
                        return (
                          <ProductCardSkeletonGrid
                            count={4}
                            variant="kiosk"
                            gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                          />
                        );
                      }
                      if (displayedProducts.length === 0) {
                        return (
                          <p className="text-sm text-[#64748b]">
                            {t('noProductsInCategory')}
                          </p>
                        );
                      }
                      return (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {displayedProducts.map((p) => (
                            <ProductCard key={p.id} p={p} />
                          ))}
                        </div>
                      );
                    })()}
                  </section>
                )}
                  </>
                )}
              </main>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-primary bg-primary px-4 py-3 text-primary-foreground shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
              <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold tabular-nums">
                    {formatMoney(cartSubtotal)}
                  </p>
                  <p className="text-xs opacity-90">
                    {cartCount} {t('items')}
                  </p>
                  {cart.length > 0 ? (
                    <p
                      className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-95"
                      title={cart
                        .map((l) => `${l.quantity}× ${cartLineDisplayName(l)}`)
                        .join(' · ')}
                    >
                      {cartSummaryLines(cart, 4).join(' · ')}
                      {cart.length > 4 ? ` · +${cart.length - 4} more` : ''}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-0 bg-white font-semibold text-primary hover:bg-[#fff7ed]"
                  disabled={cartCount === 0}
                  onClick={() => setStep('cart')}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {t('viewCart')}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'cart' && (
          <div className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Cart</h1>
            </div>
            {cart.length === 0 ? (
              <>
                <div className="flex flex-col items-center justify-start gap-2">
                  <p className="text-[#64748b] w-full text-center">
                    Your cart is empty.
                  </p>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 p-2"
                    onClick={() => setStep('menu')}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('backToMenu')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <ul className="space-y-3">
                  {cart.map((line) => {
                    const personalizeNames = cartPersonalizeSelectionNames(
                      line.modifiers
                    );
                    const addonNames = cartModifierSelectionNames(
                      line.modifiers
                    );
                    const displayImageUrl = resolveCartLineImageUrl(
                      line,
                      productImageById
                    );
                    return (
                      <li
                        key={line.lineId}
                        className="flex gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm"
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f1f5f9]">
                          {displayImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={displayImageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">
                            {cartLineTitle(
                              line.productName,
                              line.variationName
                            )}
                          </p>
                          {personalizeNames.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {personalizeNames.map((name, index) => (
                                <p
                                  key={`${line.lineId}-personalize-${index}`}
                                  className="text-xs font-medium text-[#334155]"
                                >
                                  {name}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          {addonNames.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {addonNames.map((name, index) => (
                                <p
                                  key={`${line.lineId}-sel-${index}`}
                                  className="text-xs text-[#64748b]"
                                >
                                  - {name}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-1 text-xs text-[#64748b]">
                            {formatMoney(lineUnitTotal(line))} each
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => adjustLine(line.lineId, -1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-sm">
                              {line.quantity}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => adjustLine(line.lineId, 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="ml-auto h-8 w-8 text-[#dc2626]"
                              onClick={() => removeLine(line.lineId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  type="button"
                  variant="link"
                  className="text-[#dc2626]"
                  onClick={clearCart}
                >
                  Clear cart
                </Button>
                <div className="space-y-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm text-[#0f172a]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(cartSubtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatMoney(cartSubtotal)}
                    </span>
                  </div>
                </div>
                {fulfillment === 'take_away' ? (
                  <div className="space-y-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                      {t('customerDetails')}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="kiosk-customer-name">
                        {t('yourName')}
                      </Label>
                      <Input
                        id="kiosk-customer-name"
                        placeholder={t('yourName')}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        maxLength={120}
                        autoComplete="name"
                        className="border-[#e2e8f0] bg-white text-[#0f172a]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kiosk-customer-phone">
                        {t('phoneNumber')} ({t('optional')})
                      </Label>
                      <Input
                        id="kiosk-customer-phone"
                        type="tel"
                        placeholder={`${t('phoneNumber')} (${t('optional')})`}
                        value={customerPhone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setCustomerPhone(value);
                        }}
                        maxLength={40}
                        autoComplete="tel"
                        className="border-[#e2e8f0] bg-white text-[#0f172a]"
                      />
                    </div>
                  </div>
                ) : null}
                <textarea
                  placeholder="Cooking instructions (e.g. make it mild)"
                  value={cookingNote}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setCookingNote(e.target.value)
                  }
                  rows={3}
                  className={cn(
                    'flex min-h-[88px] w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]',
                    'placeholder:text-[#94a3b8]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8fafc]'
                  )}
                />
                <Button
                  type="button"
                  className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:brightness-95"
                  onClick={() => {
                    if (fulfillment === 'take_away' && !customerName.trim()) {
                      toast.warn(t('customerNameRequired'));
                      return;
                    }
                    setPaymentMode('cash');
                    cardPayment.resetCardPayment();
                    setStep('checkout');
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Checkout
                </Button>

                <Button
                  type="button"
                  className="w-full bg-black text-white"
                  onClick={() => setStep('menu')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('backToMenu')}
                </Button>
              </>
            )}
          </div>
        )}

        {step === 'checkout' && (
          <div className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-6">
            <h1 className="text-2xl font-bold">Checkout</h1>
            <p className="text-sm text-[#64748b]">
              {fulfillment === 'dine_in'
                ? `Dine in · Table ${
                    diningTables.find((t) => t.id === selectedTableId)?.name ??
                    selectedTableId
                  }`
                : `Take away · ${customerName || 'Guest'} · ${customerPhone || 'No phone'}`}
            </p>
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm text-[#0f172a]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                Order summary
              </p>
              <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                {cart.map((line) => {
                  const personalizeNames = cartPersonalizeSelectionNames(
                    line.modifiers
                  );
                  const addonNames = cartModifierSelectionNames(line.modifiers);
                  return (
                    <li
                      key={line.lineId}
                      className="border-b border-[#e2e8f0]/80 py-2 last:border-0"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="min-w-0 font-medium">
                          {cartLineTitle(line.productName, line.variationName)}
                        </p>
                        <span className="shrink-0 tabular-nums text-[#64748b]">
                          {formatMoney(lineTotal(line))}
                        </span>
                      </div>
                      {personalizeNames.length > 0 ? (
                        <div className="mt-0.5 space-y-0.5">
                          {personalizeNames.map((name, index) => (
                            <p
                              key={`${line.lineId}-personalize-${index}`}
                              className="text-xs font-medium text-[#334155]"
                            >
                              {name}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {addonNames.length > 0 ? (
                        <div className="mt-0.5 space-y-0.5">
                          {addonNames.map((name, index) => (
                            <p
                              key={`${line.lineId}-sel-${index}`}
                              className="text-xs text-[#64748b]"
                            >
                              - {name}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-0.5 text-xs text-[#64748b]">
                        x{line.quantity}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-1 border-t border-[#e2e8f0] pt-2 text-sm">
                <div className="flex justify-between text-[#64748b]">
                  <span>Subtotal</span>
                  <span>{formatMoney(cartSubtotal)}</span>
                </div>
                {serviceChargeAmount > 0 ? (
                  <div className="flex justify-between text-[#64748b]">
                    <span>Service charge</span>
                    <span>{formatMoney(serviceChargeAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-semibold text-[#0f172a]">
                  <span>Total due</span>
                  <span>{formatMoney(cartGrandTotal)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                  Payment method
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={paymentMode === 'cash' ? 'default' : 'outline'}
                    className="h-12 justify-start gap-2"
                    onClick={() => handleSelectPaymentMode('cash')}
                  >
                    <Banknote className="h-4 w-4" />
                    Cash
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMode === 'card' ? 'default' : 'outline'}
                    className="h-12 justify-start gap-2"
                    onClick={() => handleSelectPaymentMode('card')}
                  >
                    <CreditCard className="h-4 w-4" />
                    Card
                  </Button>
                </div>
                {paymentMode === 'card' ? (
                  <div className="mt-3 space-y-2">
                    <Button
                      type="button"
                      className={cn(
                        'w-full gap-2',
                        cardPayment.cardPaymentStatus === 'success' &&
                          'bg-emerald-600 hover:bg-emerald-600/90',
                        (cardPayment.cardPaymentStatus === 'error' ||
                          cardPayment.cardPaymentStatus === 'cancelled') &&
                          'bg-destructive hover:bg-destructive/90'
                      )}
                      disabled={
                        cardPayment.cardPaymentStatus === 'processing' ||
                        cardPayment.cardPaymentStatus === 'success'
                      }
                      onClick={() => void cardPayment.handleCardPayClick()}
                    >
                      {cardPayment.cardPaymentStatus === 'success' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Paid
                        </>
                      ) : cardPayment.cardPaymentStatus === 'error' ||
                        cardPayment.cardPaymentStatus === 'cancelled' ? (
                        <>
                          <XCircle className="h-4 w-4" />
                          Pay {formatMoney(cartGrandTotal)}
                        </>
                      ) : cardPayment.cardPaymentStatus === 'processing' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          Pay {formatMoney(cartGrandTotal)}
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-[#64748b]">
                      {cardPayment.isCardPaymentComplete
                        ? 'Payment complete — confirm your order below.'
                        : 'Pay by card before confirming your order.'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#64748b]">
                    Pay with cash at the counter. Your order will be created
                    with payment pending until staff sends it to the kitchen.
                  </p>
                )}
              </div>

              <Button
                type="button"
                className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:brightness-95"
                disabled={
                  placing ||
                  cart.length === 0 ||
                  cardPayment.cardPaymentStatus === 'processing' ||
                  (paymentMode === 'card' && !cardPayment.isCardPaymentComplete)
                }
                onClick={confirmCheckoutOrder}
              >
                {placing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing order…
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm order
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
                onClick={() => {
                  cardPayment.resetCardPayment();
                  setPaymentMode('cash');
                  setStep('cart');
                }}
              >
                Back
              </Button>
            </div>

            <CardPaymentDialogs
              amount={cartGrandTotal}
              cardPaymentStatus={cardPayment.cardPaymentStatus}
              cardTransactionId={cardPayment.cardTransactionId}
              cardProcessingOpen={cardPayment.cardProcessingOpen}
              cardPaymentOutcomeOpen={cardPayment.cardPaymentOutcomeOpen}
              setCardPaymentOutcomeOpen={cardPayment.setCardPaymentOutcomeOpen}
              setCardProcessingOpen={cardPayment.setCardProcessingOpen}
              onBypass={cardPayment.handleCardPaymentBypass}
              onCancel={cardPayment.handleCardPaymentCancel}
              formatMoney={formatMoney}
            />
          </div>
        )}

        {step === 'done' && (
          <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
            <div className="rounded-full bg-[#fff7ed] p-6 text-primary">
              <ShoppingBag className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Thank you!</h1>
              <p className="mt-2 text-[#64748b]">
                Your order was sent to the kitchen.
                {lastOrderId ? (
                  <>
                    {' '}
                    Reference:{' '}
                    <span className="font-mono text-xs">{lastOrderId}</span>
                    {lastTicketNumber != null ? (
                      <>
                        {' '}
                        · Ticket:{' '}
                        <span className="font-mono text-xs">
                          #{lastTicketNumber}
                        </span>
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>
            </div>
            <Button
              type="button"
              className="bg-primary px-8 text-primary-foreground hover:brightness-95"
              onClick={startOver}
            >
              New order
            </Button>
          </div>
        )}

        <Dialog
          open={pendingFulfillment === 'dine_in'}
          onOpenChange={(open) => {
            if (!open) setPendingFulfillment(null);
          }}
        >
          <DialogContent className="border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-primary">
                {t('selectTable')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="kiosk-table">{t('table')}</Label>
              <select
                id="kiosk-table"
                className="h-10 w-full rounded-md border border-[#e2e8f0] bg-white px-3 text-sm text-[#0f172a] outline-none ring-offset-0 focus:border-primary focus:ring-2 focus:ring-primary/30"
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
              >
                <option value="">{t('selectTable')}</option>
                {diningTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f1f5f9]"
                onClick={() => {
                  setPendingFulfillment(null);
                }}
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                className="bg-primary text-primary-foreground hover:brightness-95"
                onClick={() => {
                  if (!selectedTableId) {
                    toast.warn(t('chooseTableFirst'));
                    return;
                  }
                  setFulfillment('dine_in');
                  setStep('menu');
                  setPendingFulfillment(null);
                }}
              >
                {t('continue')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <MenuOfferChoiceDialog
          open={menuOfferOpen}
          onOpenChange={(open) => {
            setMenuOfferOpen(open);
            if (!open) {
              setMenuOfferProduct(null);
              setMenuOfferBundles([]);
            }
          }}
          product={menuOfferProduct}
          bundleProducts={menuOfferBundles}
          themePrimaryColor={displayMenu?.themePrimaryColor ?? null}
          onChooseSingle={() => {
            const p = menuOfferProduct;
            setMenuOfferOpen(false);
            setMenuOfferProduct(null);
            setMenuOfferBundles([]);
            if (p) proceedWithProduct(p);
          }}
          onChooseBundle={(bundle) => {
            setMenuOfferOpen(false);
            setMenuOfferProduct(null);
            setMenuOfferBundles([]);
            const full = resolveCatalogProduct(bundle);
            if (full) proceedWithProduct(full);
          }}
        />

        <ProductCustomizeDialog
          productName={customizeProduct?.name ?? ''}
          productImageUrl={customizeProduct?.imageUrl ?? null}
          productDescription={customizeProduct?.description ?? null}
          themePrimaryColor={displayMenu?.themePrimaryColor ?? null}
          productBaseUnitPrice={
            customizeProduct
              ? effectiveUnitPrice(
                  customizeProduct.price,
                  customizeProduct.salePrice
                )
              : 0
          }
          attributeGroups={attributeGroupsForDialog}
          personalizeGroups={customizeProduct?.personalizeGroups ?? []}
          variations={(customizeProduct?.variations ?? []).map((v) => ({
            id: v.id,
            name: v.name ?? v.title ?? 'Variation',
            imageUrl: v.imageUrl ?? null,
            swatchHex: v.swatchHex,
            priceDelta: v.priceDelta,
          }))}
          open={dialogOpen}
          isLoading={customizeLoading}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              customizeLoadTokenRef.current += 1;
              setCustomizeProduct(null);
              setCustomizeLoading(false);
            }
          }}
          onConfirm={(mods, variation, quantity = 1) => {
            if (!customizeProduct) return;
            const mapped: CartModifierSelection[] = mods.map((m) => ({
              attributeGroupId: m.attributeGroupId,
              groupName: m.groupName,
              selections: m.selections.map((s) => ({
                menuItemId: s.menuItemId,
                name: String(s.name ?? 'Option'),
                unitPrice: Number.isFinite(Number(s.unitPrice))
                  ? Number(s.unitPrice)
                  : 0,
              })),
            }));
            const times = Math.max(1, Math.floor(quantity));
            for (let i = 0; i < times; i += 1) {
              addToCart(customizeProduct, mapped, variation ?? null);
            }
            setDialogOpen(false);
            setCustomizeProduct(null);
            setCustomizeLoading(false);
          }}
        />
      </div>
    </div>
  );
}
