'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  IconChevronLeft,
  IconChevronRight,
  IconShoppingBag,
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
  prefetchCustomerMenuProductDetail,
  productNeedsDetailFetch,
} from '@/lib/menu/fetch-menu-product-detail';
import { customerMenuItemImageUrl } from '@/lib/menu/menu-item-image-utils';
import { getCategoryDisplayImageUrl } from '@/lib/menu/category-display-image';
import { getMenuItemDisplayPrice } from '@/lib/menu-item-pricing';
import {
  cartLineTitle,
  cartModifierDisplayLines,
} from '@/lib/cart-line-display';
import {
  orderInfoHasContext,
  orderPathWithQuery,
} from '@/lib/order-search-params';
import { setUiLanguage } from '@/lib/i18n/client';
import type { UiLanguage } from '@/lib/i18n/resources';
import { buildStorefrontThemeVars } from '@/lib/restaurant-theme';
import {
  ORDER_CATEGORY_BAR_HEIGHT_PX,
  ORDER_MENU_HEADER_HEIGHT_PX,
  ORDER_SIDEBAR_WIDTH_PX,
  ORDER_PAGE_MAX_WIDTH_PX,
  ORDER_TOP_OFFSET_PX,
  OrderCartCheckoutButton,
  OrderCartPanel,
  OrderMenuHeader,
} from '@/components/order/order-menu-header';
import { cn } from '@/lib/utils';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { readOrderContext } from '@/lib/order-context-storage';
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
  dealsFromThis?: Array<{
    id: string;
    dealItemId: string;
    dealItem: {
      id: string;
      name: string;
      description?: string | null;
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
    };
  }>;
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

const ORDER_PRODUCT_GRID =
  'grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4';

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
  cartQty = 0,
  onAdd,
  onIncrease,
  onDecrease,
  onPrefetch,
  formatMoney,
}: {
  product: CustomerMenuProduct;
  cartQty?: number;
  onAdd: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
  onPrefetch?: () => void;
  formatMoney: (amount: number) => string;
  showCustomizeIndicator?: boolean;
}) {
  const priceDisplay = getMenuItemDisplayPrice(product);
  const hasSale = priceDisplay.compareAt != null;
  const isSelected = cartQty > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            onAdd();
          }
        }
      }}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onTouchStart={onPrefetch}
      aria-label={`${product.name} - ${formatMoney(priceDisplay.amount)}`}
      className={cn(
        'group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm transition-all duration-150 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isSelected
          ? 'border-2 border-[#f5a623] shadow-md ring-1 ring-[#f5a623]/20'
          : 'border border-[#e8eaef] hover:border-primary/25 hover:shadow-md'
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f4f4f6]">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#f4f4f6] text-muted-foreground/60">
            <IconShoppingBag className="h-8 w-8" />
          </div>
        )}
        {hasSale && priceDisplay.compareAt ? (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-destructive-foreground shadow-sm">
            −{Math.round(((priceDisplay.compareAt - priceDisplay.amount) / priceDisplay.compareAt) * 100)}%
          </span>
        ) : null}

        {isSelected ? (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg bg-black/50 px-1.5 py-1 backdrop-blur-sm shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDecrease?.();
              }}
              aria-label={`Decrease ${product.name} quantity`}
              className="flex h-7 w-7 items-center justify-center rounded bg-white text-[#1f1f2e] shadow-sm transition hover:bg-white/90 active:scale-90"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span className="min-w-[1.5rem] text-center text-xs sm:text-sm font-bold text-white tabular-nums">
              {String(cartQty).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIncrease?.();
              }}
              aria-label={`Increase ${product.name} quantity`}
              className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-90"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <span
            className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md transition-transform duration-150 group-hover:scale-110 group-active:scale-95"
            aria-hidden
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <h3 className="line-clamp-2 text-sm sm:text-[15px] font-bold leading-snug text-primary transition-colors group-hover:text-primary">
          {product.name}
        </h3>
        {product.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#8e8e9a]">
            {product.description}
          </p>
        ) : (
          <span className="mt-1 block flex-1" />
        )}
        <div className="mt-2.5 flex items-baseline gap-1 text-sm sm:text-base font-bold text-primary">
          {priceDisplay.prefix ? (
            <span className="mr-0.5 text-xs font-normal text-[#8e8e9a]">
              {priceDisplay.prefix}
            </span>
          ) : null}
          {hasSale && priceDisplay.compareAt ? (
            <span className="mr-1.5 text-xs sm:text-sm font-normal text-[#8e8e9a] line-through">
              {formatMoney(priceDisplay.compareAt)}
            </span>
          ) : null}
          <span>{formatMoney(priceDisplay.amount)}</span>
        </div>
      </div>
    </div>
  );
}

export default function OrderPageClient({
  orderType,
  orderId,
  orderInfo: initialOrderInfo,
}: OrderPageProps) {
  const [storedOrderInfo, setStoredOrderInfo] = useState<OrderInfo | undefined>(
    undefined
  );

  useEffect(() => {
    setStoredOrderInfo(readOrderContext(orderId) ?? undefined);
  }, [orderId]);

  const orderInfo = orderInfoHasContext(initialOrderInfo)
    ? initialOrderInfo
    : storedOrderInfo;
  const restaurantSlug =
    orderInfo?.restaurantSlug?.trim() || orderInfo?.storeId?.trim() || '';
  const { formatMoney } = useRestaurantRegional(
    restaurantSlug || undefined
  );
  const storefrontPath = restaurantSlug
    ? `/web-app/${encodeURIComponent(restaurantSlug)}`
    : '/web-app';

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [scrollActiveCategoryId, setScrollActiveCategoryId] =
    useState<string>(ALL_CATEGORY_ID);
  const ignoreCategorySpyUntilRef = useRef<number>(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentOffer, setCurrentOffer] = useState(0);
  const [bannerOffers, setBannerOffers] = useState<OfferItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [navigatingToCart, startCartTransition] = useTransition();

  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [branchHours, setBranchHours] = useState<BranchOpeningHours | null>(null);
  const { t, i18n } = useTranslation();
  const uiLang: UiLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'es';

  const hostSubdomain = inferHostSubdomainForMenu();
  const categoriesUrl = buildCustomerMenuCategoriesUrl(
    orderInfo?.restaurantSlug,
    orderInfo?.storeId,
    hostSubdomain,
    orderInfo?.storeId
  );
  const categoryItemsUrl = useCallback(
    (categoryId: string, page: number, limit: number) =>
      buildCustomerMenuCategoryItemsUrl(
        categoryId,
        orderInfo?.restaurantSlug,
        orderInfo?.storeId,
        hostSubdomain,
        orderInfo?.storeId,
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
  const [customizeLoading, setCustomizeLoading] = useState(false);
  const customizeLoadTokenRef = useRef(0);
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

  const openCustomizeForProduct = (
    p: CustomerMenuProduct,
    options?: { loading?: boolean }
  ) => {
    setCustomizeProduct(p);
    setCustomizeLoading(options?.loading ?? false);
    setCustomizeOpen(true);
  };

  const openModifyForLine = async (line: CartLine) => {
    const product = products.find((p) => p.id === line.menuItemId) ?? null;
    if (!product) {
      toast.error(t('productNotFoundToModify'));
      return;
    }
    setEditingLineId(line.lineId);
    if (productNeedsDetailFetch(product)) {
      const token = ++customizeLoadTokenRef.current;
      openCustomizeForProduct(product, { loading: true });
      const full = await fetchCustomerMenuProductDetail<CustomerMenuProduct>(
        product.id,
        {
          slug: orderInfo?.restaurantSlug ?? undefined,
          subdomain: hostSubdomain ?? undefined,
        }
      );
      if (token !== customizeLoadTokenRef.current) return;
      if (full) {
        setCustomizeProduct({ ...full, categoryId: product.categoryId });
        setCustomizeLoading(false);
        return;
      }
    }
    openCustomizeForProduct(product);
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
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/branches?slug=' + encodeURIComponent(restaurantSlug || ''), {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json().catch(() => ({}))) as { data?: Array<{ id?: string; openingHours?: BranchOpeningHours | null }> };
        const branch = (json.data ?? []).find((item) => item.id === branchId);
        if (!cancelled) {
          setBranchHours(branch?.openingHours ?? null);
        }
      } catch {
        if (!cancelled) setBranchHours(null);
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

  const resolveCatalogProduct = (ref: { id: string }) => {
    const found = products.find((p) => p.id === ref.id);
    if (found) return found;
    const bundle = menuOfferBundles.find((b) => b.id === ref.id);
    return bundle ?? null;
  };

  const proceedWithProduct = async (p: CustomerMenuProduct) => {
    if (productNeedsCustomizeDialog(p)) {
      if (productNeedsDetailFetch(p)) {
        const token = ++customizeLoadTokenRef.current;
        openCustomizeForProduct(p, { loading: true });
        const full = await fetchCustomerMenuProductDetail<CustomerMenuProduct>(
          p.id,
          {
            slug: orderInfo?.restaurantSlug ?? undefined,
            subdomain: hostSubdomain ?? undefined,
          }
        );
        if (token !== customizeLoadTokenRef.current) return;
        if (full) {
          setCustomizeProduct({ ...full, categoryId: p.categoryId });
          setCustomizeLoading(false);
          return;
        }
      }
      openCustomizeForProduct(p);
    } else {
      addToCart(p, []);
    }
  };

  const handleProductSelect = (product: CustomerMenuProduct) => {
    const directDeals = (product.dealsFromThis ?? []).map((d) => {
      const existing = products.find((p) => p.id === d.dealItem.id);
      const imageFallback =
        existing?.imageUrl ??
        d.dealItem.imageUrl ??
        (orderInfo?.restaurantSlug
          ? customerMenuItemImageUrl(d.dealItem.id, {
              slug: orderInfo.restaurantSlug,
              subdomain: hostSubdomain,
            })
          : null);
      return {
        ...(existing ?? d.dealItem),
        imageUrl: imageFallback,
      } as CustomerMenuProduct;
    });
    const bundles =
      directDeals.length > 0
        ? directDeals
        : findBundleParentProducts(product.id, products);
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

  const cartQuantitiesByProductId = useMemo(() => {
    const map = new Map<string, { totalQty: number; lines: CartLine[] }>();
    for (const line of cart) {
      const existing = map.get(line.menuItemId) ?? { totalQty: 0, lines: [] };
      existing.totalQty += line.quantity;
      existing.lines.push(line);
      map.set(line.menuItemId, existing);
    }
    return map;
  }, [cart]);

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

  const scrollCategoryPillIntoView = useCallback((id: string) => {
    const strip = categoryStripRef.current;
    if (!strip) return;
    const pill = strip.querySelector<HTMLElement>(
      `[data-category-pill="${id}"]`
    );
    pill?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, []);

  const onCategoryClick = (id: string) => {
    if (id === ALL_CATEGORY_ID) {
      setSelectedCategory(ALL_CATEGORY_ID);
      setScrollActiveCategoryId(ALL_CATEGORY_ID);
      ignoreCategorySpyUntilRef.current = Date.now() + 700;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      scrollCategoryPillIntoView(ALL_CATEGORY_ID);
      return;
    }

    if (selectedCategory === ALL_CATEGORY_ID && !search.trim()) {
      setScrollActiveCategoryId(id);
      ignoreCategorySpyUntilRef.current = Date.now() + 700;
      const targetSection = document.querySelector<HTMLElement>(
        `[data-category-section="${id}"]`
      );
      if (targetSection) {
        const topOffset = ORDER_TOP_OFFSET_PX + 12;
        const elementPosition =
          targetSection.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - topOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth',
        });
      }
      scrollCategoryPillIntoView(id);
      return;
    }

    setSelectedCategory(id);
    setScrollActiveCategoryId(id);
    scrollCategoryPillIntoView(id);
  };

  const isAllCategoryMode =
    selectedCategory === ALL_CATEGORY_ID && !search.trim();
  const activeCategoryPillId = isAllCategoryMode
    ? scrollActiveCategoryId
    : selectedCategory;

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
    if (!mounted || selectedCategory !== ALL_CATEGORY_ID || search.trim()) return;

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-category-section]')
    );
    if (sections.length === 0) return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.categorySection;
          if (!id) continue;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        if (Date.now() < ignoreCategorySpyUntilRef.current) return;

        if (window.scrollY < 80) {
          setScrollActiveCategoryId((prev) => {
            if (prev === ALL_CATEGORY_ID) return prev;
            scrollCategoryPillIntoView(ALL_CATEGORY_ID);
            return ALL_CATEGORY_ID;
          });
          return;
        }

        let bestId = sections[0]?.dataset.categorySection ?? ALL_CATEGORY_ID;
        let bestRatio = -1;
        for (const section of sections) {
          const id = section.dataset.categorySection;
          if (!id) continue;
          const ratio = ratios.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestRatio <= 0) return;
        setScrollActiveCategoryId((prev) => {
          if (prev === bestId) return prev;
          scrollCategoryPillIntoView(bestId);
          return bestId;
        });
      },
      {
        root: null,
        threshold: [0.05, 0.2, 0.4, 0.6, 0.8],
        rootMargin: `-${ORDER_TOP_OFFSET_PX + 20}px 0px -45% 0px`,
      }
    );

    for (const section of sections) {
      observer.observe(section);
    }

    const handleScroll = () => {
      if (Date.now() < ignoreCategorySpyUntilRef.current) return;
      if (window.scrollY < 60) {
        setScrollActiveCategoryId((prev) => {
          if (prev === ALL_CATEGORY_ID) return prev;
          scrollCategoryPillIntoView(ALL_CATEGORY_ID);
          return ALL_CATEGORY_ID;
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [
    mounted,
    selectedCategory,
    search,
    displayedCategories,
    scrollCategoryPillIntoView,
  ]);

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

  useEffect(() => {
    if (!mounted || cart.length === 0) return;
    const cartUrl = orderPathWithQuery(
      `/order/${orderType}/${orderId}/cart`,
      orderInfo
    );
    router.prefetch(cartUrl);
  }, [mounted, cart.length, orderType, orderId, orderInfo, router]);

  // Avoid server/client markup mismatches by rendering only after first mount.
  // Important: this must be AFTER all hooks to keep React Hook order stable.
  if (!mounted) return null;

  const handleGoToCart = () => {
    if (navigatingToCart) return;
    const cartUrl = orderPathWithQuery(
      `/order/${orderType}/${orderId}/cart`,
      orderInfo
    );
    startCartTransition(() => {
      router.push(cartUrl);
    });
  };

  const cartFooter = (
    <OrderCartCheckoutButton
      itemCount={cartItemCount}
      total={total}
      formattedTotal={formatMoney(total)}
      label={t('orderSeeMyOrder')}
      isLoading={navigatingToCart}
      onClick={handleGoToCart}
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
            const isActive = activeCategoryPillId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                data-category-pill={category.id}
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
        logoUrl={logoUrl}
        themePrimaryColor={themePrimaryColor}
        orderType={orderType}
        storeName={orderInfo?.storeName}
        storeAddress={orderInfo?.storeAddress}
        deliveryAddress={orderInfo?.address}
        backHref={storefrontPath}
        branchHours={branchHours}
      />

      <div
        className="fixed inset-x-0 z-40 border-b border-[#ececf0] bg-white"
        style={{
          top: ORDER_MENU_HEADER_HEIGHT_PX,
          height: ORDER_CATEGORY_BAR_HEIGHT_PX,
        }}
      >
        <div
          className="mx-auto flex h-full w-full items-center px-4 sm:px-6"
          style={{ maxWidth: ORDER_PAGE_MAX_WIDTH_PX }}
        >
          {renderCategoryBar()}
        </div>
      </div>

      {searchOpen ? (
        <div
          className="fixed inset-x-0 z-30 flex justify-center bg-white border-b border-[#ececf0]"
          style={{ top: ORDER_TOP_OFFSET_PX }}
        >
          <div
            className="mx-auto w-full px-4 py-2 sm:px-6"
            style={{ maxWidth: ORDER_PAGE_MAX_WIDTH_PX }}
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
        className="mx-auto flex min-h-screen w-full flex-col lg:flex-row"
        style={{
          maxWidth: ORDER_PAGE_MAX_WIDTH_PX,
          paddingTop: searchOpen
            ? ORDER_TOP_OFFSET_PX + 56
            : ORDER_TOP_OFFSET_PX,
        }}
      >
        <main
          className={cn(
            'min-w-0 flex-1 px-4 py-5 sm:px-6',
            cart.length > 0 ? 'pb-28 lg:pb-6' : 'pb-6'
          )}
        >
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
                count={8}
                variant="online"
                gridClassName={ORDER_PRODUCT_GRID}
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
                    <div
                      key={category.id}
                      id={category.id}
                      data-category-section={category.id}
                      className="mb-10 min-w-0"
                    >
                      <h3 className="mb-3 text-lg sm:text-xl font-bold text-primary">
                        {category.name}
                      </h3>
                      <ProductCardSkeletonGrid
                        count={4}
                        variant="online"
                        gridClassName={ORDER_PRODUCT_GRID}
                      />
                    </div>
                  );
                }

                const categoryProducts = category.items;

                if (categoryProducts.length === 0) {
                  return (
                    <div
                      key={category.id}
                      id={category.id}
                      data-category-section={category.id}
                      className="mb-10 min-w-0"
                    >
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
                    data-category-section={category.id}
                    className="mb-10 min-w-0"
                  >
                    <h3 className="mb-3 text-lg sm:text-xl font-bold text-primary">
                      {category.name}
                    </h3>
                    <div className={ORDER_PRODUCT_GRID}>
                      {categoryProducts.map((product) => {
                        const cartInfo = cartQuantitiesByProductId.get(product.id);
                        const cartQty = cartInfo?.totalQty ?? 0;
                        return (
                          <ProductCard
                            key={product.id}
                            product={product}
                            cartQty={cartQty}
                            formatMoney={formatMoney}
                            onAdd={() => handleProductSelect(product)}
                            onIncrease={() => {
                              if (
                                cartInfo &&
                                cartInfo.lines.length === 1 &&
                                !productNeedsCustomizeDialog(product)
                              ) {
                                adjustQuantity(cartInfo.lines[0].lineId, 1);
                              } else {
                                handleProductSelect(product);
                              }
                            }}
                            onDecrease={() => {
                              if (cartInfo && cartInfo.lines.length > 0) {
                                adjustQuantity(
                                  cartInfo.lines[cartInfo.lines.length - 1].lineId,
                                  -1
                                );
                              }
                            }}
                            onPrefetch={() => {
                              prefetchCustomerMenuProductDetail(product.id, {
                                slug: orderInfo?.restaurantSlug ?? undefined,
                                subdomain: hostSubdomain ?? undefined,
                              });
                            }}
                          />
                        );
                      })}
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
      </div>

      {/* Fixed bottom checkout button for mobile view */}
      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ececf0] bg-white/95 p-3 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-md">
            {cartFooter}
          </div>
        </div>
      ) : null}

        <ProductCustomizeDialog
        open={customizeOpen}
        isLoading={customizeLoading}
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
          className={cn(
            'fixed z-40 h-11 w-11 rounded-full shadow-lg right-6 lg:right-[calc(320px+1.5rem)]',
            cart.length > 0 ? 'bottom-20 lg:bottom-6' : 'bottom-6'
          )}
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      ) : null}
    </div>
  );
}
