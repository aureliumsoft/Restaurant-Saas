'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  IconChevronLeft,
  IconChevronRight,
  IconShoppingBag,
  IconShoppingCart,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

import { MenuOfferChoiceDialog } from '@/components/order/menu-offer-choice-dialog';
import {
  ProductCustomizeDialog,
  type AttributeGroup,
  type MenuOption,
  type SelectedProductVariation,
} from '@/components/order/product-customize-dialog';
import { findBundleParentProducts } from '@/lib/menu/find-bundle-parent-products';
import type { OrderInfo } from '@/components/order/order-types';
import {
  buildCustomerMenuRequestUrl,
  inferHostSubdomainForMenu,
} from '@/lib/customer-menu-client';
import { buildCustomerAttributeGroup } from '@/lib/menu/build-customer-attribute-group';
import { getMenuItemDisplayPrice } from '@/lib/menu-item-pricing';
import {
  cartLineTitle,
  cartModifierSelectionNames,
} from '@/lib/cart-line-display';
import { orderPathWithQuery } from '@/lib/order-search-params';
import { setUiLanguage } from '@/lib/i18n/client';
import type { UiLanguage } from '@/lib/i18n/resources';
import { cn } from '@/lib/utils';
import { ArrowUp, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';

export type OrderPageProps = {
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
  variations?: {
    id: string;
    name?: string;
    title?: string;
    imageUrl?: string | null;
    swatchHex?: string | null;
    priceDelta: number;
    sortOrder?: number;
  }[];
  attributeGroups: {
    id: string;
    name: string;
    selectionType: 'SINGLE' | 'MULTIPLE';
    sourceType?: 'CATEGORY' | 'PRODUCT';
    multipleMode?: 'CHECKBOX' | 'QUANTITY' | null;
    freeQuantity?: number | null;
    required: boolean;
    minItems: number | null;
    maxItems: number | null;
    variationLimits?: {
      variationId: string;
      minItems: number;
      maxItems: number;
    }[];
    linkedCategory?: {
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
    } | null;
    linkedProduct?: {
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
    } | null;
  }[];
};

type CustomerMenuCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
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

const ALL_CATEGORY_ID = 'all';

function effectiveUnitPrice(price: number, salePrice: number | null) {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
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
  variationId?: string | null;
  variationName?: string | null;
  variationPriceOverride?: number;
  modifiers: CartModifierSelection[];
  modifiersSignature: string; // used to merge identical customizations
  offeredProductName?: string | null;
};

function getSignature(
  mods: CartModifierSelection[],
  variationId?: string | null
) {
  return mods
    .slice()
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

      // New format
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
          modifiers: Array.isArray((maybeLine as any).modifiers)
            ? (maybeLine as any).modifiers
            : [],
          modifiersSignature: String(maybeLine.modifiersSignature ?? ''),
          offeredProductName: (maybeLine as any).offeredProductName ?? null,
        });
        continue;
      }

      // Legacy format: [{ product: {id,name,price,image,description...}, quantity }]
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

function OfferSlider({
  items,
  current,
  onPrev,
  onNext,
}: {
  items: OfferItem[];
  current: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = items[current] ?? items[0];
  if (!item) return null;
  return (
    <div className="relative mx-auto mb-8 max-w-7xl overflow-hidden rounded-2xl border border-border bg-card">
      <img
        src={item.image}
        alt={item.id}
        className="h-56 w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30 p-6"></div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <Button variant="outline" size="icon" onClick={onPrev} type="button">
          <IconChevronLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <Button variant="outline" size="icon" onClick={onNext} type="button">
          <IconChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

type OfferItem = {
  id: string;
  image: string;
};

function ProductCard({
  product,
  onAdd,
  showCustomizeIndicator,
}: {
  product: CustomerMenuProduct;
  onAdd: () => void;
  showCustomizeIndicator: boolean;
}) {
  const { t } = useTranslation();
  const priceDisplay = getMenuItemDisplayPrice(product);
  const hasSale = priceDisplay.compareAt != null;

  return (
    <Card className="bg-card cursor-pointer" onClick={onAdd}>
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-40 w-full object-cover rounded-t-lg"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground">
          <IconShoppingBag className="h-10 w-10" />
        </div>
      )}
      <CardContent className="space-y-2">
        <h3 className="text-lg font-semibold line-clamp-1 mt-5">
          {product.name}
        </h3>
        {product.description ? (
          <p className="text-sm text-muted-foreground">
            {product.description.slice(0, 60)}...
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="font-bold">
            {priceDisplay.prefix ? (
              <span className="mr-1 text-sm font-normal text-muted-foreground">
                {priceDisplay.prefix}
              </span>
            ) : null}
            {hasSale ? (
              <span className="mr-2 text-sm font-normal text-muted-foreground line-through">
                €{priceDisplay.compareAt!.toFixed(2)}
              </span>
            ) : null}
            €{priceDisplay.amount.toFixed(2)}
          </span>
          <Button size="sm" onClick={onAdd} type="button">
            {showCustomizeIndicator ? t('customizePlus') : t('addPlus')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrderPageClient({
  orderType,
  orderId,
  orderInfo,
}: OrderPageProps) {
  const restaurantSlug =
    orderInfo?.restaurantSlug?.trim() || orderInfo?.storeId?.trim() || '';
  const storefrontPath = restaurantSlug
    ? `/web-app/${encodeURIComponent(restaurantSlug)}`
    : '/web-app';

  const [categories, setCategories] = useState<CustomerMenuCategory[]>([]);
  const [products, setProducts] = useState<CustomerMenuProduct[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentOffer, setCurrentOffer] = useState(0);
  const [bannerOffers, setBannerOffers] = useState<OfferItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const [menuLoading, setMenuLoading] = useState(false);
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );
  const { t, i18n } = useTranslation();
  const uiLang: UiLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'es';

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeProduct, setCustomizeProduct] =
    useState<CustomerMenuProduct | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [menuOfferOpen, setMenuOfferOpen] = useState(false);
  const [menuOfferProduct, setMenuOfferProduct] =
    useState<CustomerMenuProduct | null>(null);
  const [menuOfferBundles, setMenuOfferBundles] = useState<
    CustomerMenuProduct[]
  >([]);

  const { theme, resolvedTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderInfoRef = useRef(orderInfo);
  orderInfoRef.current = orderInfo;

  const openCustomizeForProduct = (p: CustomerMenuProduct) => {
    setCustomizeProduct(p);
    setCustomizeOpen(true);
  };

  const openModifyForLine = (line: CartLine) => {
    const product = products.find((p) => p.id === line.menuItemId) ?? null;
    if (!product) {
      toast.error(t('productNotFoundToModify'));
      return;
    }
    setEditingLineId(line.lineId);
    setCustomizeProduct(product);
    setCustomizeOpen(true);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!mounted) return;
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
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
            localStorage.removeItem(`cart-${orderId}`);
          } catch {
            // ignore storage errors
          }
          setCart([]);
          toast.success(t('paymentReceivedOrderSent'));
        } else {
          toast.info(t('paymentProcessingSyncSoon'));
        }
        router.replace(
          orderPathWithQuery(
            `/order/${orderType}/${orderId}`,
            orderInfoRef.current
          )
        );
      })();
      return;
    }
    setCart(parseCartFromStorage(localStorage.getItem(`cart-${orderId}`)));
  }, [mounted, orderId, orderType, router, searchParams]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(`cart-${orderId}`, JSON.stringify(cart));
  }, [cart, mounted, orderId]);

  useEffect(() => {
    if (!mounted) return;
    const loadBanners = async () => {
      try {
        let restaurantUrl: string | null = null;
        const slug = orderInfo?.restaurantSlug?.trim();
        if (slug) {
          restaurantUrl = `/api/customer/restaurant?slug=${encodeURIComponent(slug)}`;
        } else {
          const subdomain = inferHostSubdomainForMenu();
          const fallbackSub = orderInfo?.storeId?.trim() || subdomain;
          if (fallbackSub) {
            restaurantUrl = `/api/customer/restaurant?subdomain=${encodeURIComponent(
              fallbackSub
            )}`;
          }
        }
        if (!restaurantUrl) return;

        const res = await fetch(restaurantUrl);
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const themeColor =
          typeof json?.data?.themePrimaryColor === 'string'
            ? json.data.themePrimaryColor.trim()
            : '';
        setThemePrimaryColor(themeColor || null);
        const urls = Array.isArray(json?.data?.menuBannerUrls)
          ? (json.data.menuBannerUrls as string[]).filter(
              (u) => typeof u === 'string' && u.trim() !== ''
            )
          : [];
        if (urls.length === 0) return;

        const mapped = urls.map((image, idx) => ({
          id: `menu-banner-${idx + 1}`,
          image,
        }));
        setBannerOffers(mapped);
      } catch {
        // keep default static offers
      }
    };

    void loadBanners();
  }, [
    mounted,
    orderInfo?.restaurantSlug,
    orderInfo?.storeId,
    orderInfo?.restaurantName,
    orderInfo?.storeName,
  ]);

  useEffect(() => {
    if (bannerOffers.length === 0) return;
    setCurrentOffer((prev) => prev % bannerOffers.length);
  }, [bannerOffers]);

  const addToCart = (
    product: CustomerMenuProduct,
    modifiers: CartModifierSelection[],
    variation?: SelectedProductVariation | null,
    options?: { showToast?: boolean }
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
      if (existing) {
        return current.map((l) =>
          l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l
        );
      }

      const line: CartLine = {
        lineId:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `l${Date.now()}`,
        menuItemId: product.id,
        productName: product.name,
        description: product.description ?? null,
        imageUrl: product.imageUrl ?? null,
        baseUnitPrice,
        quantity: 1,
        variationId,
        variationName: variation?.name ?? null,
        variationPriceOverride: variation?.priceDelta ?? undefined,
        modifiers,
        modifiersSignature,
      };

      return [...current, line];
    });

    if (options?.showToast !== false) {
      toast.success(t('productAddedToCart'));
    }
  };

  const hasRequiredAddons = (p: CustomerMenuProduct) =>
    p.attributeGroups.some((g) => g.required);
  const hasVariations = (p: CustomerMenuProduct) =>
    (p.variations?.length ?? 0) > 0;

  const resolveCatalogProduct = (ref: { id: string }) =>
    products.find((p) => p.id === ref.id) ?? null;

  const proceedWithProduct = (p: CustomerMenuProduct) => {
    if (hasRequiredAddons(p) || hasVariations(p)) {
      openCustomizeForProduct(p);
    } else {
      addToCart(p, []);
    }
  };

  const handleProductSelect = (product: CustomerMenuProduct) => {
    const bundles = findBundleParentProducts(product.id, products);
    if (bundles.length > 0) {
      setMenuOfferProduct(product);
      setMenuOfferBundles(bundles);
      setMenuOfferOpen(true);
      return;
    }
    proceedWithProduct(product);
  };

  const filteredProducts = useMemo(() => {
    const base =
      selectedCategory === ALL_CATEGORY_ID
        ? products
        : products.filter((p) => p.categoryId === selectedCategory);
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter((p) =>
      (p.name + ' ' + (p.description ?? '')).toLowerCase().includes(q)
    );
  }, [products, selectedCategory, search]);

  const displayedCategories = useMemo(() => {
    if (selectedCategory === ALL_CATEGORY_ID) {
      return categories.map((category) => ({
        ...category,
        items: filteredProducts.filter((p) => p.categoryId === category.id),
      }));
    }

    return categories
      .filter((category) => category.id === selectedCategory)
      .map((category) => ({
        ...category,
        items: filteredProducts,
      }));
  }, [categories, filteredProducts, selectedCategory]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + lineTotal(line), 0),
    [cart]
  );

  const adjustQuantity = (lineId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.lineId === lineId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (lineId: string) => {
    setCart((current) => current.filter((x) => x.lineId !== lineId));
  };

  const onCategoryClick = (id: string) => {
    setSelectedCategory(id);
  };

  const categoryStripItems = useMemo(
    () => [
      { id: ALL_CATEGORY_ID, name: t('all'), imageUrl: null as string | null },
      ...categories.map((category) => ({
        id: category.id,
        name: category.name,
        imageUrl:
          category.imageUrl ?? category.items[0]?.imageUrl ?? null,
      })),
    ],
    [categories, t]
  );

  const categoryStripIdsKey = useMemo(
    () => categoryStripItems.map((c) => c.id).join(','),
    [categoryStripItems]
  );

  const categoryStripRef = useRef<HTMLDivElement>(null);
  const [categoryStripScroll, setCategoryStripScroll] = useState({
    back: false,
    forward: false,
  });

  const syncCategoryStripScroll = useCallback(() => {
    const el = categoryStripRef.current;
    if (!el) {
      setCategoryStripScroll({ back: false, forward: false });
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = Math.max(0, scrollWidth - clientWidth);
    setCategoryStripScroll({
      back: scrollLeft > 4,
      forward: max > 4 && scrollLeft < max - 4,
    });
  }, []);

  useLayoutEffect(() => {
    syncCategoryStripScroll();
  }, [categoryStripIdsKey, syncCategoryStripScroll]);

  useEffect(() => {
    const el = categoryStripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncCategoryStripScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncCategoryStripScroll]);

  const scrollCategoryStrip = useCallback((direction: 'back' | 'forward') => {
    const el = categoryStripRef.current;
    if (!el) return;
    const amount = Math.min(Math.max(el.clientWidth * 0.65, 140), 280);
    el.scrollBy({
      left: direction === 'forward' ? amount : -amount,
      behavior: 'smooth',
    });
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const loadMenu = async () => {
      try {
        setMenuLoading(true);

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
          setCategories([]);
          setProducts([]);
          return;
        }

        const res = await fetch(menuUrl);

        if (!res.ok) {
          console.error('Failed to load menu', await res.text());
          setCategories([]);
          setProducts([]);
          return;
        }

        const payload = (await res.json()) as CustomerMenuResponse;
        const restaurant =
          'data' in payload
            ? payload.data ?? null
            : (payload as CustomerMenuRestaurant);
        const menus =
          restaurant && Array.isArray(restaurant.menus) ? restaurant.menus : [];

        setCategories(menus);
        setProducts(
          menus.flatMap((cat) =>
            cat.items.map((item) => ({
              ...item,
              categoryId: cat.id,
            }))
          )
        );
      } catch (err) {
        console.error('Error loading customer menu', err);
        setCategories([]);
        setProducts([]);
      } finally {
        setMenuLoading(false);
      }
    };

    void loadMenu();
  }, [mounted, orderInfo?.storeId]);

  useEffect(() => {
    if (categories.length === 0) {
      if (selectedCategory !== '') setSelectedCategory('');
      return;
    }
    if (!selectedCategory) {
      setSelectedCategory(ALL_CATEGORY_ID);
      return;
    }
    if (
      selectedCategory !== ALL_CATEGORY_ID &&
      !categories.some((category) => category.id === selectedCategory)
    ) {
      setSelectedCategory(ALL_CATEGORY_ID);
    }
  }, [categories, selectedCategory]);

  const attributeGroupsForDialog: AttributeGroup[] = useMemo(() => {
    if (!customizeProduct) return [];
    return customizeProduct.attributeGroups.map((g) =>
      buildCustomerAttributeGroup(g, customizeProduct.id)
    );
  }, [customizeProduct]);

  // Avoid server/client markup mismatches by rendering only after first mount.
  // Important: this must be AFTER all hooks to keep React Hook order stable.
  if (!mounted) return null;

  const cartPanel = (
    <div className="flex min-h-[32rem] max-h-[calc(100dvh-2rem)] flex-col rounded-2xl border border-border bg-card p-4">
      <h3 className="text-lg font-semibold">
        {orderType === 'delivery' ? t('delivery') : t('takeAway')} /{' '}
        {t('orderInfo')}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('orderType')}: {orderType}. {t('estimated')}{' '}
        {orderType === 'delivery' ? t('delivery') : t('takeAway')}{' '}
        {t('time20to30Mins')}
      </p>

      <h4 className="mt-5 text-lg font-bold">{t('cart')}</h4>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('cartEmpty')}</p>
        ) : (
          <div className="space-y-3">
            {cart.map((line) => (
              <div
                key={line.lineId}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  {(() => {
                    const isCustomized =
                      Boolean(line.variationId) || line.modifiers.length > 0;
                    const addonNames = cartModifierSelectionNames(
                      line.modifiers
                    );
                    return (
                      <>
                        <p className="truncate font-medium">
                          {cartLineTitle(line.productName, line.variationName)}
                        </p>
                        {addonNames.length > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            {addonNames.map((name, index) => (
                              <p
                                key={`${line.lineId}-sel-${index}`}
                                className="truncate text-xs text-muted-foreground"
                              >
                                - {name}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adjustQuantity(line.lineId, -1)}
                            disabled={line.quantity <= 1}
                            type="button"
                          >
                            -
                          </Button>
                          <span>{line.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adjustQuantity(line.lineId, 1)}
                            type="button"
                          >
                            +
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeFromCart(line.lineId)}
                            type="button"
                          >
                            {<Trash2 className="mr-1 h-3 w-3" />} {t('remove')}
                          </Button>
                          {isCustomized ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openModifyForLine(line)}
                              type="button"
                            >
                              {<Pencil className="mr-1 h-3 w-3" />} {t('modify')}
                            </Button>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <span className="shrink-0 text-sm font-medium">
                  €{lineTotal(line).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-sm font-bold">
        <span>{t('total')}</span>
        <span>€{total.toFixed(2)}</span>
      </div>
      <Button
        className="mt-2 w-full"
        onClick={() =>
          router.push(
            orderPathWithQuery(`/order/${orderType}/${orderId}/cart`, orderInfo)
          )
        }
        type="button"
        disabled={cart.length === 0}
      >
        {t('viewCart')}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
          <h1 className="text-3xl font-bold">
            {orderInfo?.restaurantName ?? 'Enjoy Tacos'}
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-primary ">
              {orderType === 'delivery' ? t('delivery') : t('pickUp')}{' '}
              {t('order')} - {orderId}
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => router.push(storefrontPath)}
            >
              <IconShoppingCart className="w-4 h-4 mr-2" />
              {t('switchOrderTypeNewOrder')}
            </Button>
          </div>
        </div>

        <OfferSlider
          items={bannerOffers}
          current={currentOffer}
          onPrev={() =>
            setCurrentOffer(
              (p) => (p - 1 + bannerOffers.length) % bannerOffers.length
            )
          }
          onNext={() => setCurrentOffer((p) => (p + 1) % bannerOffers.length)}
        />

<div
              className="mb-4 min-w-0 w-full max-w-full min-h-0 overflow-x-clip"
              aria-label={t('allCategories')}
            >
             
              <div className="relative isolate w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card">
                <div className="grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1.5 px-1 py-1.5 sm:gap-2 sm:px-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-sm"
                    disabled={!categoryStripScroll.back}
                    aria-label="Scroll categories back"
                    onClick={() => scrollCategoryStrip('back')}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <div
                    ref={categoryStripRef}
                    onScroll={syncCategoryStripScroll}
                    className="min-h-0 min-w-0 max-w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <div className="flex w-max items-center gap-2 py-0.5 pe-0.5 ps-0.5">
                      {categoryStripItems.map((category) => {
                        const isActive = selectedCategory === category.id;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => onCategoryClick(category.id)}
                            className={cn(
                              'inline-flex h-9 max-w-[11rem] shrink-0 items-center gap-2 rounded-full border px-1.5 py-0.5 text-left text-sm font-medium shadow-sm outline-none ring-offset-background transition sm:max-w-[12.5rem]',
                              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                              'active:scale-[0.98]',
                              isActive
                                ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                : 'border-border bg-card text-primary hover:border-primary/45 hover:bg-primary/5'
                            )}
                          >
                            {category.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- customer menu URLs
                              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                                <img
                                  src={category.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </span>
                            ) : (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                                —
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate pr-1 leading-tight">
                              {category.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-sm"
                    disabled={!categoryStripScroll.forward}
                    aria-label="Scroll categories forward"
                    onClick={() => scrollCategoryStrip('forward')}
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={searchOpen ? 'outline' : 'default'}
                    size="icon"
                    className="h-9 w-9 shrink-0  shadow-sm"
                    aria-label={t('searchProducts')}
                    aria-pressed={searchOpen}
                    onClick={() => setSearchOpen((open) => !open)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {searchOpen ? (
                <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    ref={searchInputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('searchProducts')}
                    className="min-w-0 w-full"
                  />
                  <Button
                    className="shrink-0 whitespace-nowrap"
                    onClick={() => {
                      setSearch('');
                      setSearchOpen(false);
                    }}
                    variant="outline"
                    type="button"
                    aria-label={t('clear')}
                  >
                    <X className="h-4 w-4 sm:me-1" />
                    <span className="hidden sm:inline">{t('clear')}</span>
                  </Button>
                </div>
              ) : null}
            </div>

        <div className="flex min-w-0 w-full max-w-full flex-col gap-6 md:flex-row md:items-start">
          <div className="min-w-0 w-full md:w-[70%] md:max-w-[70%]">

          {orderInfo && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-4">
            <h4 className="text-sm font-semibold mb-2">{t('orderDetails')}</h4>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">{t('mode')}:</strong>{' '}
                {orderInfo.mode}
              </div>
              {orderInfo.mode === 'delivery' ? (
                <>
                  <div>
                    <strong className="text-foreground">{t('address')}:</strong>{' '}
                    {orderInfo.address || 'N/A'}
                  </div>
                  <div>
                    <strong className="text-foreground">{t('name')}:</strong>{' '}
                    {orderInfo.addressName || 'N/A'}
                  </div>
                  <div>
                    <strong className="text-foreground">
                      {t('phoneLabel')}:
                    </strong>{' '}
                    {orderInfo.customerPhone || 'N/A'}
                  </div>
                  <div>
                    <strong className="text-foreground">
                      {t('apartment')}:
                    </strong>{' '}
                    {orderInfo.apartment || 'N/A'}
                  </div>
                  <div>
                    <strong className="text-foreground">
                      {t('gateCode')}:
                    </strong>{' '}
                    {orderInfo.gateCode || 'N/A'}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong className="text-foreground">{t('store')}:</strong>{' '}
                    {orderInfo.storeName || 'N/A'}
                  </div>
                  <div>
                    <strong className="text-foreground">
                      {t('storeAddress')}:
                    </strong>{' '}
                    {orderInfo.storeAddress || 'N/A'}
                  </div>
                  <div>
                    <strong className="text-foreground">{t('name')}:</strong>{' '}
                    {orderInfo.addressName || 'N/A'}
                  </div>
                  <div>
                    <strong className="text-foreground">
                      {t('phoneLabel')}:
                    </strong>{' '}
                    {orderInfo.customerPhone || 'N/A'}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
        
           

            {menuLoading ? (
              <Loader2 className="animate-spin text-primary text-center mx-auto" />
            ) : (
              <section className="mb-8 min-w-0">
                <h2 className="mb-4 text-xl font-semibold">
                  {selectedCategory === ALL_CATEGORY_ID
                    ? t('allCategories')
                    : categories.find((c) => c.id === selectedCategory)
                        ?.name ?? t('selectedCategory')}
                </h2>

                {displayedCategories.length > 0 ? (
                  displayedCategories.map((category) => {
                    const categoryProducts = category.items;

                    if (categoryProducts.length === 0)
                      return (
                        <div key={category.id} className="mb-10">
                          <p className="text-sm text-muted-foreground">
                            {t('noProductsFoundInCategory')}
                          </p>
                        </div>
                      );

                    return (
                      <div
                        key={category.id}
                        id={category.id}
                        className="mb-10 min-w-0"
                      >
                        <h3 className="mb-3 text-lg font-bold">
                          {category.name}
                        </h3>
                        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {categoryProducts.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              showCustomizeIndicator={hasRequiredAddons(
                                product
                              )}
                              onAdd={() => handleProductSelect(product)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="mb-10">
                    <p className="text-sm text-muted-foreground">
                      {t('noCategoriesFound')}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="min-w-0 w-full shrink-0 md:sticky md:top-4 md:z-10 md:w-[30%] md:max-w-[30%] md:self-start">
            {cartPanel}
          </aside>
        </div>

        <ProductCustomizeDialog
        open={customizeOpen}
        onOpenChange={(open) => {
          setCustomizeOpen(open);
          if (!open) {
            setCustomizeProduct(null);
            setEditingLineId(null);
          }
        }}
        productName={customizeProduct?.name ?? 'Product'}
        productImageUrl={customizeProduct?.imageUrl ?? null}
        productDescription={customizeProduct?.description ?? null}
        themePrimaryColor={themePrimaryColor}
        productBaseUnitPrice={
          customizeProduct
            ? effectiveUnitPrice(
                customizeProduct.price,
                customizeProduct.salePrice
              )
            : 0
        }
        attributeGroups={attributeGroupsForDialog}
        variations={(customizeProduct?.variations ?? []).map((v) => ({
          id: v.id,
          name: v.name ?? v.title ?? 'Variation',
          imageUrl: v.imageUrl ?? null,
          swatchHex: v.swatchHex ?? null,
          priceDelta: v.priceDelta,
          restaurantVariationId:
            (v as { restaurantVariationId?: string | null })
              .restaurantVariationId ?? null,
          variationShortLabel:
            (
              v as {
                restaurantVariation?: { shortLabel?: string | null } | null;
              }
            ).restaurantVariation?.shortLabel ?? null,
        }))}
        onConfirm={(mods, variation, quantity = 1) => {
          if (!customizeProduct) return;

          const cartMods: CartModifierSelection[] = mods.map((m) => ({
            attributeGroupId: m.attributeGroupId,
            groupName: m.groupName,
            selections: m.selections.map((s: MenuOption) => ({
              menuItemId: s.menuItemId,
              name: s.name,
              unitPrice: s.unitPrice,
            })),
          }));

          if (editingLineId) {
            setCart((current) =>
              current.filter((line) => line.lineId !== editingLineId)
            );
          }
          const times = Math.max(1, Math.floor(quantity));
          for (let i = 0; i < times; i += 1) {
            addToCart(customizeProduct, cartMods, variation ?? null, {
              showToast: i === times - 1,
            });
          }
          setCustomizeOpen(false);
          setCustomizeProduct(null);
          setEditingLineId(null);
        }}
      />

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
          themePrimaryColor={themePrimaryColor}
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

      {showScrollTop ? (
        <Button
          type="button"
          size="icon"
          className="fixed bottom-6 right-6 z-500 h-11 w-11 rounded-full shadow-lg"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      ) : null}
      </div>
    </div>
  );
}
