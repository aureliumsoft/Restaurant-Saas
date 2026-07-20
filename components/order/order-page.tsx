'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  buildCustomerMenuCategoriesUrl,
  buildCustomerMenuCategoryItemsUrl,
  inferHostSubdomainForMenu,
} from '@/lib/customer-menu-client';
import { useProgressiveCustomerMenu } from '@/hooks/use-progressive-customer-menu';
import {
  CategoryPillSkeleton,
  ProductCardSkeletonGrid,
} from '@/components/menu/product-card-skeleton';
import { buildCustomerAttributeGroup } from '@/lib/menu/build-customer-attribute-group';
import { productNeedsCustomizeDialog } from '@/lib/menu/personalize-options';
import {
  fetchCustomerMenuProductDetail,
  productNeedsDetailFetch,
} from '@/lib/menu/fetch-menu-product-detail';
import { LazyMenuProductImage } from '@/components/menu/lazy-menu-product-image';
import { getCategoryDisplayImageUrl } from '@/lib/menu/category-display-image';
import { getMenuItemDisplayPrice } from '@/lib/menu-item-pricing';
import {
  cartLineTitle,
  cartModifierDisplayLines,
} from '@/lib/cart-line-display';
import { cartLineTotal, cartLineUnitTotal, normalizeCartModifiers } from '@/lib/cart-normalize';
import {
  compactCartImageUrl,
  onlineCartStorageKey,
  writeCartToLocalStorage,
} from '@/lib/cart-storage';
import { orderPathWithQuery } from '@/lib/order-search-params';
import { setUiLanguage } from '@/lib/i18n/client';
import type { UiLanguage } from '@/lib/i18n/resources';
import { buildStorefrontThemeVars } from '@/lib/restaurant-theme';
import {
  ORDER_CATEGORY_BAR_HEIGHT_PX,
  ORDER_MENU_HEADER_HEIGHT_PX,
  ORDER_PAGE_MAX_WIDTH_PX,
  ORDER_SIDEBAR_WIDTH_PX,
  ORDER_TOP_OFFSET_PX,
  OrderCartCheckoutButton,
  OrderCartPanel,
  OrderMenuHeader,
} from '@/components/order/order-menu-header';
import { cn } from '@/lib/utils';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { ArrowUp, Minus, Pencil, Plus, Search, X } from 'lucide-react';
import type { BranchOpeningHours } from '@/lib/order-time-slots';

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
  hasImage?: boolean;
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
          variationId: (maybeLine as CartLine).variationId ?? null,
          variationName: (maybeLine as CartLine).variationName ?? null,
          variationPriceOverride: (maybeLine as CartLine).variationPriceOverride,
          modifiers: normalizeCartModifiers((maybeLine as any).modifiers),
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
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [slideStep, setSlideStep] = useState(0);

  const measureSlides = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const firstSlide = track.querySelector(
      '[data-offer-slide]'
    ) as HTMLElement | null;
    if (!firstSlide) return;
    const gap = items.length > 1 ? 12 : 0;
    setSlideStep(firstSlide.offsetWidth + gap);
  }, [items.length]);

  useLayoutEffect(() => {
    measureSlides();
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => measureSlides());
    observer.observe(track);
    return () => observer.disconnect();
  }, [items, measureSlides]);

  if (items.length === 0) return null;

  const multi = items.length > 1;
  const slideWidthClass =
    items.length === 1
      ? 'w-full'
      : items.length === 2
        ? 'w-[calc((100%-0.75rem)/2)]'
        : 'w-[88%] sm:w-[46%]';

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-bold text-primary">
        {t('orderCurrentOffers')}
      </h2>
      <div className="relative">
        <div className="overflow-hidden">
          <div
            ref={trackRef}
            className={cn(
              'flex gap-3 transition-transform duration-300 ease-out will-change-transform',
              !multi && 'gap-0'
            )}
            style={
              multi && slideStep > 0
                ? { transform: `translateX(-${current * slideStep}px)` }
                : undefined
            }
          >
            {items.map((item) => (
              <div
                key={item.id}
                data-offer-slide
                className={cn(
                  'shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm',
                  slideWidthClass
                )}
              >
                <img
                  src={item.image}
                  alt=""
                  className="h-36 w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
        {multi ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-md transition hover:scale-105 sm:left-3"
              onClick={onPrev}
              aria-label="Previous offer"
            >
              <IconChevronLeft className="h-5 w-5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-md transition hover:scale-105 sm:right-3"
              onClick={onNext}
              aria-label="Next offer"
            >
              <IconChevronRight className="h-5 w-5 stroke-[2.5]" />
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

type OfferItem = {
  id: string;
  image: string;
};

function ProductCard({
  product,
  onAdd,
  formatMoney,
}: {
  product: CustomerMenuProduct;
  onAdd: () => void;
  formatMoney: (amount: number) => string;
  showCustomizeIndicator?: boolean;
}) {
  const priceDisplay = getMenuItemDisplayPrice(product);
  const hasSale = priceDisplay.compareAt != null;

  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add ${product.name}`}
      className="flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="relative">
        {product.hasImage ?? Boolean(product.imageUrl) ? (
          <LazyMenuProductImage
            src={product.imageUrl}
            hasImage
            alt={product.name}
            className="h-44 w-full"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-[#f4f4f6] text-muted-foreground">
            <IconShoppingBag className="h-10 w-10" />
          </div>
        )}
        <span
          className="pointer-events-none absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md"
          aria-hidden
        >
          <Plus className="h-5 w-5" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-bold text-primary">
          {product.name}
        </h3>
        {product.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#8e8e9a]">
            {product.description}
          </p>
        ) : (
          <span className="mt-1.5 block flex-1" />
        )}
        <div className="mt-3 text-base font-bold text-primary">
          {priceDisplay.prefix ? (
            <span className="mr-1 text-xs font-normal text-[#8e8e9a]">
              {priceDisplay.prefix}
            </span>
          ) : null}
          {hasSale ? (
            <span className="mr-2 text-sm font-normal text-[#8e8e9a] line-through">
              {formatMoney(priceDisplay.compareAt!)}
            </span>
          ) : null}
          {formatMoney(priceDisplay.amount)}
        </div>
      </div>
    </button>
  );
}

export default function OrderPageClient({
  orderType,
  orderId,
  orderInfo,
}: OrderPageProps) {
  const restaurantSlug =
    orderInfo?.restaurantSlug?.trim() || orderInfo?.storeId?.trim() || '';
  const { formatMoney } = useRestaurantRegional(
    restaurantSlug || undefined
  );
  const storefrontPath = restaurantSlug
    ? `/web-app/${encodeURIComponent(restaurantSlug)}`
    : '/web-app';

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentOffer, setCurrentOffer] = useState(0);
  const [bannerOffers, setBannerOffers] = useState<OfferItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [branchHours, setBranchHours] = useState<BranchOpeningHours | null>(null);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const { t, i18n } = useTranslation();
  const uiLang: UiLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'es';

  const hostSubdomain = inferHostSubdomainForMenu();
  const categoriesUrl = buildCustomerMenuCategoriesUrl(
    orderInfo?.restaurantSlug,
    orderInfo?.storeId,
    hostSubdomain
  );
  const categoryItemsUrl = useCallback(
    (categoryId: string, page: number, limit: number) =>
      buildCustomerMenuCategoryItemsUrl(
        categoryId,
        orderInfo?.restaurantSlug,
        orderInfo?.storeId,
        hostSubdomain,
        { page, limit }
      ),
    [orderInfo?.restaurantSlug, orderInfo?.storeId, hostSubdomain]
  );

  const {
    restaurantMeta,
    categories: progressiveCategories,
    categoriesLoading,
  } = useProgressiveCustomerMenu<CustomerMenuProduct>({
    categoriesUrl: mounted ? categoriesUrl : null,
    categoryItemsUrl,
    enabled: mounted && Boolean(categoriesUrl),
  });

  const categories = useMemo<CustomerMenuCategory[]>(
    () =>
      progressiveCategories.map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
        items: c.items,
      })),
    [progressiveCategories]
  );

  const products = useMemo(
    () =>
      progressiveCategories.flatMap((c) =>
        c.items.map((item) => ({ ...item, categoryId: c.id }))
      ),
    [progressiveCategories]
  );

  const menuLoading = categoriesLoading && categories.length === 0;

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
    writeCartToLocalStorage(onlineCartStorageKey(orderId), cart);
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
        const logo =
          typeof json?.data?.logoUrl === 'string' && json.data.logoUrl.trim()
            ? json.data.logoUrl.trim()
            : '';
        setLogoUrl(logo || null);
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

  useEffect(() => {
    const branchId = orderInfo?.storeId?.trim();
    if (!branchId) {
      setBranchHours(null);
      setSlotDurationMinutes(30);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/branches?slug=' + encodeURIComponent(restaurantSlug || ''), {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json().catch(() => ({}))) as {
          data?: Array<{
            id?: string;
            openingHours?: BranchOpeningHours | null;
            slotDurationMinutes?: number | null;
          }>;
        };
        const branch = (json.data ?? []).find((item) => item.id === branchId);
        if (!cancelled) {
          setBranchHours(branch?.openingHours ?? null);
          setSlotDurationMinutes(
            branch?.slotDurationMinutes === 15 ||
              branch?.slotDurationMinutes === 30 ||
              branch?.slotDurationMinutes === 60
              ? branch.slotDurationMinutes
              : 30
          );
        }
      } catch {
        if (!cancelled) {
          setBranchHours(null);
          setSlotDurationMinutes(30);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderInfo?.storeId, restaurantSlug]);

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
        imageUrl: compactCartImageUrl(product.imageUrl),
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

  const resolveCatalogProduct = (ref: { id: string }) =>
    products.find((p) => p.id === ref.id) ?? null;

  const proceedWithProduct = async (p: CustomerMenuProduct) => {
    if (productNeedsCustomizeDialog(p)) {
      let product = p;
      if (productNeedsDetailFetch(p)) {
        const full = await fetchCustomerMenuProductDetail<CustomerMenuProduct>(
          p.id,
          {
            slug: orderInfo?.restaurantSlug,
            subdomain: hostSubdomain || orderInfo?.storeId,
          }
        );
        if (!full) {
          toast.error(t('productNotFoundToModify'));
          return;
        }
        product = { ...full, categoryId: p.categoryId };
      }
      openCustomizeForProduct(product);
      return;
    }
    addToCart(p, []);
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

  const cartItemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
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

  const onCategoryClick = (id: string) => {
    setSelectedCategory(id);
  };

  const categoryStripItems = useMemo(
    () => [
      {
        id: ALL_CATEGORY_ID,
        name: t('allCategories'),
        imageUrl: null as string | null,
      },
      ...categories.map((category) => ({
        id: category.id,
        name: category.name,
        imageUrl: getCategoryDisplayImageUrl(category),
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
    if (!restaurantMeta) return;
    setThemePrimaryColor(
      (restaurantMeta.themePrimaryColor as string | null) ?? null
    );
    setLogoUrl((restaurantMeta.logoUrl as string | null) ?? null);
  }, [restaurantMeta]);

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

  const cartFooter = (
    <OrderCartCheckoutButton
      itemCount={cartItemCount}
      total={total}
      formattedTotal={formatMoney(total)}
      label={t('orderSeeMyOrder')}
      onClick={() =>
        router.push(
          orderPathWithQuery(`/order/${orderType}/${orderId}/cart`, orderInfo)
        )
      }
    />
  );

  const cartPanel = (
    <OrderCartPanel
      isEmpty={cart.length === 0}
      footer={cart.length > 0 ? cartFooter : undefined}
    >
      {cart.length === 0 ? (
        <div className="text-center">
          <p className="text-xl font-bold leading-snug text-primary sm:text-2xl">
            {t('cartEmptyTitle')}
          </p>
          <p className="mt-3 text-sm font-normal text-[#8e8e9a]">
            {t('orderCartEmptyHint')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#ececf0]">
          {cart.map((line) => {
            const modifierLines = cartModifierDisplayLines(line.modifiers);
            const canModify =
              Boolean(line.variationId) || line.modifiers.length > 0;

            return (
              <div key={line.lineId} className="py-4 first:pt-1 last:pb-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-primary">
                    {cartLineTitle(line.productName, line.variationName)}
                  </p>
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {formatMoney(lineTotal(line))}
                  </span>
                </div>

                {modifierLines.length > 0 ? (
                  <div className="mt-2 space-y-0.5">
                    {modifierLines.map((modLine, index) => (
                      <p
                        key={`${line.lineId}-mod-${index}`}
                        className={cn(
                          'text-xs leading-relaxed text-primary/75',
                          modLine.prefix === 'dash' && 'pl-3'
                        )}
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

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center bg-primary text-sm font-bold text-primary-foreground transition hover:brightness-95 disabled:opacity-40"
                      onClick={() => adjustQuantity(line.lineId, -1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                    <span className="min-w-[1.75rem] text-center text-sm font-bold text-[#1f1f2e]">
                      {String(line.quantity).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center bg-primary text-sm font-bold text-primary-foreground transition hover:brightness-95"
                      onClick={() => adjustQuantity(line.lineId, 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                  {canModify ? (
                    <button
                      type="button"
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-95"
                      onClick={() => openModifyForLine(line)}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {t('modify')}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OrderCartPanel>
  );

  const renderCategoryBar = () => (
    <div className="flex h-full min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d8dce6] bg-white text-primary transition hover:bg-[#fafafa] disabled:opacity-35"
        disabled={!categoryStripScroll.back}
        aria-label="Scroll categories back"
        onClick={() => scrollCategoryStrip('back')}
      >
        <IconChevronLeft className="h-4 w-4" strokeWidth={2} />
      </button>
      <div
        ref={categoryStripRef}
        onScroll={syncCategoryStripScroll}
        className="min-h-0 min-w-0 flex-1 touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max items-center gap-2.5 py-1">
          {menuLoading ? (
            <>
              <CategoryPillSkeleton />
              <CategoryPillSkeleton />
              <CategoryPillSkeleton />
            </>
          ) : (
            categoryStripItems.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategoryClick(category.id)}
                className={cn(
                  'inline-flex h-10 max-w-[11.5rem] shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-left text-sm font-semibold transition sm:max-w-[12.5rem]',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-[#f4f4f6] text-primary hover:bg-[#ebe8f2]/80'
                )}
              >
                {category.imageUrl ? (
                  <span
                    className={cn(
                      'relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1',
                      isActive
                        ? 'bg-white/15 ring-primary-foreground/25'
                        : 'bg-white ring-white'
                    )}
                  >
                    <img
                      src={category.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                ) : (
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1',
                      isActive
                        ? 'bg-white/20 text-primary-foreground ring-primary-foreground/25'
                        : 'bg-white text-primary/50 ring-white'
                    )}
                  >
                    {category.id === ALL_CATEGORY_ID
                      ? '★'
                      : category.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 truncate leading-none">
                  {category.name}
                </span>
              </button>
            );
          })
          )}
        </div>
      </div>
      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d8dce6] bg-white text-primary transition hover:bg-[#fafafa] disabled:opacity-35"
        disabled={!categoryStripScroll.forward}
        aria-label="Scroll categories forward"
        onClick={() => scrollCategoryStrip('forward')}
      >
        <IconChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition',
          searchOpen
            ? 'border border-primary bg-white text-primary'
            : 'bg-primary text-primary-foreground hover:brightness-95'
        )}
        aria-label={t('searchProducts')}
        aria-pressed={searchOpen}
        onClick={() => setSearchOpen((open) => !open)}
      >
        <Search className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );

  const themeVars = buildStorefrontThemeVars(themePrimaryColor);

  return (
    <div
      className="web-app-customer min-h-screen bg-[#f4f4f6] text-foreground"
      style={themeVars as CSSProperties}
    >
      <OrderMenuHeader
        orderId={orderId}
        restaurantName={orderInfo?.restaurantName}
        restaurantSlug={orderInfo?.restaurantSlug}
        logoUrl={logoUrl}
        themePrimaryColor={themePrimaryColor}
        orderType={orderType}
        storeName={orderInfo?.storeName}
        storeAddress={orderInfo?.storeAddress}
        deliveryAddress={orderInfo?.address}
        backHref={storefrontPath}
        branchHours={branchHours}
        slotDurationMinutes={slotDurationMinutes}
      />

      <div
        className="fixed inset-x-0 z-40 border-b border-[#ececf0] bg-white"
        style={{
          top: ORDER_MENU_HEADER_HEIGHT_PX,
          height: ORDER_CATEGORY_BAR_HEIGHT_PX,
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center px-4 sm:px-6">
          {renderCategoryBar()}
        </div>
      </div>

      {searchOpen ? (
        <div
          className="fixed inset-x-0 z-30 flex justify-center"
          style={{ top: ORDER_TOP_OFFSET_PX }}
        >
          <div
            className="w-full max-w-full border-b border-[#ececf0] bg-white px-4 py-2 sm:max-w-[min(100%,var(--order-page-max-width))] sm:px-6"
            style={
              {
                '--order-page-max-width': `${ORDER_PAGE_MAX_WIDTH_PX}px`,
              } as CSSProperties
            }
          >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
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
          </div>
        </div>
      ) : null}

      <div
        className="mx-auto flex min-h-screen w-full max-w-full flex-col sm:max-w-[min(100%,var(--order-page-max-width))] lg:flex-row"
        style={{
          paddingTop: searchOpen
            ? ORDER_TOP_OFFSET_PX + 56
            : ORDER_TOP_OFFSET_PX,
          ['--order-page-max-width' as string]: `${ORDER_PAGE_MAX_WIDTH_PX}px`,
        }}
      >
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
          {bannerOffers.length > 0 ? (
            <OfferSlider
              items={bannerOffers}
              current={currentOffer}
              onPrev={() =>
                setCurrentOffer(
                  (p) => (p - 1 + bannerOffers.length) % bannerOffers.length
                )
              }
              onNext={() =>
                setCurrentOffer((p) => (p + 1) % bannerOffers.length)
              }
            />
          ) : null}

          <section className="min-w-0">
            {menuLoading ? (
              <ProductCardSkeletonGrid
                count={6}
                variant="online"
                gridClassName="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              />
            ) : displayedCategories.length > 0 ? (
              displayedCategories.map((category) => {
                const progressive = progressiveCategories.find(
                  (c) => c.id === category.id
                );
                const isCategoryLoading =
                  progressive?.loading ||
                  (progressive &&
                    !progressive.loaded &&
                    category.items.length === 0);

                if (isCategoryLoading) {
                  return (
                    <div key={category.id} id={category.id} className="mb-10 min-w-0">
                      <h3 className="mb-4 text-xl font-bold text-primary">
                        {category.name}
                      </h3>
                      <ProductCardSkeletonGrid
                        count={3}
                        variant="online"
                        gridClassName="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      />
                    </div>
                  );
                }

                const categoryProducts = category.items;

                if (categoryProducts.length === 0) {
                  return (
                    <div key={category.id} className="mb-10">
                      <p className="text-sm text-[#8e8e9a]">
                        {t('noProductsFoundInCategory')}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={category.id}
                    id={category.id}
                    className="mb-10 min-w-0"
                  >
                    <h3 className="mb-4 text-xl font-bold text-primary">
                      {category.name}
                    </h3>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          formatMoney={formatMoney}
                          onAdd={() => void handleProductSelect(product)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="mb-10">
                <p className="text-sm text-[#8e8e9a]">
                  {t('noCategoriesFound')}
                </p>
              </div>
            )}
          </section>
        </main>

        <aside
          className="hidden shrink-0 flex-col bg-[#f4f4f6] p-3 lg:sticky lg:flex lg:self-start"
          style={{
            width: ORDER_SIDEBAR_WIDTH_PX,
            top: ORDER_TOP_OFFSET_PX,
            height: `calc(100dvh - ${ORDER_TOP_OFFSET_PX}px)`,
          }}
        >
          {cartPanel}
        </aside>

        <aside className="shrink-0 bg-[#f4f4f6] p-3 lg:hidden">{cartPanel}</aside>
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
        personalizeGroups={customizeProduct?.personalizeGroups ?? []}
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
              name: String(s.name ?? 'Option'),
              unitPrice: Number.isFinite(Number(s.unitPrice))
                ? Number(s.unitPrice)
                : 0,
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
          className="fixed bottom-6 z-40 h-11 w-11 rounded-full shadow-lg right-6 lg:right-[max(1.5rem,calc((100vw-1280px)/2+320px+1rem))]"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      ) : null}
    </div>
  );
}
