'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Plus,
  Search,
  Minus,
  Trash2,
  Clock,
  UtensilsCrossed,
  Table as TableIcon,
  Truck,
  ShoppingBag,
  CreditCard,
  Banknote,
  X,
  LogOut,
  PlayCircle,
  History,
  Monitor,
  Archive,
  ChefHat,
  ChefHatIcon,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PackageCheck,
  WifiOff,
} from 'lucide-react';
import { useBranchContext } from '@/hooks/use-branch-context';
import { publicQueryParam } from '@/lib/public-id';
import {
  kioskOrderApiPath,
  posOrderApiPath,
} from '@/lib/dashboard-paths';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useProgressiveRestaurantMenu } from '@/hooks/use-progressive-restaurant-menu';
import {
  ProductCardSkeletonGrid,
  CategoryPillSkeleton,
} from '@/components/menu/product-card-skeleton';
import {
  fetchPosShiftSummary,
  PosShiftSheet,
} from '@/components/pos/pos-shift-sheet';
import { PosStartShiftDialog } from '@/components/pos/pos-start-shift-dialog';
import { PosLogoutShiftDialog } from '@/components/pos/pos-logout-shift-dialog';
import {
  PosRecentOrdersSheet,
  type PosOrderDetail,
} from '@/components/pos/pos-recent-orders-sheet';
import { PosKioskOrdersSheet } from '@/components/pos/pos-kiosk-orders-sheet';
import { PosCompletedOrdersSheet } from '@/components/pos/pos-completed-orders-sheet';
import { PosTableOrdersSheet } from '@/components/pos/pos-table-orders-sheet';
import { printPosOrderReceipt } from '@/lib/pos-order-receipt-print';
import {
  PosOnScreenKeyboard,
} from '@/components/pos/pos-on-screen-keyboard';
import {
  parseRestaurantServiceCharges,
  resolveServiceChargeAmount,
  type RestaurantServiceCharges,
} from '@/lib/restaurant-service-charge';
import {
  DEFAULT_DINE_IN_PAYMENT_TIMING,
  isDineInPayBeforeKitchen,
  parseDineInPaymentTiming,
  type DineInPaymentTiming,
} from '@/lib/restaurant-dine-in-payment';
import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';
import {
  parseRestaurantFulfillmentSettings,
  type RestaurantFulfillmentSettings,
} from '@/lib/restaurant-fulfillment-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DeleteConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';
import axios from 'axios';
import eventBus from '@/lib/even';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { useKioskPendingCash, revalidateKioskPendingCash } from '@/hooks/use-kiosk-pending-cash';
import { useShiftAwareLogout } from '@/hooks/use-shift-aware-logout';
import { usePosCompletedOrders } from '@/hooks/use-pos-completed-orders';
import {
  useOpenTableOrders,
  revalidateOpenTableOrders,
  upsertOptimisticOpenTableOrder,
  markOpenTableOrderKitchenSent,
} from '@/hooks/use-open-table-orders';
import { useStaffRestaurantBranding } from '@/hooks/use-staff-permissions';
import { MenuOfferChoiceDialog } from '@/components/order/menu-offer-choice-dialog';
import {
  ProductCustomizeDialog,
  type AttributeGroup,
  type MenuOption,
  type SelectedProductVariation,
} from '@/components/order/product-customize-dialog';
import { usePosCartGuard } from '@/components/pos/pos-cart-guard-context';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { Cross2Icon } from '@radix-ui/react-icons';
import {
  cartLineDisplayName,
  cartLineTitle,
  cartModifierSelectionNames,
} from '@/lib/cart-line-display';
import { ProductLineDetails } from '@/components/orders/product-line-details';
import { buildCustomerAttributeGroup } from '@/lib/menu/build-customer-attribute-group';
import { restaurantMenuItemImageUrl } from '@/lib/menu/menu-item-image-utils';
import { getCategoryDisplayImageUrl } from '@/lib/menu/category-display-image';
import { findBundleParentProducts } from '@/lib/menu/find-bundle-parent-products';
import { productNeedsCustomizeDialog } from '@/lib/menu/personalize-options';
import {
  fetchRestaurantMenuProductDetail,
  productNeedsDetailFetch,
} from '@/lib/menu/fetch-menu-product-detail';
import {
  isOfflineLocalOrderId,
} from '@/lib/offline/outbox';
import { submitKdsTicket, submitPosOrder } from '@/lib/offline/submit-order';
import { upsertLocalTicket } from '@/lib/offline/local-tickets';
import { isBrowserOffline } from '@/lib/offline/db';
import { extractApiErrorMessage } from '@/lib/extract-api-error';

const POS_PANEL_CLASS = '';
const POS_ACCENT_BTN =
  'bg-fire-500 text-white shadow-md shadow-fire-500/20 hover:bg-fire-600 active:scale-[0.99] transition-all duration-150';
const POS_ACCENT_TEXT = 'text-fire-600 dark:text-fire-400';
const POS_INPUT_CLASS =
  'border-transparent bg-muted/50 text-foreground placeholder:text-muted-foreground/70 focus-visible:border-fire-500/40 focus-visible:bg-background focus-visible:ring-fire-500/25';
const POS_INSET_SURFACE = 'rounded-2xl bg-muted/40';
const POS_GHOST_ICON_BTN =
  'rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground';
const POS_OUTLINE_BTN =
  'border-border/40 bg-transparent text-foreground hover:bg-muted/70';
const POS_PRODUCT_CARD =
  'group relative flex flex-col overflow-hidden rounded-xl bg-white text-left text-card-foreground shadow-sm transition-all duration-150 hover:shadow-md hover:shadow-fire-500/10 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-500/40 dark:bg-zinc-900';
/** More products visible beside ticket */
const POS_PRODUCT_GRID =
  'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';
const POS_CATEGORY_ACTIVE =
  'bg-fire-500 text-white shadow-sm shadow-fire-500/20';
const POS_CATEGORY_INACTIVE =
  'bg-muted/50 text-foreground/75 hover:bg-muted hover:text-foreground';
const POS_SHELL =
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-foreground';
/** Top chrome — glass strip like the portal header */
const POS_HEADER =
  'flex shrink-0 flex-wrap items-center gap-2 border-b border-fire-500/10 bg-white/75 px-3 py-2 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-fire-500/15 dark:bg-zinc-950/80 dark:shadow-[0_8px_28px_-18px_rgba(0,0,0,0.65)] sm:gap-2.5 sm:px-4';
/** Order ticket / payment column */
const POS_TICKET_SIDEBAR =
  'flex min-h-0 max-h-[52dvh] flex-col overflow-hidden border-l border-fire-500/10 bg-white/80 backdrop-blur-xl transition-[box-shadow] duration-300 dark:border-fire-500/15 dark:bg-zinc-950/85 lg:max-h-full';

export type OrderMode = 'new' | 'tables' | 'delivery' | 'takeaway' | 'queue';

type CardPaymentStatus =
  | 'idle'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled';

type PosMenuProduct = {
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
    restaurantVariationId?: string | null;
    restaurantVariation?: { shortLabel?: string | null } | null;
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
    defaultLinkedMenuItemId?: string | null;
    useVariationPricing?: boolean;
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
        variations?: PosMenuProduct['variations'];
      }[];
    } | null;
    linkedProduct?: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      price: number;
      salePrice: number | null;
      variations?: PosMenuProduct['variations'];
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

type CartModifierSelection = {
  attributeGroupId: string;
  groupName: string;
  selections: { menuItemId: string; name: string; unitPrice: number }[];
};

type CartLine = {
  lineId: string;
  menuItemId: string;
  productName: string;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
  lineDiscPct: number;
  baseUnitPrice: number;
  variationId: string | null;
  variationName: string | null;
  variationPriceDelta: number;
  modifiers: CartModifierSelection[];
  modifiersSignature: string;
};

/** `all` shows every product; other ids match `Product.categoryId`. */
type Category = {
  id: string;
  label: string;
  imageUrl?: string | null;
  itemCount?: number;
};

type RestaurantMenuApi = {
  data?: {
    themePrimaryColor?: string | null;
    serviceCharges?: RestaurantServiceCharges;
    menus?: Array<{
      id: string;
      name: string;
      imageUrl?: string | null;
      showInFront?: boolean;
      items?: PosMenuProduct[];
    }>;
  } | null;
};

type DiningTableOption = {
  id: string;
  name: string;
  sortOrder: number;
};

type RestaurantBranding = {
  name: string;
  logoUrl: string | null;
};

type BranchOption = {
  id: string;
  name: string;
};

type PosPendingKitchenOrder = {
  id: string;
  urlId?: string;
  shortOrderId: string;
  ticketNumber: number | null;
  total: number;
  tableLabel: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string | null;
  items: { quantity: number; name: string }[];
};

type ArchivedOrder = {
  id: string;
  createdAt: string;
  orderMode: OrderMode;
  lines: CartLine[];
  subtotal: number;
  taxPct: string;
  taxAmount: number;
  discountPct: string;
  discountAmount: number;
  total: number;
};

function effectiveUnitPrice(price: number, salePrice: number | null) {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
}

function getModifiersSignature(
  mods: CartModifierSelection[],
  variationId: string | null
) {
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
  const base = line.variationId ? line.variationPriceDelta : line.baseUnitPrice;
  const modTotal = line.modifiers.reduce(
    (sum, m) => sum + m.selections.reduce((s2, sel) => s2 + sel.unitPrice, 0),
    0
  );
  return base + modTotal;
}

function posCartLineDisplayName(line: CartLine) {
  return cartLineDisplayName(
    line.productName,
    line.variationName,
    line.modifiers
  );
}

function normalizeCartLine(
  raw: Partial<CartLine> & { productId?: string; name?: string }
): CartLine {
  if (raw.lineId && raw.menuItemId && raw.productName) {
    return {
      lineId: raw.lineId,
      menuItemId: raw.menuItemId,
      productName: raw.productName,
      imageUrl: raw.imageUrl ?? null,
      unitPrice: Number(raw.unitPrice ?? 0),
      qty: Math.max(1, Number(raw.qty ?? 1)),
      lineDiscPct: Number(raw.lineDiscPct ?? 0),
      baseUnitPrice: Number(raw.baseUnitPrice ?? raw.unitPrice ?? 0),
      variationId: raw.variationId ?? null,
      variationName: raw.variationName ?? null,
      variationPriceDelta: Number(raw.variationPriceDelta ?? 0),
      modifiers: Array.isArray(raw.modifiers) ? raw.modifiers : [],
      modifiersSignature: raw.modifiersSignature ?? '',
    };
  }

  const legacyName = raw.name?.trim() || 'Item';
  const legacyId =
    raw.productId?.trim() || raw.menuItemId?.trim() || legacyName;
  return {
    lineId: raw.lineId ?? `legacy-${legacyId}-${Date.now()}`,
    menuItemId: legacyId.split('::sw:')[0] ?? legacyId,
    productName:
      legacyName.replace(/\s*\([^)]*\)\s*$/, '').trim() || legacyName,
    imageUrl: null,
    unitPrice: Number(raw.unitPrice ?? 0),
    qty: Math.max(1, Number(raw.qty ?? 1)),
    lineDiscPct: Number(raw.lineDiscPct ?? 0),
    baseUnitPrice: Number(raw.unitPrice ?? 0),
    variationId: null,
    variationName: null,
    variationPriceDelta: 0,
    modifiers: [],
    modifiersSignature: '',
  };
}

function PosCartLineSummary({
  line,
  titleClassName = 'font-medium leading-snug',
  subItemClassName = 'text-xs text-muted-foreground',
}: {
  line: CartLine;
  titleClassName?: string;
  subItemClassName?: string;
}) {
  return (
    <ProductLineDetails
      productName={line.productName}
      variationName={line.variationName}
      modifiers={line.modifiers}
      titleClassName={titleClassName}
      sectionLabelClassName="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      lineClassName={subItemClassName}
    />
  );
}

const POS_ARCHIVED_ORDERS_KEY = 'pos_archived_orders_v1';
/** Badge count for pending kiosk cash — refreshed via SSE, not polling. */

type PosScreenProps = {
  endShiftLogoutOnMount?: boolean;
  onEndShiftLogoutMountHandled?: () => void;
};

export function PosScreen({
  endShiftLogoutOnMount = false,
  onEndShiftLogoutMountHandled,
}: PosScreenProps = {}) {
  const router = useRouter();
  const { regional, formatMoney } = useOwnerRestaurantRegional();
  const { setPosCartHasItems } = usePosCartGuard();
  const {
    branches: scopedBranches,
    activeBranchId,
    activeBranchUrlId,
    isOwnerOrAdmin,
    setActiveBranch,
  } = useBranchContext();
  const {
    restaurantName,
    logoUrl: staffLogoUrl,
    themePrimaryColor: staffThemeColor,
  } = useStaffRestaurantBranding();
  const branding = useMemo(
    () => ({
      name: restaurantName || 'Restaurant',
      logoUrl: staffLogoUrl,
    }),
    [restaurantName, staffLogoUrl]
  );
  const [orderMode, setOrderMode] = useState<OrderMode>('takeaway');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [themePrimaryColor, setThemePrimaryColor] = useState<string | null>(
    null
  );
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tableId, setTableId] = useState<string>('');
  const [diningTables, setDiningTables] = useState<DiningTableOption[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [serviceCharges, setServiceCharges] =
    useState<RestaurantServiceCharges>(() =>
      parseRestaurantServiceCharges(undefined)
    );
  const [dineInPaymentTiming, setDineInPaymentTiming] =
    useState<DineInPaymentTiming>(DEFAULT_DINE_IN_PAYMENT_TIMING);

  const [srChPct, setSrChPct] = useState('0');
  const [taxPct, setTaxPct] = useState('0');
  const [disPct, setDisPct] = useState('0');

  const [paymentMode, setPaymentMode] = useState('cash');
  const [payment, setPayment] = useState('');
  const [kotNote, setKotNote] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [terminalProcessing, setTerminalProcessing] = useState(false);
  const [customizeProduct, setCustomizeProduct] =
    useState<PosMenuProduct | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeLoading, setCustomizeLoading] = useState(false);
  const customizeLoadTokenRef = useRef(0);
  const [menuOfferOpen, setMenuOfferOpen] = useState(false);
  const [menuOfferProduct, setMenuOfferProduct] =
    useState<PosMenuProduct | null>(null);
  const [menuOfferBundles, setMenuOfferBundles] = useState<PosMenuProduct[]>(
    []
  );

  const [now, setNow] = useState<Date>(() => new Date());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  type PosKeyboardField =
    | 'name'
    | 'phone'
    | 'address'
    | 'amount'
    | 'prepCustom';
  const [keyboardField, setKeyboardField] = useState<PosKeyboardField | null>(
    null
  );
  const [cardPaymentStatus, setCardPaymentStatus] =
    useState<CardPaymentStatus>('idle');
  const [cardProcessingOpen, setCardProcessingOpen] = useState(false);
  const [cardTransactionId, setCardTransactionId] = useState<
    string | undefined
  >();
  const cardPaymentCancelledRef = useRef(false);
  const cardPaymentResolvedRef = useRef(false);
  const [archivedOrdersOpen, setArchivedOrdersOpen] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState<ArchivedOrder[]>([]);
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false);
  const [startShiftDialogOpen, setStartShiftDialogOpen] = useState(false);
  const [startingShift, setStartingShift] = useState(false);
  const [logoutEndShiftFlow, setLogoutEndShiftFlow] = useState(false);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [shiftSummaryLoaded, setShiftSummaryLoaded] = useState(false);
  const startShiftPromptedRef = useRef('');
  const endShiftLogoutHandledRef = useRef(false);
  const [recentOrdersOpen, setRecentOrdersOpen] = useState(false);
  const [completedOrdersOpen, setCompletedOrdersOpen] = useState(false);
  const [kioskOrdersOpen, setKioskOrdersOpen] = useState(false);
  const [tableOrdersOpen, setTableOrdersOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const productButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const proceedOrderButtonRef = useRef<HTMLButtonElement | null>(null);
  const placeOrderButtonRef = useRef<HTMLButtonElement | null>(null);
  const cartFlyTargetRef = useRef<HTMLElement | null>(null);
  const lastFlyFromRef = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [cartBump, setCartBump] = useState(false);
  const cartBumpTimerRef = useRef<number | null>(null);
  const posBranchId = selectedBranchId || activeBranchId || null;
  const openEndShiftForLogout = useCallback(() => {
    setLogoutEndShiftFlow(true);
    setShiftSheetOpen(true);
  }, []);
  const {
    logoutChoiceOpen,
    setLogoutChoiceOpen,
    checkingShift: logoutCheckingShift,
    requestLogout: handlePosLogout,
    handleLogoutOnly,
    handleLogoutEndShift,
  } = useShiftAwareLogout({
    branchId: posBranchId,
    onEndShiftAndLogout: openEndShiftForLogout,
  });
  const { count: kioskPendingCount } = useKioskPendingCash(posBranchId);
  const { count: completedOrdersCount } = usePosCompletedOrders(posBranchId);
  const { tableCount: openTableCount } = useOpenTableOrders(posBranchId);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderUrlId, setEditingOrderUrlId] = useState<string | null>(
    null
  );
  const [editingOrderLabel, setEditingOrderLabel] = useState<string | null>(
    null
  );
  const [editingOrderSource, setEditingOrderSource] = useState<
    'pos' | 'kiosk' | null
  >(null);
  const [shiftOrderCount, setShiftOrderCount] = useState(0);
  const [lastClosingCashInLocker, setLastClosingCashInLocker] = useState<
    number | null
  >(null);
  const [cashInLocker, setCashInLocker] = useState<number | null>(null);
  const [lastShiftEndedAt, setLastShiftEndedAt] = useState<string | null>(null);
  const shiftSummaryBranchRef = useRef('');
  const shiftRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const productScrollRootRef = useRef<HTMLDivElement>(null);
  const ignoreCategorySpyUntilRef = useRef(0);
  const [scrollActiveCategoryId, setScrollActiveCategoryId] = useState('all');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const sync = () => setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      if (cartBumpTimerRef.current != null) {
        window.clearTimeout(cartBumpTimerRef.current);
      }
    };
  }, []);

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === 'left' ? -240 : 240,
      behavior: 'smooth',
    });
  };

  const scrollCategoryPillIntoView = useCallback((id: string) => {
    const strip = categoryScrollRef.current;
    if (!strip) return;
    const pill = strip.querySelector<HTMLElement>(
      `[data-pos-category-pill="${id}"]`
    );
    pill?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, []);

  const scrollProductCategoryIntoView = useCallback((id: string) => {
    const root = productScrollRootRef.current;
    const viewport = root?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (id === 'all') {
      if (viewport) viewport.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const section = root?.querySelector<HTMLElement>(
      `[data-pos-category-section="${id}"]`
    );
    if (!section || !viewport) {
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const top =
      section.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop -
      8;
    viewport.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);

  const onCategoryPillClick = useCallback(
    (id: string) => {
      if (id === 'all') {
        setCategoryId('all');
        setScrollActiveCategoryId('all');
        ignoreCategorySpyUntilRef.current = Date.now() + 600;
        scrollProductCategoryIntoView('all');
        scrollCategoryPillIntoView('all');
        return;
      }

      // While browsing all sections, jump to that category instead of filtering.
      if (categoryId === 'all' && !search.trim()) {
        setScrollActiveCategoryId(id);
        ignoreCategorySpyUntilRef.current = Date.now() + 600;
        scrollProductCategoryIntoView(id);
        scrollCategoryPillIntoView(id);
        return;
      }

      setCategoryId(id);
      setScrollActiveCategoryId(id);
      scrollCategoryPillIntoView(id);
    },
    [
      categoryId,
      search,
      scrollCategoryPillIntoView,
      scrollProductCategoryIntoView,
    ]
  );

  const KITCHEN_PREP_PRESETS = [10, 15, 30] as const;
  const KITCHEN_PREP_MIN = 1;
  const KITCHEN_PREP_MAX = 240;
  const [kitchenSendOpen, setKitchenSendOpen] = useState(false);
  const [kitchenSendOrder, setKitchenSendOrder] = useState<{
    id: string;
    shortOrderId: string;
    ticketNumber: number | null;
    items: Array<{ id: string; productName: string; quantity: number }>;
  } | null>(null);
  const [kitchenPrepMinutes, setKitchenPrepMinutes] = useState<
    Record<string, number>
  >({});
  const [kitchenCustomMinutes, setKitchenCustomMinutes] = useState('');
  const [kitchenPrepKeyboardOpen, setKitchenPrepKeyboardOpen] = useState(false);
  const [tableCheckoutPrepMinutes, setTableCheckoutPrepMinutes] = useState(15);
  const [tableCheckoutCustomMinutes, setTableCheckoutCustomMinutes] =
    useState('');
  const [sendingToKitchen, setSendingToKitchen] = useState(false);
  const [pendingKitchenOpen, setPendingKitchenOpen] = useState(false);
  const [pendingKitchenOrders, setPendingKitchenOrders] = useState<
    PosPendingKitchenOrder[]
  >([]);
  const [loadingPendingKitchen, setLoadingPendingKitchen] = useState(false);
  const [cancelKitchenOrder, setCancelKitchenOrder] =
    useState<PosPendingKitchenOrder | null>(null);
  const [cancellingKitchenOrder, setCancellingKitchenOrder] = useState(false);

  const {
    meta: menuMeta,
    categories: progressiveCategories,
    categoriesLoading,
    error: menuLoadError,
    anyCategoryLoading,
  } = useProgressiveRestaurantMenu<
    PosMenuProduct & { categoryIds?: string[] }
  >();

  const { settings: bootstrapFulfillment } = useRestaurantFulfillmentSettings();
  const [apiFulfillment, setApiFulfillment] =
    useState<RestaurantFulfillmentSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/restaurant/fulfillment-settings', {
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          data?: RestaurantFulfillmentSettings;
        };
        if (cancelled || !json.data) return;
        setApiFulfillment(parseRestaurantFulfillmentSettings(json.data));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fulfillmentSettings = useMemo((): RestaurantFulfillmentSettings => {
    if (apiFulfillment) return apiFulfillment;
    if (menuMeta?.fulfillmentSettings) {
      return parseRestaurantFulfillmentSettings(
        menuMeta.fulfillmentSettings as Partial<RestaurantFulfillmentSettings>
      );
    }
    return bootstrapFulfillment;
  }, [
    apiFulfillment,
    menuMeta?.fulfillmentSettings,
    bootstrapFulfillment,
  ]);

  const categories = useMemo<Category[]>(() => {
    const next: Category[] = [
      {
        id: 'all',
        label: 'ALL',
        itemCount: progressiveCategories.reduce(
          (n, menu) => n + (menu.items?.length ?? 0),
          0
        ),
      },
    ];
    for (const menu of progressiveCategories) {
      next.push({
        id: menu.id,
        label: String(menu.name || 'UNNAMED').toUpperCase(),
        imageUrl: getCategoryDisplayImageUrl(menu),
        itemCount: menu.items?.length ?? 0,
      });
    }
    return next;
  }, [progressiveCategories]);

  const products = useMemo<PosMenuProduct[]>(() => {
    const next: PosMenuProduct[] = [];
    for (const menu of progressiveCategories) {
      for (const item of menu.items) {
        const base = Number(item.price);
        const saleRaw = item.salePrice;
        const sale =
          saleRaw != null && Number.isFinite(Number(saleRaw))
            ? Number(saleRaw)
            : null;
        next.push({
          ...item,
          description: item.description ?? null,
          imageUrl: item.imageUrl ?? null,
          price: Number.isFinite(base) ? base : 0,
          salePrice: sale,
          categoryId: menu.id,
          attributeGroups: item.attributeGroups ?? [],
          variations: (item.variations ?? []).map((v) => ({
            ...v,
            priceDelta: Number(v.priceDelta ?? 0),
          })),
        });
      }
    }
    return next;
  }, [progressiveCategories]);

  const loadingMenu = categoriesLoading && progressiveCategories.length === 0;

  const loadPendingKitchenOrders = useCallback(async () => {
    setLoadingPendingKitchen(true);
    try {
      const branchId = selectedBranchId || activeBranchId || '';
      const branch =
        scopedBranches.find((b) => b.id === branchId) ??
        (branchId === activeBranchId
          ? { id: branchId, urlId: activeBranchUrlId }
          : null);
      const query = branchId
        ? `?${publicQueryParam('branchId', branchId, branch?.urlId)}`
        : '';
      const res = await fetch(
        `/api/restaurant/pos-order/pending-kitchen${query}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('Failed to load');
      const json = (await res.json()) as { data?: PosPendingKitchenOrder[] };
      setPendingKitchenOrders(json.data ?? []);
    } catch {
      setPendingKitchenOrders([]);
    } finally {
      setLoadingPendingKitchen(false);
    }
  }, [selectedBranchId, activeBranchId, activeBranchUrlId, scopedBranches]);

  const pendingKitchenRefreshTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const schedulePendingKitchenRefresh = useCallback(() => {
    if (pendingKitchenRefreshTimerRef.current) {
      clearTimeout(pendingKitchenRefreshTimerRef.current);
    }
    pendingKitchenRefreshTimerRef.current = setTimeout(() => {
      pendingKitchenRefreshTimerRef.current = null;
      void loadPendingKitchenOrders();
    }, 800);
  }, [loadPendingKitchenOrders]);

  useEffect(() => {
    return () => {
      if (pendingKitchenRefreshTimerRef.current) {
        clearTimeout(pendingKitchenRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!menuMeta) return;
    setThemePrimaryColor(menuMeta.themePrimaryColor?.trim() || null);
    setServiceCharges(
      (menuMeta.serviceCharges as RestaurantServiceCharges | undefined) ??
      parseRestaurantServiceCharges(undefined)
    );
    setDineInPaymentTiming(
      parseDineInPaymentTiming(menuMeta.dineInPaymentTiming)
    );
  }, [menuMeta]);

  useEffect(() => {
    if (menuLoadError) {
      toast.error('Failed to load menu products for POS.');
    }
  }, [menuLoadError]);

  useRealtimeRefresh(
    'refreshRecentOrders',
    () => {
      schedulePendingKitchenRefresh();
    }
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(POS_ARCHIVED_ORDERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ArchivedOrder[];
      if (Array.isArray(parsed)) {
        setArchivedOrders(
          parsed.map((order) => ({
            ...order,
            lines: (order.lines ?? []).map((line) =>
              normalizeCartLine(
                line as Partial<CartLine> & {
                  productId?: string;
                  name?: string;
                }
              )
            ),
          }))
        );
      }
    } catch {
      // ignore bad local cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        POS_ARCHIVED_ORDERS_KEY,
        JSON.stringify(archivedOrders)
      );
    } catch {
      // ignore write errors
    }
  }, [archivedOrders]);

  useEffect(() => {
    if (staffThemeColor?.trim()) {
      setThemePrimaryColor(staffThemeColor.trim());
    }
  }, [staffThemeColor]);

  useEffect(() => {
    const list = scopedBranches.map((b) => ({ id: b.id, name: b.name }));
    setBranches(list);
    setSelectedBranchId((prev) => prev || list[0]?.id || activeBranchId || '');
  }, [scopedBranches, activeBranchId]);

  useEffect(() => {
    if (activeBranchId) {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId]);

  useEffect(() => {
    const onBranch = (event: Event) => {
      const branchId = (event as CustomEvent<{ branchId?: string }>).detail
        ?.branchId;
      if (typeof branchId === 'string' && branchId.length > 0) {
        setSelectedBranchId(branchId);
      }
    };
    window.addEventListener('branch-changed', onBranch);
    return () => window.removeEventListener('branch-changed', onBranch);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTables() {
      setTablesLoading(true);
      try {
        const branchId = activeBranchId || '';
        const branch = scopedBranches.find((b) => b.id === branchId);
        const branchQuery = branchId
          ? `?${publicQueryParam('branchId', branchId, branch?.urlId ?? activeBranchUrlId)}`
          : '';
        const res = await fetch(`/api/restaurant/tables${branchQuery}`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('tables');
        const json = (await res.json()) as { data?: DiningTableOption[] };
        const list = Array.isArray(json?.data) ? json.data : [];
        if (!cancelled) {
          setDiningTables(list);
          setTableId((prev) =>
            prev && list.some((t) => t.id === prev) ? prev : ''
          );
        }
      } catch {
        if (!cancelled) {
          setDiningTables([]);
          setTableId('');
          toast.error('Could not load dining tables for POS.');
        }
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    }
    void loadTables();
    return () => {
      cancelled = true;
    };
  }, [activeBranchId]);

  useEffect(() => {
    setPosCartHasItems(cart.length > 0);
    return () => setPosCartHasItems(false);
  }, [cart, setPosCartHasItems]);

  useEffect(() => {
    void loadPendingKitchenOrders();
  }, [loadPendingKitchenOrders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (archivedOrders.length > 0) {
      url.searchParams.set('archived', '1');
    } else {
      url.searchParams.delete('archived');
    }
    window.history.replaceState(window.history.state, '', url.toString());
  }, [archivedOrders.length]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = products.filter((p) => {
      const inCategory = categoryId === 'all' || p.categoryId === categoryId;
      if (!inCategory) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
    if (categoryId !== 'all') return matched;
    const seen = new Set<string>();
    return matched.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [categoryId, products, search]);

  const showCategorySections =
    categoryId === 'all' && !search.trim() && !categoriesLoading;

  const activeCategoryPillId = showCategorySections
    ? scrollActiveCategoryId
    : categoryId;

  useEffect(() => {
    if (!showCategorySections) return;

    const root = productScrollRootRef.current;
    const viewport = root?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (!viewport || !root) return;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>('[data-pos-category-section]')
    );
    if (sections.length === 0) return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.posCategorySection;
          if (!id) continue;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        if (Date.now() < ignoreCategorySpyUntilRef.current) return;

        let bestId = sections[0]?.dataset.posCategorySection ?? 'all';
        let bestRatio = -1;
        for (const section of sections) {
          const id = section.dataset.posCategorySection;
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
        root: viewport,
        threshold: [0.15, 0.35, 0.55, 0.75],
        rootMargin: '-10% 0px -55% 0px',
      }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [
    showCategorySections,
    progressiveCategories,
    scrollCategoryPillIntoView,
  ]);

  const visibleProducts = useMemo(() => {
    return showCategorySections ? products : filteredProducts;
  }, [products, filteredProducts, showCategorySections]);

  useEffect(() => {
    if (!showCategorySections) return;
    setScrollActiveCategoryId((prev) =>
      prev === 'all' || progressiveCategories.some((c) => c.id === prev)
        ? prev
        : 'all'
    );
  }, [showCategorySections, progressiveCategories]);

  useEffect(() => {
    if (visibleProducts.length === 0) {
      setActiveProductId(null);
      return;
    }
    if (activeProductId == null || !visibleProducts.some((p) => p.id === activeProductId)) {
      setActiveProductId(visibleProducts[0].id);
    }
  }, [visibleProducts, activeProductId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isSearchInput = target?.matches('input[placeholder*="Search"]');
      const focusField =
        (target?.matches('input, textarea, select') || target?.isContentEditable) &&
        !isSearchInput;

      if (event.key === 'F9') {
        if (savingOrder || terminalProcessing || sendingToKitchen) return;
        if (checkoutOpen) {
          if (placeOrderButtonRef.current && !placeOrderButtonRef.current.disabled) {
            event.preventDefault();
            placeOrderButtonRef.current.click();
          }
        } else if (proceedOrderButtonRef.current && !proceedOrderButtonRef.current.disabled) {
          event.preventDefault();
          proceedOrderButtonRef.current.click();
        }
        return;
      }

      // Allow arrow key navigation in search mode
      const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
      if (isArrowKey && search.trim() && isSearchInput) {
        if (visibleProducts.length === 0) return;

        event.preventDefault();
        const currentIndex = visibleProducts.findIndex((p) => p.id === activeProductId);
        const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        const nextIndex =
          currentIndex < 0
            ? 0
            : isNext
            ? currentIndex >= visibleProducts.length - 1
              ? 0
              : currentIndex + 1
            : currentIndex <= 0
            ? visibleProducts.length - 1
            : currentIndex - 1;

        if (nextIndex !== currentIndex) {
          const nextProduct = visibleProducts[nextIndex];
          setActiveProductId(nextProduct.id);
          const nextButton = productButtonRefs.current[nextProduct.id];
          if (nextButton) {
            nextButton.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          }
        }
        return;
      }

      // Add Enter key support for search mode to select product
      if (event.key === 'Enter' && search.trim() && isSearchInput) {
        event.preventDefault();
        if (savingOrder || terminalProcessing || sendingToKitchen) return;
        if (activeProductId) {
          const product = visibleProducts.find((p) => p.id === activeProductId);
          if (product) {
            const btn = productButtonRefs.current[product.id];
            const img = btn?.querySelector('img');
            const rect = (img ?? btn)?.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
              lastFlyFromRef.current = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              };
            }
            void handleProductSelect(product);
          }
        }
        return;
      }

      if (focusField) return;
      if (!isArrowKey) {
        return;
      }
      if (visibleProducts.length === 0) return;

      event.preventDefault();
      const currentIndex = visibleProducts.findIndex((p) => p.id === activeProductId);
      const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const nextIndex =
        currentIndex < 0
          ? 0
          : isNext
          ? currentIndex >= visibleProducts.length - 1
            ? 0
            : currentIndex + 1
          : currentIndex <= 0
          ? visibleProducts.length - 1
          : currentIndex - 1;

      if (nextIndex !== currentIndex) {
        const nextProduct = visibleProducts[nextIndex];
        setActiveProductId(nextProduct.id);
        const nextButton = productButtonRefs.current[nextProduct.id];
        if (nextButton) {
          nextButton.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          nextButton.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkoutOpen, visibleProducts, activeProductId, search, savingOrder, terminalProcessing, sendingToKitchen]);

  const showProductSkeletons = useMemo(() => {
    if (search.trim()) {
      return anyCategoryLoading && filteredProducts.length === 0;
    }
    if (categoryId === 'all') {
      return (
        categoriesLoading ||
        (anyCategoryLoading && filteredProducts.length === 0)
      );
    }
    const active = progressiveCategories.find((c) => c.id === categoryId);
    return (
      Boolean(active?.loading) ||
      Boolean(active && !active.loaded && filteredProducts.length === 0)
    );
  }, [
    categoryId,
    categoriesLoading,
    progressiveCategories,
    filteredProducts.length,
    search,
    anyCategoryLoading,
  ]);

  const itemsCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  const attributeGroupsForDialog: AttributeGroup[] = useMemo(() => {
    if (!customizeProduct) return [];
    return customizeProduct.attributeGroups.map((g) =>
      buildCustomerAttributeGroup(
        g,
        customizeProduct.id,
        restaurantMenuItemImageUrl
      )
    );
  }, [customizeProduct]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, line) => {
      const gross = lineUnitTotal(line) * line.qty;
      const disc = gross * (line.lineDiscPct / 100);
      return sum + (gross - disc);
    }, 0);
  }, [cart]);

  const srPct = Number(srChPct) || 0;
  const txPct = Number(taxPct) || 0;
  const dcPct = Number(disPct) || 0;

  const srChAmount = subtotal * (srPct / 100);
  const afterSr = subtotal + srChAmount;
  const taxAmount = afterSr * (txPct / 100);
  const disAmount = subtotal * (dcPct / 100);
  const serviceChargeChannel = editingOrderSource === 'kiosk' ? 'kiosk' : 'pos';
  const activeServiceChargeAmount = resolveServiceChargeAmount(
    serviceCharges,
    serviceChargeChannel
  );
  const grandTotal = Math.max(
    0,
    afterSr + taxAmount - disAmount + activeServiceChargeAmount
  );
  const cartItemCount = useMemo(
    () => cart.reduce((n, line) => n + line.qty, 0),
    [cart]
  );
  const isEditingKioskOrder =
    Boolean(editingOrderId) && editingOrderSource === 'kiosk';

  const isTableMode = orderMode === 'tables';
  const isDeliveryMode = orderMode === 'delivery';
  /** Settings → Payments: pay when guest leaves (open tab) vs pay before kitchen. */
  const tablePayOnLeave =
    isTableMode && !isDineInPayBeforeKitchen(dineInPaymentTiming);
  const tablePayBeforeKitchen =
    isTableMode && isDineInPayBeforeKitchen(dineInPaymentTiming);
  /** Block menu/cart edits while placing or sending to kitchen. */
  const posBusy = savingOrder || terminalProcessing || sendingToKitchen;
  const posBranches = scopedBranches.length > 0 ? scopedBranches : branches;
  const selectedBranchName =
    posBranches.find((b) => b.id === selectedBranchId)?.name ??
    'No branch selected';
  const hasPendingPosData = cart.length > 0 || archivedOrders.length > 0;

  const {
    leaveOpen: posLeaveGuardOpen,
    leaveMessage: posLeaveMessage,
    requestLeave,
    confirmLeave,
    cancelLeave,
  } = useUnsavedChangesGuard(hasPendingPosData, {
    message:
      'You have unsaved POS data (cart or archived holds). If you leave now, current POS progress will be lost.',
  });

  const applyShiftSummary = useCallback(
    (summary: {
      id?: string | null;
      orderCount: number;
      lastClosingCashInLocker: number | null;
      lastShiftEndedAt: string | null;
      cashInLocker?: number | null;
    }) => {
      setActiveShiftId((prev) =>
        prev === (summary.id ?? null) ? prev : (summary.id ?? null)
      );
      setShiftOrderCount((prev) =>
        prev === summary.orderCount ? prev : summary.orderCount
      );
      setLastClosingCashInLocker((prev) =>
        prev === summary.lastClosingCashInLocker
          ? prev
          : summary.lastClosingCashInLocker
      );
      setCashInLocker((prev) =>
        prev === (summary.cashInLocker ?? null)
          ? prev
          : (summary.cashInLocker ?? null)
      );
      setLastShiftEndedAt((prev) =>
        prev === summary.lastShiftEndedAt ? prev : summary.lastShiftEndedAt
      );
    },
    []
  );

  const refreshShiftSummary = useCallback(
    async (branchId: string) => {
      try {
        const summary = await fetchPosShiftSummary(branchId);
        applyShiftSummary(summary);
      } catch {
        applyShiftSummary({
          id: null,
          orderCount: 0,
          lastClosingCashInLocker: null,
          lastShiftEndedAt: null,
          cashInLocker: null,
        });
      } finally {
        setShiftSummaryLoaded(true);
      }
    },
    [applyShiftSummary]
  );

  const hasActiveShift = Boolean(activeShiftId);

  const promptStartShift = useCallback(() => {
    setStartShiftDialogOpen(true);
  }, []);

  const requireActiveShift = useCallback((): boolean => {
    if (hasActiveShift) return true;
    toast.error('Start a new shift before creating orders.');
    promptStartShift();
    return false;
  }, [hasActiveShift, promptStartShift]);

  const handleStartShift = useCallback(async () => {
    const branchId = selectedBranchId || activeBranchId || '';
    if (!branchId) {
      toast.warn('Select a branch before starting a shift.');
      return;
    }
    setStartingShift(true);
    try {
      const res = await axios.post<{ data: { id: string; orderCount: number } }>(
        '/api/restaurant/pos-shift/start',
        { branchId }
      );
      const shift = res.data.data;
      setActiveShiftId(shift.id);
      setShiftOrderCount(shift.orderCount);
      setStartShiftDialogOpen(false);
      toast.success('Shift started.');
      void refreshShiftSummary(branchId);
    } catch (error) {
      toast.error(
        extractApiErrorMessage(error, 'Could not start shift. Please try again.')
      );
    } finally {
      setStartingShift(false);
    }
  }, [selectedBranchId, activeBranchId, refreshShiftSummary]);

  const handleShiftUpdated = useCallback(
    (shift: { id?: string; orderCount: number } | null) => {
      setActiveShiftId((prev) => {
        const id = shift?.id ?? null;
        return prev === id ? prev : id;
      });
      setShiftOrderCount((prev) => {
        const count = shift?.orderCount ?? 0;
        return prev === count ? prev : count;
      });
    },
    []
  );

  const handleShiftClosed = useCallback(
    (summary: {
      lastClosingCashInLocker: number | null;
      lastShiftEndedAt: string | null;
    }) => {
      setActiveShiftId(null);
      setLogoutEndShiftFlow(false);
      applyShiftSummary({
        id: null,
        orderCount: 0,
        ...summary,
        cashInLocker: summary.lastClosingCashInLocker,
      });
    },
    [applyShiftSummary]
  );

  useEffect(() => {
    const branchId = selectedBranchId || activeBranchId || '';
    if (!branchId) {
      setShiftOrderCount(0);
      setLastClosingCashInLocker(null);
      setLastShiftEndedAt(null);
      setCashInLocker(null);
      setActiveShiftId(null);
      setShiftSummaryLoaded(false);
      shiftSummaryBranchRef.current = '';
      startShiftPromptedRef.current = '';
      return;
    }
    if (shiftSummaryBranchRef.current === branchId) return;
    shiftSummaryBranchRef.current = branchId;
    setShiftSummaryLoaded(false);
    startShiftPromptedRef.current = '';
    void refreshShiftSummary(branchId);
  }, [selectedBranchId, activeBranchId, refreshShiftSummary]);

  useEffect(() => {
    const branchId = selectedBranchId || activeBranchId || '';
    if (!branchId || !shiftSummaryLoaded || hasActiveShift) return;
    if (endShiftLogoutOnMount) return;
    if (startShiftPromptedRef.current === branchId) return;
    startShiftPromptedRef.current = branchId;
    setStartShiftDialogOpen(true);
  }, [
    selectedBranchId,
    activeBranchId,
    shiftSummaryLoaded,
    hasActiveShift,
    endShiftLogoutOnMount,
  ]);

  useEffect(() => {
    if (!endShiftLogoutOnMount || endShiftLogoutHandledRef.current) return;
    endShiftLogoutHandledRef.current = true;
    setLogoutEndShiftFlow(true);
    setShiftSheetOpen(true);
    setStartShiftDialogOpen(false);
    onEndShiftLogoutMountHandled?.();
  }, [endShiftLogoutOnMount, onEndShiftLogoutMountHandled]);

  const refreshShiftOnRealtime = useCallback(() => {
    const branchId = selectedBranchId || activeBranchId || '';
    if (!branchId) return;
    if (shiftRealtimeTimerRef.current) {
      clearTimeout(shiftRealtimeTimerRef.current);
    }
    shiftRealtimeTimerRef.current = setTimeout(() => {
      shiftRealtimeTimerRef.current = null;
      void refreshShiftSummary(branchId);
    }, 1_200);
  }, [selectedBranchId, activeBranchId, refreshShiftSummary]);

  useRealtimeRefresh('refreshRecentOrders', refreshShiftOnRealtime, {
    runOnMount: false,
  });

  function printOrderReceipt(
    orderRef: string,
    ticketNumber?: number | null,
    receiptPayment?: { mode: string; paid: number }
  ) {
    if (typeof window === 'undefined') return;

    const receiptMode = receiptPayment?.mode ?? paymentMode;
    const paidAmount =
      receiptPayment?.paid ??
      (receiptMode === 'card_terminal'
        ? grandTotal
        : Math.max(0, Number(payment) || 0));
    const paymentMethodLabel =
      receiptMode === 'card_terminal'
        ? 'Card Terminal'
        : receiptMode === 'card'
          ? 'Card'
          : receiptMode === 'split'
            ? 'Split'
            : receiptMode.charAt(0).toUpperCase() + receiptMode.slice(1);

    const ok = printPosOrderReceipt({
      orderRef,
      ticketNumber,
      brandName: branding.name || 'Restaurant',
      branchName: selectedBranchName,
      logoUrl: branding.logoUrl,
      orderMode,
      paymentMethodLabel,
      tableLabel:
        diningTables.find((t) => t.id === tableId)?.name ?? (tableId || null),
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      address: orderAddress || null,
      note: kotNote || null,
      lines: cart.map((line) => {
        const gross = lineUnitTotal(line) * line.qty;
        const discAmt = gross * (line.lineDiscPct / 100);
        return {
          name: posCartLineDisplayName(line),
          qty: line.qty,
          lineTotal: gross - discAmt,
        };
      }),
      subtotal,
      serviceChargeAmount: activeServiceChargeAmount,
      taxAmount,
      discountAmount: disAmount,
      grandTotal,
      paidAmount,
      paymentMode: receiptMode,
      currencyCode: regional.currencyCode,
      countryCode: regional.countryCode,
    });
    if (!ok) toast.error('Could not open print preview.');
  }

  const spawnFlyToCart = useCallback(
    (product: { id: string; name: string; imageUrl: string | null }) => {
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        return;
      }
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setCartBump(true);
        if (cartBumpTimerRef.current != null) {
          window.clearTimeout(cartBumpTimerRef.current);
        }
        cartBumpTimerRef.current = window.setTimeout(() => {
          setCartBump(false);
          cartBumpTimerRef.current = null;
        }, 280);
        return;
      }

      const toEl = cartFlyTargetRef.current;
      const fromEl = productButtonRefs.current[product.id];
      const fromImg = fromEl?.querySelector('img') ?? null;

      const captured = lastFlyFromRef.current;
      lastFlyFromRef.current = null;

      const fromRect =
        captured ??
        fromImg?.getBoundingClientRect() ??
        fromEl?.getBoundingClientRect() ??
        null;
      const toRect = toEl?.getBoundingClientRect() ?? null;
      if (!toRect || toRect.width < 2 || toRect.height < 2) return;

      const size = fromRect
        ? Math.max(36, Math.min(64, Math.min(fromRect.width, fromRect.height) * 0.75))
        : 48;

      const startLeft = fromRect
        ? fromRect.left + fromRect.width / 2 - size / 2
        : Math.max(16, window.innerWidth * 0.35 - size / 2);
      const startTop = fromRect
        ? fromRect.top + fromRect.height / 2 - size / 2
        : Math.max(16, window.innerHeight * 0.4 - size / 2);

      const endLeft = toRect.left + toRect.width / 2 - size / 2;
      const endTop = toRect.top + toRect.height / 2 - size / 2;
      const dx = endLeft - startLeft;
      const dy = endTop - startTop;

      // Skip tiny moves (same spot) — still bump cart
      if (Math.hypot(dx, dy) < 24) {
        setCartBump(true);
        if (cartBumpTimerRef.current != null) {
          window.clearTimeout(cartBumpTimerRef.current);
        }
        cartBumpTimerRef.current = window.setTimeout(() => {
          setCartBump(false);
          cartBumpTimerRef.current = null;
        }, 280);
        return;
      }

      const ghost = document.createElement('div');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.className = 'pos-fly-to-cart-ghost';
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${startLeft}px`,
        top: `${startTop}px`,
        width: `${size}px`,
        height: `${size}px`,
        zIndex: '2147483000',
        borderRadius: '12px',
        overflow: 'hidden',
        pointerEvents: 'none',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        background: '#2a2a2a',
        margin: '0',
        padding: '0',
        transform: 'translate3d(0,0,0) scale(1)',
        opacity: '1',
        willChange: 'transform, opacity',
      } as CSSStyleDeclaration);

      if (product.imageUrl) {
        const img = document.createElement('img');
        img.src = product.imageUrl;
        img.alt = '';
        img.draggable = false;
        Object.assign(img.style, {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        } as CSSStyleDeclaration);
        ghost.appendChild(img);
      } else {
        ghost.style.display = 'flex';
        ghost.style.alignItems = 'center';
        ghost.style.justifyContent = 'center';
        ghost.style.fontWeight = '700';
        ghost.style.fontSize = `${Math.round(size * 0.36)}px`;
        ghost.style.color = '#f5f5f5';
        ghost.textContent = (product.name || '?').charAt(0).toUpperCase();
      }

      document.body.appendChild(ghost);

      // Force layout before animating so the first frame is painted
      void ghost.offsetWidth;

      const midX = dx * 0.45;
      const midY = dy * 0.35 - Math.min(80, Math.abs(dy) * 0.25 + 28);

      const anim = ghost.animate(
        [
          {
            transform: 'translate3d(0px, 0px, 0) scale(1)',
            opacity: 1,
          },
          {
            transform: `translate3d(${midX}px, ${midY}px, 0) scale(0.85)`,
            opacity: 1,
            offset: 0.55,
          },
          {
            transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.28)`,
            opacity: 0.2,
          },
        ],
        {
          duration: 700,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'forwards',
        }
      );

      const cleanup = () => {
        ghost.remove();
        if (cartBumpTimerRef.current != null) {
          window.clearTimeout(cartBumpTimerRef.current);
        }
        setCartBump(true);
        cartBumpTimerRef.current = window.setTimeout(() => {
          setCartBump(false);
          cartBumpTimerRef.current = null;
        }, 280);
      };

      anim.finished.then(cleanup).catch(() => {
        ghost.remove();
      });
    },
    []
  );

  const addToCart = (
    product: PosMenuProduct,
    modifiers: CartModifierSelection[],
    variation?: SelectedProductVariation | null
  ) => {
    if (savingOrder || terminalProcessing || sendingToKitchen) return;
    spawnFlyToCart({
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl ?? null,
    });

    const baseUnitPrice = effectiveUnitPrice(product.price, product.salePrice);
    const variationId = variation?.id ?? null;
    const modifiersSignature = getModifiersSignature(modifiers, variationId);
    const unitPrice = (() => {
      const base = variationId ? variation?.priceDelta ?? 0 : baseUnitPrice;
      const modTotal = modifiers.reduce(
        (sum, m) =>
          sum + m.selections.reduce((s2, sel) => s2 + sel.unitPrice, 0),
        0
      );
      return base + modTotal;
    })();

    setCart((prev) => {
      const existing = prev.find(
        (l) =>
          l.menuItemId === product.id &&
          l.modifiersSignature === modifiersSignature
      );
      if (existing) {
        return prev.map((l) =>
          l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l
        );
      }
      const line: CartLine = {
        lineId:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `l${Date.now()}`,
        menuItemId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl ?? null,

        baseUnitPrice,
        unitPrice,
        qty: 1,
        lineDiscPct: 0,
        variationId,
        variationName: variation?.name ?? null,
        variationPriceDelta: variation?.priceDelta ?? 0,
        modifiers,
        modifiersSignature,
      };
      return [...prev, line];
    });
  };

  const openCustomize = (
    p: PosMenuProduct,
    options?: { loading?: boolean }
  ) => {
    if (savingOrder || terminalProcessing || sendingToKitchen) return;
    setCustomizeProduct(p);
    setCustomizeLoading(options?.loading ?? false);
    setCustomizeOpen(true);
  };

  const resolveCatalogProduct = (ref: { id: string }) =>
    products.find((p) => p.id === ref.id) ?? null;

  const proceedWithProduct = async (p: PosMenuProduct) => {
    if (productNeedsCustomizeDialog(p)) {
      if (productNeedsDetailFetch(p)) {
        const token = ++customizeLoadTokenRef.current;
        openCustomize(p, { loading: true });
        const full = await fetchRestaurantMenuProductDetail<
          PosMenuProduct & { categoryIds?: string[] }
        >(p.id);
        if (token !== customizeLoadTokenRef.current) return;
        if (!full) {
          setCustomizeOpen(false);
          setCustomizeProduct(null);
          setCustomizeLoading(false);
          toast.error('Could not load product configuration.');
          return;
        }
        setCustomizeProduct({
          ...full,
          categoryId: p.categoryId,
          description: full.description ?? null,
          imageUrl: full.imageUrl ?? null,
          price: Number(full.price),
          salePrice:
            full.salePrice != null && Number.isFinite(Number(full.salePrice))
              ? Number(full.salePrice)
              : null,
          attributeGroups: full.attributeGroups ?? [],
          variations: (full.variations ?? []).map((v) => ({
            ...v,
            priceDelta: Number(v.priceDelta ?? 0),
          })),
        });
        setCustomizeLoading(false);
        return;
      }
      customizeLoadTokenRef.current += 1;
      openCustomize(p);
      return;
    }
    addToCart(p, []);
  };

  const handleProductSelect = (p: PosMenuProduct) => {
    if (savingOrder || terminalProcessing || sendingToKitchen) return;
    const bundles = findBundleParentProducts(p.id, products);
    if (bundles.length > 0) {
      setMenuOfferProduct(p);
      setMenuOfferBundles(bundles);
      setMenuOfferOpen(true);
      return;
    }
    proceedWithProduct(p);
  };

  function setQty(lineId: string, qty: number) {
    if (savingOrder || terminalProcessing || sendingToKitchen) return;
    if (qty < 1) {
      setCart((prev) => prev.filter((l) => l.lineId !== lineId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, qty } : l))
    );
  }

  function setLineDisc(lineId: string, pct: number) {
    if (savingOrder || terminalProcessing || sendingToKitchen) return;
    const v = Math.min(100, Math.max(0, pct));
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, lineDiscPct: v } : l))
    );
  }

  function clearCart() {
    setCart([]);
    setEditingOrderId(null);
    setEditingOrderUrlId(null);
    setEditingOrderLabel(null);
    setEditingOrderSource(null);
    setTableId('');
    setOrderMode('takeaway');
  }

  function cancelEditingOrder() {
    clearCart();
    setPayment('');
    setAmountPaid('');
    setCustomerName('');
    setCustomerPhone('');
    setOrderAddress('');
    setCheckoutOpen(false);
    toast.info('Order edit canceled.');
  }

  function loadOrderForEdit(
    detail: PosOrderDetail,
    source: 'pos' | 'kiosk' = 'pos'
  ) {
    const lines: CartLine[] = detail.items.map((item) => {
      const personalize = (item.modifiers ?? []).filter((m) => !m.menuItemId);
      const addons = (item.modifiers ?? []).filter((m) => m.menuItemId);
      const modifiers: CartModifierSelection[] = [];
      if (personalize.length > 0) {
        modifiers.push({
          attributeGroupId: 'personalize',
          groupName: 'Personalize',
          selections: personalize.map((m) => ({
            menuItemId: `personalize:${m.name}`,
            name: m.name,
            unitPrice: m.unitPrice,
          })),
        });
      }
      if (addons.length > 0) {
        modifiers.push({
          attributeGroupId: 'addons',
          groupName: 'Add-ons',
          selections: addons.map((m) => ({
            menuItemId: m.menuItemId!,
            name: m.name,
            unitPrice: m.unitPrice,
          })),
        });
      }
      return normalizeCartLine({
        lineId:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `edit-${item.id}`,
        menuItemId: item.menuItemId,
        productName: item.name,
        unitPrice: item.unitPrice,
        qty: item.quantity,
        lineDiscPct: 0,
        imageUrl: item.imageUrl,
        modifiers,
        modifiersSignature: getModifiersSignature(modifiers, null),
      });
    });
    const loadedSubtotal = lines.reduce(
      (sum, line) => sum + lineUnitTotal(line) * line.qty,
      0
    );
    setCart(lines);
    setEditingOrderId(detail.id);
    setEditingOrderUrlId(detail.urlId ?? null);
    setEditingOrderSource(source);
    const editLabel =
      detail.ticketNumber != null
        ? `#${String(detail.ticketNumber).padStart(2, '0')}`
        : detail.shortOrderId;
    setEditingOrderLabel(editLabel);
    setCustomerName(detail.customerName ?? '');
    setCustomerPhone(detail.customerPhone ?? '');
    setOrderAddress(detail.address ?? '');
    setTableId(detail.tableId ?? '');
    if (detail.tableId) setOrderMode('tables');
    else if (detail.address?.trim()) setOrderMode('delivery');
    else setOrderMode('takeaway');
    setTaxPct(
      loadedSubtotal > 0
        ? String(((detail.taxAmount / loadedSubtotal) * 100).toFixed(2))
        : '0'
    );
    setDisPct(
      loadedSubtotal > 0
        ? String(((detail.discountAmount / loadedSubtotal) * 100).toFixed(2))
        : '0'
    );
    setPaymentMode(detail.paymentMode || 'cash');
    setPayment(String(detail.paymentAmount || detail.total));
    setAmountPaid(String(detail.paymentAmount || detail.total));
    toast.success(
      source === 'kiosk'
        ? `Editing kiosk order ${editLabel}`
        : `Editing order ${editLabel}`
    );
  }

  function requestDashboard() {
    requestLeave(() => router.push('/dashboard'));
  }

  function holdCurrentOrder() {
    if (cart.length === 0) {
      toast.info('Add products to cart before holding an order.');
      return;
    }
    const archived: ArchivedOrder = {
      id: `hold-${Date.now()}`,
      createdAt: new Date().toISOString(),
      orderMode,
      lines: cart,
      subtotal,
      taxPct,
      taxAmount,
      discountPct: disPct,
      discountAmount: disAmount,
      total: grandTotal,
    };
    setArchivedOrders((prev) => [archived, ...prev]);
    clearCart();
    setCheckoutOpen(false);
    toast.success('Order archived to hold list.');
  }

  function restoreArchivedOrder(order: ArchivedOrder) {
    setCart(order.lines.map((line) => normalizeCartLine(line)));
    setOrderMode(order.orderMode);
    setTaxPct(order.taxPct || '0');
    setDisPct(order.discountPct || '0');
    setArchivedOrders((prev) => prev.filter((o) => o.id !== order.id));
    setArchivedOrdersOpen(false);
    toast.success('Archived order added to cart.');
  }

  function deleteArchivedOrder(orderId: string) {
    setArchivedOrders((prev) => prev.filter((o) => o.id !== orderId));
  }

  function resolveKitchenPrepMinutes(): number | null {
    const custom = kitchenCustomMinutes.trim();
    if (custom) {
      const n = Math.round(Number(custom));
      if (
        Number.isFinite(n) &&
        n >= KITCHEN_PREP_MIN &&
        n <= KITCHEN_PREP_MAX
      ) {
        return n;
      }
      return null;
    }
    const orderId = kitchenSendOrder?.id;
    if (!orderId) return null;
    const preset = kitchenPrepMinutes[orderId];
    if (
      preset != null &&
      preset >= KITCHEN_PREP_MIN &&
      preset <= KITCHEN_PREP_MAX
    ) {
      return preset;
    }
    return null;
  }

  function resolveTableCheckoutPrepMinutes(): number | null {
    const custom = tableCheckoutCustomMinutes.trim();
    if (custom) {
      const n = Math.round(Number(custom));
      if (
        Number.isFinite(n) &&
        n >= KITCHEN_PREP_MIN &&
        n <= KITCHEN_PREP_MAX
      ) {
        return n;
      }
      return null;
    }
    if (
      tableCheckoutPrepMinutes >= KITCHEN_PREP_MIN &&
      tableCheckoutPrepMinutes <= KITCHEN_PREP_MAX
    ) {
      return tableCheckoutPrepMinutes;
    }
    return null;
  }

  function resetKitchenSendDialog() {
    setKitchenSendOpen(false);
    setKitchenSendOrder(null);
    setKitchenCustomMinutes('');
    setKitchenPrepKeyboardOpen(false);
    setKitchenPrepMinutes({});
  }

  async function dispatchKitchenForOrder(order: {
    id: string;
    shortOrderId: string;
    ticketNumber: number | null;
    items: Array<{ id: string; productName: string; quantity: number }>;
    minutes: number;
  }): Promise<'sent' | 'queued'> {
    const linkedOutboxKey = isOfflineLocalOrderId(order.id)
      ? order.id.replace(/^offline-/, '')
      : undefined;

    if (linkedOutboxKey) {
      const { updateOrderOutbox } = await import('@/lib/offline/outbox');
      await updateOrderOutbox(linkedOutboxKey, {
        followUp: {
          kind: 'kds_ticket',
          url: '/api/restaurant/kds/tickets',
          bodyTemplate: JSON.stringify({
            orderId: '{{orderId}}',
            selectedMinutes: order.minutes,
          }),
        },
      });
      await upsertLocalTicket({
        id: `local-ticket-${order.id}`,
        orderId: order.id,
        shortOrderId: order.shortOrderId,
        ticketNumber: order.ticketNumber,
        status: 'making',
        startedAt: new Date().toISOString(),
        selectedMinutes: order.minutes,
        items: order.items,
        source: 'pos_offline',
        createdAt: Date.now(),
      });
      return 'queued';
    }

    const result = await submitKdsTicket({
      orderId: order.id,
      selectedMinutes: order.minutes,
    });

    if (result.status === 'queued') {
      await upsertLocalTicket({
        id: `local-ticket-${order.id}`,
        orderId: order.id,
        shortOrderId: order.shortOrderId,
        ticketNumber: order.ticketNumber,
        status: 'making',
        startedAt: new Date().toISOString(),
        selectedMinutes: order.minutes,
        items: order.items,
        source: 'pos_offline',
        createdAt: Date.now(),
      });
      return 'queued';
    }
    return 'sent';
  }

  async function sendOrderToKitchen() {
    if (!kitchenSendOrder) return;
    const minutes = resolveKitchenPrepMinutes();
    if (minutes === null) {
      toast.warn(
        `Select a preset or enter prep time (${KITCHEN_PREP_MIN}–${KITCHEN_PREP_MAX} minutes).`
      );
      return;
    }
    setSendingToKitchen(true);
    try {
      const status = await dispatchKitchenForOrder({
        ...kitchenSendOrder,
        minutes,
      });
      if (status === 'queued') {
        toast.success(
          `Kitchen ticket saved offline · ${minutes} min (will sync when online)`
        );
      } else {
        toast.success(`Order sent to kitchen · ${minutes} min prep`);
      }
      resetKitchenSendDialog();
      void loadPendingKitchenOrders();
      const branchId = selectedBranchId || activeBranchId || '';
      if (branchId && kitchenSendOrder) {
        markOpenTableOrderKitchenSent(branchId, kitchenSendOrder.id);
        revalidateOpenTableOrders(branchId, 1_200);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not send to kitchen.';
      toast.error(msg);
    } finally {
      setSendingToKitchen(false);
    }
  }

  async function confirmCancelPendingKitchenOrder() {
    if (!cancelKitchenOrder) return;
    setCancellingKitchenOrder(true);
    try {
      const res = await fetch(
        posOrderApiPath(
          cancelKitchenOrder.id,
          'cancel',
          cancelKitchenOrder.urlId
        ),
        { method: 'PATCH' }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || 'Could not cancel order.');
      }
      toast.success('Order canceled');
      setCancelKitchenOrder(null);
      void loadPendingKitchenOrders();
      eventBus.emit('refreshSalesOrders');
      eventBus.emit('refreshRecentOrders');
      const branchId = selectedBranchId || activeBranchId || '';
      if (branchId) void refreshShiftSummary(branchId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not cancel order.';
      toast.error(msg);
    } finally {
      setCancellingKitchenOrder(false);
    }
  }

  function openKitchenSendDialog(order: {
    id: string;
    shortOrderId: string;
    ticketNumber: number | null;
    items?: Array<{ id: string; productName: string; quantity: number }>;
  }) {
    setKitchenSendOrder({
      id: order.id,
      shortOrderId: order.shortOrderId,
      ticketNumber: order.ticketNumber,
      items: order.items ?? [],
    });
    setKitchenCustomMinutes('');
    setKitchenPrepKeyboardOpen(false);
    setKitchenPrepMinutes((prev) => ({
      ...prev,
      [order.id]: prev[order.id] ?? 15,
    }));
    setKitchenSendOpen(true);
  }

  function resetCardPayment() {
    setCardPaymentStatus('idle');
    setCardTransactionId(undefined);
    cardPaymentCancelledRef.current = false;
    cardPaymentResolvedRef.current = false;
  }

  function handleCheckoutOpenChange(open: boolean) {
    setCheckoutOpen(open);
    if (!open) {
      resetCardPayment();
      setPaymentMode('cash');
      setAmountPaid('');
      setCardProcessingOpen(false);
      setKeyboardField(null);
    }
  }

  useEffect(() => {
    if (!checkoutOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCheckoutOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [checkoutOpen]);

  function handleSelectPaymentMode(mode: 'cash' | 'card') {
    setPaymentMode(mode);
    resetCardPayment();
    setAmountPaid('');
    if (
      mode === 'cash' &&
      !isEditingKioskOrder &&
      (!isTableMode || tablePayBeforeKitchen)
    ) {
      setKeyboardField('amount');
    } else if (mode === 'card') {
      setKeyboardField(null);
    }
  }

  function finalizeCardPayment(
    result: 'success' | 'error' | 'cancelled',
    txnId?: string,
    force = false
  ) {
    if (cardPaymentResolvedRef.current && !force) return;
    cardPaymentResolvedRef.current = true;
    setCardProcessingOpen(false);
    if (result === 'success') {
      setCardPaymentStatus('success');
      if (txnId) setCardTransactionId(txnId);
      const pay = grandTotal.toFixed(2);
      setAmountPaid(pay);
      setPayment(pay);
      return;
    }
    setCardPaymentStatus(result === 'cancelled' ? 'cancelled' : 'error');
    setCardTransactionId(undefined);
    setAmountPaid('');
    setPayment('');
  }

  async function runTerminalCardCharge(): Promise<{
    ok: boolean;
    transactionId?: string;
    message?: string;
    cancelled?: boolean;
  }> {
    const terminalBase =
      process.env.NEXT_PUBLIC_POS_TERMINAL_API?.trim().replace(/\/$/, '') || '';
    if (!terminalBase) {
      return { ok: false, message: 'Terminal API not configured' };
    }
    try {
      const terminalRes = await axios.post<{
        status?: string;
        transactionId?: string;
        message?: string;
      }>(
        `${terminalBase}/charge`,
        {
          orderId: `POS-PRE-${Date.now()}`,
          amount: grandTotal,
          currency: regional.currencyCode,
        },
        { timeout: 120000 }
      );
      if (cardPaymentCancelledRef.current) {
        return { ok: false, cancelled: true };
      }
      const status = String(terminalRes.data?.status ?? '').toLowerCase();
      const transactionId = terminalRes.data?.transactionId;
      const message = String(terminalRes.data?.message ?? '');
      if (
        status === 'approved' ||
        status === 'success' ||
        status === 'completed'
      ) {
        return { ok: true, transactionId };
      }
      if (status === 'cancelled' || status === 'canceled') {
        return { ok: false, cancelled: true, message };
      }
      return { ok: false, message };
    } catch {
      if (cardPaymentCancelledRef.current) {
        return { ok: false, cancelled: true };
      }
      return { ok: false, message: 'Card terminal request failed' };
    }
  }

  function posStockCheckItems() {
    return cart.map((l) => ({
      productId: l.menuItemId,
      qty: l.qty,
      variationId: l.variationId,
      modifiers: l.modifiers,
    }));
  }

  async function assertPosIngredientsAvailable(): Promise<string | null> {
    if (cart.length === 0) return 'Add at least one product to the cart.';
    try {
      await axios.post('/api/restaurant/pos-order/check-stock', {
        branchId: selectedBranchId || activeBranchId || undefined,
        items: posStockCheckItems(),
      });
      return null;
    } catch (e) {
      return extractApiErrorMessage(e, 'Could not check ingredient stock.');
    }
  }

  async function handleCardPayClick() {
    if (cardPaymentStatus === 'success') return;
    if (!requireActiveShift()) return;
    const stockError = await assertPosIngredientsAvailable();
    if (stockError) {
      toast.error(stockError);
      return;
    }
    cardPaymentCancelledRef.current = false;
    cardPaymentResolvedRef.current = false;
    setCardProcessingOpen(true);
    setCardPaymentStatus('processing');

    const terminalBase =
      process.env.NEXT_PUBLIC_POS_TERMINAL_API?.trim().replace(/\/$/, '') || '';
    if (!terminalBase) return;

    const result = await runTerminalCardCharge();
    if (cardPaymentCancelledRef.current) return;
    if (result.ok) {
      finalizeCardPayment('success', result.transactionId);
      return;
    }
    if (result.cancelled) {
      finalizeCardPayment('cancelled');
      return;
    }
    finalizeCardPayment('error');
  }

  function handleCardPaymentBypass() {
    cardPaymentCancelledRef.current = true;
    finalizeCardPayment('success', `BYPASS-${Date.now()}`, true);
  }

  function handleCardPaymentCancel() {
    cardPaymentCancelledRef.current = true;
    finalizeCardPayment('cancelled');
  }

  const isCardPaymentComplete = cardPaymentStatus === 'success';
  const isCardMode = paymentMode === 'card';

  async function saveOrder(opts?: { paymentMode?: string; payment?: string }) {
    if (!requireActiveShift()) return;
    const effectivePaymentMode = opts?.paymentMode ?? paymentMode;
    const effectivePayment = opts?.payment ?? payment;
    const isEditingKiosk =
      Boolean(editingOrderId) && editingOrderSource === 'kiosk';
    if (cart.length === 0) {
      toast.warn('Add at least one product to the cart.');
      return;
    }
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();
    const tableTrim = tableId.trim();
    const addressTrim = orderAddress.trim();
    // Table + pay-on-leave + cash → open check: payment stays pending; kitchen is later.
    // Table + pay-before-kitchen requires completed payment at place (same as takeaway).
    const isTableOpenCheck =
      tablePayOnLeave &&
      Boolean(tableTrim) &&
      effectivePaymentMode !== 'card' &&
      effectivePaymentMode !== 'card_terminal';
    if (
      !isEditingKiosk &&
      !isTableOpenCheck &&
      !effectivePayment.trim()
    ) {
      toast.warn('Enter the payment amount before saving.');
      return;
    }
    if (
      !isEditingKiosk &&
      tablePayBeforeKitchen &&
      effectivePaymentMode !== 'card' &&
      effectivePaymentMode !== 'card_terminal' &&
      !(Number(effectivePayment) > 0)
    ) {
      toast.warn(
        'This restaurant requires payment before kitchen. Enter amount paid, or change Settings → Payments to “Pay when guest leaves”.'
      );
      return;
    }
    const tableKitchenMinutes = isTableOpenCheck
      ? resolveTableCheckoutPrepMinutes()
      : null;
    if (isTableOpenCheck && tableKitchenMinutes === null) {
      toast.warn(
        `Select a prep time (${KITCHEN_PREP_MIN}–${KITCHEN_PREP_MAX} minutes) before sending to kitchen.`
      );
      return;
    }
    if (!isEditingKiosk) {
      if (nameTrim && !phoneTrim) {
        toast.warn(
          'Enter customer phone to save customer details, or clear the name.'
        );
        return;
      }
      if (isTableMode && !tableTrim) {
        toast.warn('Select a table for table orders.');
        return;
      }
      if (isDeliveryMode && (!addressTrim || !phoneTrim)) {
        toast.warn('Delivery requires customer phone and address.');
        return;
      }
    }
    setSavingOrder(true);
    try {
      const isEditing = Boolean(editingOrderId);
      const isTerminal = effectivePaymentMode === 'card_terminal';
      // Card (or terminal after success) completes pay at place; cash table tabs stay pending.
      const resolvedPaymentStatus = isTerminal
        ? 'pending'
        : isTableOpenCheck
          ? 'pending'
          : 'completed';
      const paymentAmount = isTerminal
        ? grandTotal.toFixed(2)
        : isTableOpenCheck
          ? (effectivePayment.trim() || grandTotal.toFixed(2))
          : effectivePayment.trim();
      const orderPayload = {
        grandTotal,
        payment: paymentAmount,
        paymentMode: effectivePaymentMode,
        paymentStatus: resolvedPaymentStatus,
        address: addressTrim || undefined,
        taxAmount,
        discountAmount: disAmount,
        serviceChargeAmount: activeServiceChargeAmount,
        customerName: nameTrim || undefined,
        customerPhone: phoneTrim || undefined,
        tableId: tableTrim || undefined,
        orderMode,
        branchId: selectedBranchId || undefined,
        items: cart.map((l) => ({
          productId: l.menuItemId,
          name: posCartLineDisplayName(l),
          qty: l.qty,
          unitPrice: lineUnitTotal(l),
          lineDiscPct: l.lineDiscPct,
          variationId: l.variationId,
          modifiers: l.modifiers,
        })),
      };
      let savedOrder: {
        id?: string;
        urlId?: string;
        shortOrderId?: string;
        ticketNumber?: number | null;
      };
      if (isEditing && isEditingKiosk) {
        const patchRes = await axios.patch<{
          data: {
            id: string;
            shortOrderId: string;
            ticketNumber: number | null;
          };
        }>(
          kioskOrderApiPath(editingOrderId!, '', editingOrderUrlId),
          {
            grandTotal,
            taxAmount,
            discountAmount: disAmount,
            serviceChargeAmount: activeServiceChargeAmount,
            items: orderPayload.items,
          }
        );
        savedOrder = patchRes.data.data;
        toast.success(
          `Kiosk order updated — ${itemsCount} items · ${formatMoney(grandTotal)}`
        );
        clearCart();
        setPayment('');
        setAmountPaid('');
        setCheckoutOpen(false);
        const branchId = selectedBranchId || activeBranchId || '';
        if (branchId) revalidateKioskPendingCash(branchId);
        eventBus.emit('refreshKioskOrders');
        return;
      }
      if (isEditing) {
        const patchRes = await axios.patch<{
          data: {
            id: string;
            shortOrderId: string;
            ticketNumber: number | null;
          };
        }>(
          posOrderApiPath(editingOrderId!, '', editingOrderUrlId),
          orderPayload
        );
        savedOrder = patchRes.data.data;
      } else {
        if (effectivePaymentMode === 'card_terminal') {
          const stockError = await assertPosIngredientsAvailable();
          if (stockError) {
            toast.error(stockError);
            return;
          }
        }
        if (effectivePaymentMode === 'card_terminal' && isBrowserOffline()) {
          toast.error(
            'Card terminal payments require an internet connection.'
          );
          return;
        }
        const kitchenItems = cart.map((l) => ({
          id: l.menuItemId,
          productName: posCartLineDisplayName(l),
          quantity: l.qty,
        }));
        const createResult = await submitPosOrder(orderPayload);
        if (createResult.status === 'queued') {
          const localId = createResult.localOrderId;
          toast.success(
            `Order saved offline — will sync when online · ${itemsCount} items · ${formatMoney(grandTotal)}`
          );
          printOrderReceipt(localId.slice(0, 8).toUpperCase(), null, {
            mode: effectivePaymentMode,
            paid: Number(paymentAmount) || 0,
          });
          clearCart();
          setPayment('');
          setAmountPaid('');
          resetCardPayment();
          setPaymentMode('cash');
          setOrderAddress('');
          setCustomerName('');
          setCustomerPhone('');
          setTableId('');
          setCheckoutOpen(false);
          if (isTableOpenCheck && tableKitchenMinutes != null) {
            try {
              await dispatchKitchenForOrder({
                id: localId,
                shortOrderId: localId
                  .replace(/^offline-/, '')
                  .slice(0, 8)
                  .toUpperCase(),
                ticketNumber: null,
                items: kitchenItems,
                minutes: tableKitchenMinutes,
              });
              toast.success(
                `Table tab · kitchen ${tableKitchenMinutes} min (syncs when online)`
              );
            } catch {
              toast.info(
                'Table tab saved offline — kitchen will sync when online.'
              );
            }
            eventBus.emit('refreshTableOrders');
            if (selectedBranchId || activeBranchId) {
              revalidateOpenTableOrders(selectedBranchId || activeBranchId);
            }
            void loadPendingKitchenOrders();
          } else if (isTableOpenCheck) {
            toast.info('Table tab saved offline — send to kitchen when online.');
            eventBus.emit('refreshTableOrders');
            if (selectedBranchId || activeBranchId) {
              revalidateOpenTableOrders(selectedBranchId || activeBranchId);
            }
          } else {
            openKitchenSendDialog({
              id: localId,
              shortOrderId: localId
                .replace(/^offline-/, '')
                .slice(0, 8)
                .toUpperCase(),
              ticketNumber: null,
              items: kitchenItems,
            });
          }
          return;
        }
        savedOrder = {
          id: createResult.data.orderId,
          shortOrderId: createResult.data.shortOrderId,
          ticketNumber: createResult.data.ticketNumber,
        };
        (savedOrder as { _kitchenItems?: typeof kitchenItems })._kitchenItems =
          kitchenItems;
      }
      const dbOrderId = savedOrder.id || editingOrderId || `POS-${Date.now()}`;
      const trackingId =
        savedOrder.shortOrderId || editingOrderLabel || dbOrderId;
      const ticketNumber = savedOrder.ticketNumber ?? null;
      const kitchenItemsForDialog =
        (savedOrder as { _kitchenItems?: Array<{ id: string; productName: string; quantity: number }> })
          ._kitchenItems ??
        cart.map((l) => ({
          id: l.menuItemId,
          productName: posCartLineDisplayName(l),
          quantity: l.qty,
        }));
      if (!isEditing && isTerminal) {
        const terminalBase =
          process.env.NEXT_PUBLIC_POS_TERMINAL_API?.trim().replace(/\/$/, '') ||
          '';
        if (!terminalBase) {
          toast.error(
            'POS terminal API is not configured. Set NEXT_PUBLIC_POS_TERMINAL_API.'
          );
          return;
        }

        setTerminalProcessing(true);
        let finalStatus: 'completed' | 'failed' | 'cancelled' = 'failed';
        let terminalTransactionId: string | undefined;
        let terminalMessage = '';

        try {
          const terminalRes = await axios.post<{
            status?: string;
            transactionId?: string;
            message?: string;
          }>(
            `${terminalBase}/charge`,
            {
              orderId: dbOrderId,
              amount: grandTotal,
              currency: regional.currencyCode,
            },
            { timeout: 120000 }
          );
          const status = String(terminalRes.data?.status ?? '').toLowerCase();
          terminalTransactionId = terminalRes.data?.transactionId;
          terminalMessage = String(terminalRes.data?.message ?? '');

          if (
            status === 'approved' ||
            status === 'success' ||
            status === 'completed'
          ) {
            finalStatus = 'completed';
          } else if (status === 'cancelled' || status === 'canceled') {
            finalStatus = 'cancelled';
          } else {
            finalStatus = 'failed';
          }
        } catch {
          finalStatus = 'failed';
        } finally {
          await axios.post(
            posOrderApiPath(
              dbOrderId,
              'terminal-payment',
              savedOrder.urlId ?? editingOrderUrlId
            ),
            {
              status: finalStatus,
              amount: grandTotal,
              terminalTransactionId,
            }
          );
          setTerminalProcessing(false);
        }

        if (finalStatus !== 'completed') {
          toast.error(
            terminalMessage ||
            'Card terminal payment was not approved. Order remains pending.'
          );
          return;
        }
      }
      toast.success(
        isEditing
          ? `Order updated — ${itemsCount} items · ${formatMoney(grandTotal)}`
          : isTableOpenCheck && tableKitchenMinutes != null
            ? `Table · sent to kitchen · ${tableKitchenMinutes} min · pay when guest leaves`
            : isTableOpenCheck
              ? `Table tab opened — ${itemsCount} items · ${formatMoney(grandTotal)} · pay later`
              : `Order saved — ${itemsCount} items · ${formatMoney(grandTotal)} · ${effectivePaymentMode}`
      );
      if (!isTableOpenCheck) {
        printOrderReceipt(trackingId, ticketNumber, {
          mode: effectivePaymentMode,
          paid: Number(paymentAmount) || 0,
        });
      }

      const branchId = selectedBranchId || activeBranchId || '';
      const tableLabelForOptimistic =
        diningTables.find((t) => t.id === tableTrim)?.name ?? tableTrim;
      const optimisticTableOrder =
        isTableOpenCheck && tableTrim
          ? {
              diningTableId: tableTrim,
              tableLabel: tableLabelForOptimistic,
              order: {
                id: dbOrderId,
                shortOrderId: trackingId,
                ticketNumber,
                total: grandTotal,
                status: 'pending',
                sourceType: 'POS',
                tableLabel: tableLabelForOptimistic,
                diningTableId: tableTrim,
                createdAt: new Date().toISOString(),
                kitchenSent: false,
                kitchenStatus: null as string | null,
                customerName: nameTrim || null,
                paymentMethod: null as string | null,
                paymentStatus: 'pending',
                itemCount: itemsCount,
                items: kitchenItemsForDialog.map((i) => ({
                  quantity: i.quantity,
                  name: i.productName,
                })),
              },
            }
          : null;

      // Non-table: keep sales/inventory refresh. Table path uses optimistic cache.
      if (!isTableOpenCheck) {
        eventBus.emit('refreshSalesOrders');
        eventBus.emit('realtime:inventory.stock');
      }

      const resetAfterPlace = () => {
        clearCart();
        setPayment('');
        setAmountPaid('');
        resetCardPayment();
        setPaymentMode('cash');
        setOrderAddress('');
        setCustomerName('');
        setCustomerPhone('');
        setTableId('');
        setCheckoutOpen(false);
        setTableCheckoutPrepMinutes(15);
        setTableCheckoutCustomMinutes('');
      };

      // Table pay-on-leave: keep checkout locked until kitchen ticket is created,
      // so staff cannot add items into a half-finished place/send.
      if (!isEditing && isTableOpenCheck && tableKitchenMinutes != null) {
        if (optimisticTableOrder && branchId) {
          upsertOptimisticOpenTableOrder(branchId, optimisticTableOrder);
        }
        try {
          await dispatchKitchenForOrder({
            id: dbOrderId,
            shortOrderId: trackingId,
            ticketNumber,
            items: kitchenItemsForDialog,
            minutes: tableKitchenMinutes,
          });
          if (branchId) {
            markOpenTableOrderKitchenSent(branchId, dbOrderId);
            revalidateOpenTableOrders(branchId, 1_500);
          }
          resetAfterPlace();
        } catch (e: unknown) {
          const msg =
            e instanceof Error
              ? e.message
              : 'Order saved but kitchen send failed.';
          toast.error(msg);
          resetAfterPlace();
          openKitchenSendDialog({
            id: dbOrderId,
            shortOrderId: trackingId,
            ticketNumber,
            items: kitchenItemsForDialog,
          });
          if (branchId) revalidateOpenTableOrders(branchId, 800);
        }
        // Already in kitchen — no pending-kitchen list refresh needed.
      } else {
        if (isTableOpenCheck && optimisticTableOrder && branchId) {
          upsertOptimisticOpenTableOrder(branchId, optimisticTableOrder);
          revalidateOpenTableOrders(branchId, 1_200);
        }
        resetAfterPlace();
        if (!isEditing) {
          openKitchenSendDialog({
            id: dbOrderId,
            shortOrderId: trackingId,
            ticketNumber,
            items: kitchenItemsForDialog,
          });
          void loadPendingKitchenOrders();
        }
        if (branchId) void refreshShiftSummary(branchId);
      }
    } catch (e: unknown) {
      const ex = e as { body?: { error?: unknown } };
      const fromBody =
        typeof ex.body?.error === 'string' ? ex.body.error : null;
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const msg =
        axios.isAxiosError(e) && e.response?.data?.error
          ? String(e.response.data.error)
          : fromBody || 'Could not save POS order.';
      toast.error(msg);
      if (status === 409) {
        promptStartShift();
      }
    } finally {
      setSavingOrder(false);
    }
  }

  const modeButtons: {
    id: OrderMode;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[] = useMemo(() => {
    const all = [
      { id: 'tables' as const, label: 'Table', icon: TableIcon },
      { id: 'delivery' as const, label: 'Delivery', icon: Truck },
      { id: 'takeaway' as const, label: 'Take-away', icon: ShoppingBag },
    ];
    return all.filter((b) => {
      if (b.id === 'tables') return fulfillmentSettings.dineInEnabled;
      if (b.id === 'delivery') return fulfillmentSettings.deliveryEnabled;
      return true;
    });
  }, [fulfillmentSettings.deliveryEnabled, fulfillmentSettings.dineInEnabled]);

  useEffect(() => {
    if (orderMode === 'tables' && !fulfillmentSettings.dineInEnabled) {
      setOrderMode('takeaway');
      setTableId('');
    } else if (orderMode === 'delivery' && !fulfillmentSettings.deliveryEnabled) {
      setOrderMode('takeaway');
    }
  }, [fulfillmentSettings.deliveryEnabled, fulfillmentSettings.dineInEnabled, orderMode]);

  useEffect(() => {
    if (!fulfillmentSettings.cardPaymentsEnabled && paymentMode === 'card') {
      setPaymentMode('cash');
    }
  }, [fulfillmentSettings.cardPaymentsEnabled, paymentMode]);

  const selectedTableName =
    diningTables.find((t) => t.id === tableId)?.name ?? null;

  function selectOrderMode(mode: OrderMode) {
    setOrderMode(mode);
    if (mode !== 'tables') setTableId('');
  }

  function selectDiningTable(id: string) {
    setTableId(id);
    setOrderMode('tables');
  }

  function beginTableSelection() {
    setOrderMode('tables');
  }

  function canProceedWithOrderMode(): boolean {
    if (orderMode === 'tables' && !tableId.trim()) {
      toast.warn('Select a table before continuing.');
      return false;
    }
    return true;
  }

  const renderPosProductButton = (p: PosMenuProduct) => {
    const unit = effectiveUnitPrice(p.price, p.salePrice);
    const onSale =
      p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price;
    const isActive = activeProductId === p.id;

    return (
      <button
        key={p.id}
        type="button"
        ref={(el) => {
          productButtonRefs.current[p.id] = el;
        }}
        onClick={() => {
          const btn = productButtonRefs.current[p.id];
          const img = btn?.querySelector('img');
          const rect = (img ?? btn)?.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            lastFlyFromRef.current = {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            };
          } else {
            lastFlyFromRef.current = null;
          }
          setActiveProductId(p.id);
          void handleProductSelect(p);
        }}
        onFocus={() => setActiveProductId(p.id)}
        className={cn(
          POS_PRODUCT_CARD,
          isActive && 'bg-fire-500/8 ring-2 ring-fire-500/35'
        )}
        tabIndex={0}
      >
        <div className="relative aspect-[5/4] w-full overflow-hidden bg-muted/70">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- POS accepts external image URLs
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <UtensilsCrossed className="h-6 w-6 text-muted-foreground/35" />
            </div>
          )}
          {onSale ? (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-fire-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
              −{Math.round(((p.price - unit) / p.price) * 100)}%
            </span>
          ) : null}
          <span
            className={cn(
              'absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-colors',
              isActive
                ? 'bg-fire-500 text-white'
                : 'bg-white text-fire-600 group-hover:bg-fire-500 group-hover:text-white dark:bg-zinc-900 dark:text-fire-400'
            )}
            aria-hidden
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 px-2 py-2">
          <p className="line-clamp-2 text-left text-[11px] font-semibold leading-snug text-foreground sm:text-xs">
            {p.name}
          </p>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-sm font-bold tabular-nums', POS_ACCENT_TEXT)}>
              {formatMoney(unit)}
            </span>
            {onSale ? (
              <span className="text-[10px] tabular-nums text-muted-foreground line-through">
                {formatMoney(p.price)}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    );
  };

  const orderModeLabel =
    orderMode === 'tables'
      ? selectedTableName
        ? `Table · ${selectedTableName}`
        : 'Select a table'
      : orderMode === 'delivery'
        ? 'Delivery order'
        : orderMode === 'takeaway'
          ? 'Take-away order'
          : 'New order';

  return (
    <div className={POS_SHELL}>
      {/* Header */}
      <div className={POS_HEADER}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-2xl hover:bg-muted"
          onClick={requestDashboard}
          title="Back to dashboard"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl shadow-sm sm:h-11 sm:w-11">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- POS accepts external image URLs
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fire-500 to-fire-600 text-sm font-bold text-white">
                {(branding.name || 'R').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">
              {branding.name || 'Restaurant'}
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
              {isOwnerOrAdmin ? (
                <Select
                  value={selectedBranchId}
                  onValueChange={(value) => {
                    setSelectedBranchId(value);
                    void setActiveBranch(value);
                  }}
                >
                  <SelectTrigger className="h-7 max-w-[10rem] border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus:ring-0 sm:max-w-[12rem]">
                    <span
                      className={cn(
                        'mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                        isOnline
                          ? 'bg-emerald-400'
                          : 'bg-amber-400 animate-pulse'
                      )}
                    />
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {posBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <span
                    className={cn(
                      'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                      isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    )}
                  />
                  <span className="truncate">
                    {isOnline ? selectedBranchName : `${selectedBranchName} · Offline`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="relative order-last w-full min-w-0 flex-1 sm:order-none sm:max-w-xl lg:max-w-2xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              search.trim()
                ? '↑↓ navigate • Enter to add'
                : categoryId === 'all'
                  ? 'Search menu…'
                  : 'Search in category…'
            }
            className={cn(
              'h-10 rounded-xl border-0 bg-muted/50 pl-10 pr-3 shadow-none',
              search.trim() && 'bg-background ring-2 ring-fire-500/30',
              POS_INPUT_CLASS
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={posBusy}
            title={
              search.trim()
                ? 'Use arrow keys to navigate search results and press Enter to add to cart'
                : ''
            }
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          {cashInLocker != null ? (
            <span
              className="mr-1 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
              title="Expected cash in locker (opening float + cash sales)"
            >
              <Banknote className="h-3 w-3 shrink-0" />
              <span className="tabular-nums">{formatMoney(cashInLocker)}</span>
            </span>
          ) : null}
          {!isOnline ? (
            <span className="mr-1 inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <WifiOff className="h-3 w-3" />
              Offline
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('relative h-9 w-9', POS_GHOST_ICON_BTN)}
            title="Recent orders"
            onClick={() => setRecentOrdersOpen(true)}
          >
            <History className="h-4 w-4" />
          </Button>
          {fulfillmentSettings.deliveryEnabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('relative h-9 w-9', POS_GHOST_ICON_BTN)}
            title="Completed orders"
            onClick={() => setCompletedOrdersOpen(true)}
          >
            <PackageCheck className="h-4 w-4" />
            {completedOrdersCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                {completedOrdersCount}
              </span>
            ) : null}
          </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('relative h-9 w-9', POS_GHOST_ICON_BTN)}
            title="Kiosk orders"
            onClick={() => setKioskOrdersOpen(true)}
          >
            <Monitor className="h-4 w-4" />
            {kioskPendingCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fire-500 px-1 text-[10px] font-bold text-white">
                {kioskPendingCount}
              </span>
            ) : null}
          </Button>
          {fulfillmentSettings.dineInEnabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('relative h-9 w-9', POS_GHOST_ICON_BTN)}
            title="Table orders"
            onClick={() => setTableOrdersOpen(true)}
          >
            <UtensilsCrossed className="h-4 w-4" />
            {openTableCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fire-500 px-1 text-[10px] font-bold text-white">
                {openTableCount}
              </span>
            ) : null}
          </Button>
          ) : null}
          {(pendingKitchenOrders.length > 0) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('relative h-9 w-9', POS_GHOST_ICON_BTN)}
              title="Kitchen queue"
              onClick={() => {
                setPendingKitchenOpen(true);
                void loadPendingKitchenOrders();
              }}
            >
              <ChefHat className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {pendingKitchenOrders.length}
              </span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'relative h-9 w-9',
              hasActiveShift ? POS_GHOST_ICON_BTN : 'text-emerald-600 hover:bg-emerald-500/10'
            )}
            title={hasActiveShift ? 'End shift' : 'Start shift'}
            onClick={() => {
              if (hasActiveShift) {
                setLogoutEndShiftFlow(false);
                setShiftSheetOpen(true);
              } else {
                promptStartShift();
              }
            }}
          >
            {hasActiveShift ? (
              <LogOut className="h-4 w-4 text-destructive" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
          </Button>
          <ModeToggle />
          <UserMenu
            iconOnly
            className="h-9 w-9 rounded-xl"
            onLogout={handlePosLogout}
            logoutLoading={logoutCheckingShift}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:grid-rows-1">
        {/* Menu area */}
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden px-3 pt-2.5 sm:px-4 sm:pt-3 lg:pr-2">
          <div className="relative shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 rounded-full bg-background/90 text-foreground shadow-sm sm:flex"
              onClick={() => scrollCategories('left')}
              aria-label="Scroll categories left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 rounded-full bg-background/90 text-foreground shadow-sm sm:flex"
              onClick={() => scrollCategories('right')}
              aria-label="Scroll categories right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div
              ref={categoryScrollRef}
              className="flex gap-1.5 overflow-x-auto scroll-smooth px-0.5 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-9 [&::-webkit-scrollbar]:hidden"
            >
              {categoriesLoading && progressiveCategories.length === 0 ? (
                <>
                  <CategoryPillSkeleton className="h-10 w-24 shrink-0 rounded-full" />
                  <CategoryPillSkeleton className="h-10 w-28 shrink-0 rounded-full" />
                  <CategoryPillSkeleton className="h-10 w-24 shrink-0 rounded-full" />
                </>
              ) : (
                categories.map((c) => {
                  const isActive = activeCategoryPillId === c.id;
                  return (
                  <button
                    key={c.id}
                    type="button"
                    data-pos-category-pill={c.id}
                    className={cn(
                      'inline-flex h-10 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-left text-xs font-semibold tracking-tight transition-colors sm:max-w-[12rem]',
                      isActive ? POS_CATEGORY_ACTIVE : POS_CATEGORY_INACTIVE
                    )}
                    onClick={() => onCategoryPillClick(c.id)}
                  >
                    {c.imageUrl ? (
                      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-background/80 text-muted-foreground'
                        )}
                      >
                        {c.id === 'all' ? '★' : c.label.charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0 truncate leading-none">{c.label}</span>
                  </button>
                  );
                })
              )}
            </div>
          </div>

          <ScrollArea
            ref={productScrollRootRef}
            className={cn(
              'min-h-0 flex-1',
              posBusy && 'pointer-events-none opacity-60'
            )}
            aria-busy={posBusy}
          >
            <div className={cn(POS_PRODUCT_GRID, 'p-0.5 pb-4')}>
              {showCategorySections ? (
                progressiveCategories.map((category) => {
                  const categoryProducts = category.items.map((item) => {
                    const base = Number(item.price);
                    const saleRaw = item.salePrice;
                    const sale =
                      saleRaw != null && Number.isFinite(Number(saleRaw))
                        ? Number(saleRaw)
                        : null;
                    return {
                      ...item,
                      description: item.description ?? null,
                      imageUrl: item.imageUrl ?? null,
                      price: Number.isFinite(base) ? base : 0,
                      salePrice: sale,
                      categoryId: category.id,
                      attributeGroups: item.attributeGroups ?? [],
                      variations: (item.variations ?? []).map((v) => ({
                        ...v,
                        priceDelta: Number(v.priceDelta ?? 0),
                      })),
                    } satisfies PosMenuProduct;
                  });
                  const isCategoryLoading =
                    category.loading ||
                    (!category.loaded && category.items.length === 0);

                  if (isCategoryLoading) {
                    return (
                      <div
                        key={category.id}
                        data-pos-category-section={category.id}
                        className="col-span-full space-y-2.5"
                      >
                        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                          {category.name}
                        </p>
                        <ProductCardSkeletonGrid
                          count={6}
                          variant="pos"
                          gridClassName={POS_PRODUCT_GRID}
                        />
                      </div>
                    );
                  }

                  if (categoryProducts.length === 0) return null;

                  return (
                    <div
                      key={category.id}
                      data-pos-category-section={category.id}
                      className="col-span-full space-y-2.5"
                    >
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                        {category.name}
                      </p>
                      <div className={POS_PRODUCT_GRID}>
                        {categoryProducts.map((p) => renderPosProductButton(p))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  {filteredProducts.map((p) => renderPosProductButton(p))}
                  {showProductSkeletons ? (
                    <ProductCardSkeletonGrid
                      count={8}
                      variant="pos"
                      gridClassName="contents"
                    />
                  ) : null}
                </>
              )}
              {!showCategorySections &&
                !showProductSkeletons &&
                !loadingMenu &&
                filteredProducts.length === 0 ? (
                <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  <p>No products match this category or search.</p>
                  <Button
                    type="button"
                    className={cn('mt-4 rounded-2xl px-5', POS_ACCENT_BTN)}
                    onClick={() => setCategoryId('all')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to all products
                  </Button>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        {/* Order ticket / inline payment */}
        <div
          className={cn(
            POS_TICKET_SIDEBAR,
            checkoutOpen && 'max-h-[70dvh] bg-white/90 dark:bg-zinc-950/90',
            cartBump && 'ring-2 ring-fire-500/40'
          )}
        >
          {checkoutOpen ? (
            <div className="flex shrink-0 items-center gap-2 px-3 py-3 sm:px-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-xl"
                onClick={() => handleCheckoutOpenChange(false)}
                disabled={posBusy}
                title="Back to cart"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight">
                  {isEditingKioskOrder
                    ? 'Update kiosk order'
                    : editingOrderId
                      ? 'Update order'
                      : tablePayOnLeave
                        ? 'Confirm'
                        : 'Payment'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {tablePayOnLeave
                    ? 'Review order · send to kitchen'
                    : `${orderModeLabel} · ${formatMoney(grandTotal)}`}
                </p>
              </div>
              <span
                ref={(el) => {
                  cartFlyTargetRef.current = el;
                }}
                className="ml-auto h-3 w-3 shrink-0 rounded-full bg-fire-500/80 opacity-0"
                aria-hidden
              />
            </div>
          ) : (
            <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    'inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors duration-200',
                    cartBump && 'text-fire-600 dark:text-fire-400'
                  )}
                >
                  <span
                    ref={(el) => {
                      if (!checkoutOpen) cartFlyTargetRef.current = el;
                    }}
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition-transform duration-200',
                      cartBump
                        ? 'scale-110 bg-fire-500 text-white'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {cartItemCount}
                  </span>
                  {editingOrderId ? (
                    <span className={POS_ACCENT_TEXT}>
                      Editing {editingOrderLabel}
                    </span>
                  ) : cartItemCount > 0 ? (
                    `item${cartItemCount === 1 ? '' : 's'}`
                  ) : (
                    'New order'
                  )}
                </p>
                {editingOrderId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 rounded-lg px-2 text-xs text-muted-foreground"
                    onClick={cancelEditingOrder}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
                {fulfillmentSettings.dineInEnabled ? (
                <Select
                  value={orderMode === 'tables' && tableId ? tableId : undefined}
                  onValueChange={selectDiningTable}
                  onOpenChange={(open) => {
                    if (open) beginTableSelection();
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      'h-9 gap-1.5 border-0 shadow-none transition-all focus:ring-0',
                      '[&>span]:line-clamp-none [&>span]:inline-flex [&>span]:items-center',
                      '[&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0',
                      orderMode === 'tables'
                        ? 'w-auto min-w-0 flex-[1.6] justify-start bg-fire-500 px-2.5 text-white shadow-sm shadow-fire-500/25 [&>svg]:opacity-90 [&>svg]:text-white'
                        : 'w-9 shrink-0 justify-center bg-transparent px-0 text-muted-foreground hover:text-foreground [&>svg]:opacity-70 [&>svg:last-child]:hidden'
                    )}
                    aria-label={
                      orderMode === 'tables' && selectedTableName
                        ? selectedTableName
                        : 'Select table'
                    }
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5 overflow-hidden">
                      <TableIcon className="h-3.5 w-3.5 shrink-0" />
                      {orderMode === 'tables' ? (
                        <span className="truncate text-xs font-semibold leading-none">
                          {selectedTableName || 'Select table'}
                        </span>
                      ) : null}
                    </span>
                  </SelectTrigger>
                  <SelectContent align="start" className="max-h-64 min-w-[10rem]">
                    {tablesLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Loading tables…
                      </div>
                    ) : diningTables.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No tables available
                      </div>
                    ) : (
                      diningTables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                ) : null}

                {modeButtons
                  .filter((b) => b.id !== 'tables')
                  .map((b) => {
                    const active = orderMode === b.id;
                    const Icon = b.icon;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        title={b.label}
                        aria-label={b.label}
                        aria-pressed={active}
                        className={cn(
                          'flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all',
                          active
                            ? 'min-w-0 flex-[1.6] bg-fire-500 px-2.5 text-white shadow-sm shadow-fire-500/25'
                            : 'w-9 shrink-0 text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        )}
                        onClick={() => selectOrderMode(b.id)}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {active ? (
                          <span className="truncate">{b.label}</span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {checkoutOpen ? (
            <>
              <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 sm:px-4">
                {tablePayOnLeave ? (
                  <>
                    <div className="shrink-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Order
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-fire-500/10 px-2 py-0.5 text-[11px] font-semibold text-fire-600 dark:text-fire-400">
                          <TableIcon className="h-3 w-3" />
                          {selectedTableName || 'Select table'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {cart.map((line) => {
                          const gross = lineUnitTotal(line) * line.qty;
                          const discAmt = gross * (line.lineDiscPct / 100);
                          const lineTotal = gross - discAmt;
                          return (
                            <div
                              key={line.lineId}
                              className="flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <PosCartLineSummary
                                  line={line}
                                  titleClassName="text-sm font-medium leading-snug"
                                  subItemClassName="text-[11px] text-muted-foreground"
                                />
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {line.qty}×{' '}
                                  {formatMoney(lineUnitTotal(line))}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-semibold tabular-nums">
                                {formatMoney(lineTotal)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-baseline justify-between pt-2.5">
                        <span className="text-sm text-muted-foreground">
                          Total
                        </span>
                        <span
                          className={cn(
                            'text-xl font-bold tabular-nums',
                            POS_ACCENT_TEXT
                          )}
                        >
                          {formatMoney(grandTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Table
                      </label>
                      <Select
                        value={tableId || undefined}
                        onValueChange={selectDiningTable}
                        disabled={posBusy}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-11 rounded-xl border-0 bg-muted/50 shadow-none',
                            POS_INPUT_CLASS
                          )}
                        >
                          <SelectValue
                            placeholder={
                              tablesLoading
                                ? 'Loading tables…'
                                : diningTables.length === 0
                                  ? 'No tables available'
                                  : 'Select table'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {diningTables.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div
                      className={cn(
                        'space-y-2.5 rounded-2xl bg-gradient-to-b from-fire-500/10 to-transparent p-3 ring-1 ring-fire-500/20',
                        posBusy && 'pointer-events-none opacity-70'
                      )}
                      aria-busy={posBusy}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fire-500 text-white shadow-sm shadow-fire-500/30">
                          {posBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ChefHat className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {posBusy ? 'Sending to kitchen…' : 'Prep time'}
                          </p>
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            {posBusy
                              ? 'Please wait — prep time is locked for this ticket.'
                              : 'Shown on the kitchen display. Guest pays later from Table orders.'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {KITCHEN_PREP_PRESETS.map((m) => {
                          const selected =
                            tableCheckoutPrepMinutes === m &&
                            !tableCheckoutCustomMinutes.trim();
                          return (
                            <Button
                              key={m}
                              type="button"
                              variant={selected ? 'default' : 'outline'}
                              disabled={posBusy}
                              className={cn(
                                'h-12 rounded-xl text-sm font-semibold',
                                selected && POS_ACCENT_BTN,
                                !selected &&
                                  'border-0 bg-background/80 hover:bg-background'
                              )}
                              onClick={() => {
                                setTableCheckoutPrepMinutes(m);
                                setTableCheckoutCustomMinutes('');
                                setKeyboardField(null);
                              }}
                            >
                              {m}
                              <span className="ml-1 text-[11px] font-medium opacity-80">
                                min
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                      <Input
                        className={cn(
                          'h-11 cursor-pointer rounded-xl border-0 bg-background/80 shadow-none',
                          POS_INPUT_CLASS,
                          keyboardField === 'prepCustom' &&
                            'ring-2 ring-fire-500/40'
                        )}
                        inputMode="none"
                        autoComplete="off"
                        placeholder={`Custom (${KITCHEN_PREP_MIN}–${KITCHEN_PREP_MAX} min)`}
                        value={tableCheckoutCustomMinutes}
                        disabled={posBusy}
                        onChange={(e) =>
                          setTableCheckoutCustomMinutes(
                            e.target.value.replace(/\D/g, '')
                          )
                        }
                        onPointerDown={() => setKeyboardField('prepCustom')}
                        onFocus={() => setKeyboardField('prepCustom')}
                      />
                    </div>
                  </>
                ) : (
                  <>
                <div className="shrink-0 space-y-1.5 rounded-xl bg-background/70 p-2.5 shadow-sm">
                  {cart.map((line) => {
                    const gross = lineUnitTotal(line) * line.qty;
                    const discAmt = gross * (line.lineDiscPct / 100);
                    const lineTotal = gross - discAmt;
                    return (
                      <div
                        key={line.lineId}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <PosCartLineSummary
                            line={line}
                            titleClassName="text-xs font-semibold leading-snug"
                            subItemClassName="text-[10px] text-muted-foreground"
                          />
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {line.qty}× {formatMoney(lineUnitTotal(line))}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold tabular-nums">
                          {formatMoney(lineTotal)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold">Total</span>
                    <span
                      className={cn(
                        'text-lg font-bold tabular-nums',
                        POS_ACCENT_TEXT
                      )}
                    >
                      {formatMoney(grandTotal)}
                    </span>
                  </div>
                </div>

                {isTableMode ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Table
                    </label>
                    <Select
                      value={tableId || undefined}
                      onValueChange={selectDiningTable}
                    >
                      <SelectTrigger
                        className={cn('h-11 rounded-xl', POS_INPUT_CLASS)}
                      >
                        <SelectValue
                          placeholder={
                            tablesLoading
                              ? 'Loading tables…'
                              : diningTables.length === 0
                                ? 'No tables available'
                                : 'Select table'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {diningTables.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {orderMode !== 'tables' ? (
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Name
                      </label>
                      <Input
                        className={cn(
                          'h-11 cursor-pointer rounded-xl',
                          POS_INPUT_CLASS,
                          keyboardField === 'name' && 'ring-2 ring-fire-500/40'
                        )}
                        value={customerName}
                        inputMode="none"
                        autoComplete="off"
                        onChange={(e) => setCustomerName(e.target.value)}
                        onPointerDown={() => setKeyboardField('name')}
                        onFocus={() => setKeyboardField('name')}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Phone
                      </label>
                      <Input
                        className={cn(
                          'h-11 cursor-pointer rounded-xl',
                          POS_INPUT_CLASS,
                          keyboardField === 'phone' && 'ring-2 ring-fire-500/40'
                        )}
                        inputMode="none"
                        autoComplete="off"
                        value={customerPhone}
                        onChange={(e) =>
                          setCustomerPhone(e.target.value.replace(/\D/g, ''))
                        }
                        onPointerDown={() => setKeyboardField('phone')}
                        onFocus={() => setKeyboardField('phone')}
                      />
                    </div>
                    {isDeliveryMode ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Delivery address
                        </label>
                        <textarea
                          className={cn(
                            'flex min-h-[72px] w-full cursor-pointer rounded-xl border-0 px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-500/25',
                            POS_INPUT_CLASS,
                            keyboardField === 'address' &&
                              'ring-2 ring-fire-500/40'
                          )}
                          placeholder="Enter delivery address"
                          value={orderAddress}
                          inputMode="none"
                          autoComplete="off"
                          onChange={(e) => setOrderAddress(e.target.value)}
                          onPointerDown={() => setKeyboardField('address')}
                          onFocus={() => setKeyboardField('address')}
                          rows={3}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isEditingKioskOrder ? (
                  <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                    Cash payment stays pending until you collect payment from
                    Kiosk orders.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Payment method
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={paymentMode === 'cash' ? 'default' : 'outline'}
                          className={cn(
                            'h-11 justify-start gap-2 rounded-xl',
                            paymentMode === 'cash' && POS_ACCENT_BTN,
                            !fulfillmentSettings.cardPaymentsEnabled && 'col-span-2'
                          )}
                          onClick={() => handleSelectPaymentMode('cash')}
                        >
                          <Banknote className="h-4 w-4" />
                          Cash
                        </Button>
                        {fulfillmentSettings.cardPaymentsEnabled ? (
                        <Button
                          type="button"
                          variant={paymentMode === 'card' ? 'default' : 'outline'}
                          className={cn(
                            'h-11 justify-start gap-2 rounded-xl',
                            paymentMode === 'card' && POS_ACCENT_BTN
                          )}
                          onClick={() => handleSelectPaymentMode('card')}
                        >
                          <CreditCard className="h-4 w-4" />
                          Card
                        </Button>
                        ) : null}
                      </div>
                    </div>

                    {isCardMode ? (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          className={cn(
                            'h-11 w-full gap-2 rounded-xl',
                            cardPaymentStatus === 'success' &&
                              'bg-emerald-600 hover:bg-emerald-600/90',
                            (cardPaymentStatus === 'error' ||
                              cardPaymentStatus === 'cancelled') &&
                              'bg-destructive hover:bg-destructive/90'
                          )}
                          disabled={
                            cardPaymentStatus === 'processing' ||
                            cardPaymentStatus === 'success'
                          }
                          onClick={() => void handleCardPayClick()}
                        >
                          {cardPaymentStatus === 'success' ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Paid
                            </>
                          ) : cardPaymentStatus === 'error' ||
                            cardPaymentStatus === 'cancelled' ? (
                            <>
                              <XCircle className="h-4 w-4" />
                              Pay again
                            </>
                          ) : cardPaymentStatus === 'processing' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Processing…
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4" />
                              Pay {formatMoney(grandTotal)}
                            </>
                          )}
                        </Button>
                        <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          {isCardPaymentComplete ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Card paid — place the order.
                            </span>
                          ) : cardPaymentStatus === 'error' ||
                            cardPaymentStatus === 'cancelled' ? (
                            <span className="text-destructive">
                              {cardPaymentStatus === 'cancelled'
                                ? 'Cancelled. Tap Pay again.'
                                : 'Failed. Tap Pay again.'}
                            </span>
                          ) : (
                            <span>Complete card payment before placing.</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Amount paid
                        </label>
                        {tablePayBeforeKitchen ? (
                          <p className="text-[11px] text-muted-foreground">
                            Pay before kitchen is on — collect payment now.
                          </p>
                        ) : null}
                        <Input
                          className={cn(
                            'h-12 cursor-pointer rounded-xl text-base font-semibold tabular-nums',
                            POS_INPUT_CLASS,
                            keyboardField === 'amount' &&
                              'ring-2 ring-fire-500/40'
                          )}
                          inputMode="none"
                          autoComplete="off"
                          placeholder="0.00"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          onPointerDown={() => setKeyboardField('amount')}
                          onFocus={() => setKeyboardField('amount')}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Change</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {formatMoney(
                              Math.max(
                                0,
                                (Number(amountPaid) || 0) - grandTotal
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  </>
                )}

                {cardPaymentStatus === 'processing' || cardProcessingOpen ? (
                  <div className="rounded-xl bg-background/80 p-4 shadow-sm">
                    <div className="flex flex-col items-center gap-3 py-1">
                      <CreditCard className="h-8 w-8 animate-bounce text-fire-500" />
                      <p className="text-center text-sm text-muted-foreground">
                        Insert or tap card…
                      </p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatMoney(grandTotal)}
                      </p>
                      <div className="flex w-full flex-col gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-10 w-full rounded-xl"
                          onClick={handleCardPaymentBypass}
                        >
                          Bypass (test)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full rounded-xl"
                          onClick={handleCardPaymentCancel}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {keyboardField ? (
                <PosOnScreenKeyboard
                  mode={
                    keyboardField === 'amount'
                      ? 'numeric'
                      : keyboardField === 'phone' ||
                          keyboardField === 'prepCustom'
                        ? 'phone'
                        : 'text'
                  }
                  value={
                    keyboardField === 'name'
                      ? customerName
                      : keyboardField === 'phone'
                        ? customerPhone
                        : keyboardField === 'address'
                          ? orderAddress
                          : keyboardField === 'prepCustom'
                            ? tableCheckoutCustomMinutes
                            : amountPaid
                  }
                  maxLength={
                    keyboardField === 'phone'
                      ? 20
                      : keyboardField === 'amount'
                        ? 12
                        : keyboardField === 'prepCustom'
                          ? 3
                          : 160
                  }
                  onChange={(next) => {
                    if (keyboardField === 'name') setCustomerName(next);
                    else if (keyboardField === 'phone')
                      setCustomerPhone(next.replace(/\D/g, ''));
                    else if (keyboardField === 'address')
                      setOrderAddress(next);
                    else if (keyboardField === 'prepCustom')
                      setTableCheckoutCustomMinutes(next.replace(/\D/g, ''));
                    else setAmountPaid(next);
                  }}
                  onClose={() => setKeyboardField(null)}
                />
              ) : null}

              <div className="shrink-0 space-y-2 px-3 py-3 sm:px-4">
                <Button
                  type="button"
                  variant="outline"
                  className={cn('h-10 w-full rounded-xl', POS_OUTLINE_BTN)}
                  onClick={() => handleCheckoutOpenChange(false)}
                  disabled={
                    savingOrder ||
                    terminalProcessing ||
                    cardPaymentStatus === 'processing'
                  }
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  ref={placeOrderButtonRef}
                  type="button"
                  className={cn(
                    'flex h-12 w-full items-center justify-between rounded-xl px-4 text-base font-semibold',
                    POS_ACCENT_BTN
                  )}
                  disabled={
                    cart.length === 0 ||
                    savingOrder ||
                    terminalProcessing ||
                    cardPaymentStatus === 'processing' ||
                    (isEditingKioskOrder || tablePayOnLeave
                      ? isTableMode && !tableId.trim()
                      : isCardMode
                        ? !isCardPaymentComplete
                        : isTableMode
                          ? !tableId.trim() ||
                            (tablePayBeforeKitchen &&
                              amountPaid.trim() === '')
                          : amountPaid.trim() === '')
                  }
                  onClick={() => {
                    if (!canProceedWithOrderMode()) return;
                    if (isEditingKioskOrder) {
                      void saveOrder({
                        paymentMode: 'cash',
                        payment: grandTotal.toFixed(2),
                      });
                      return;
                    }
                    if (tablePayOnLeave) {
                      // Payment method is chosen later in Table orders when guest leaves
                      setPaymentMode('cash');
                      setPayment(grandTotal.toFixed(2));
                      void saveOrder({
                        paymentMode: 'cash',
                        payment: grandTotal.toFixed(2),
                      });
                      return;
                    }
                    const pm = isCardMode ? 'card' : 'cash';
                    const pay = isCardMode
                      ? grandTotal.toFixed(2)
                      : (Number(amountPaid) || 0).toFixed(2);
                    setPaymentMode(pm);
                    setPayment(pay);
                    void saveOrder({ paymentMode: pm, payment: pay });
                  }}
                >
                  <span className="flex items-center gap-2">
                    {savingOrder ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : tablePayOnLeave ? (
                      <ChefHat className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {editingOrderId
                      ? 'Update'
                      : tablePayOnLeave
                        ? 'Send to kitchen'
                        : 'Place order'}
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(grandTotal)}
                  </span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-2 sm:px-4">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-1 pb-2 pr-1">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-3 py-16 text-center">
                        <ShoppingBag className="mb-2 h-7 w-7 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          Tap items to add
                        </p>
                      </div>
                    ) : (
                      cart.map((line) => {
                        const gross = lineUnitTotal(line) * line.qty;
                        const discAmt = gross * (line.lineDiscPct / 100);
                        const lineTotal = gross - discAmt;
                        return (
                          <div
                            key={line.lineId}
                            className="rounded-xl px-1.5 py-2 hover:bg-muted/40"
                          >
                            <div className="flex items-start gap-2">
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {line.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={line.imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
                                    {line.productName.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <PosCartLineSummary
                                  line={line}
                                  titleClassName="text-[13px] font-semibold leading-snug"
                                  subItemClassName="text-[10px] text-muted-foreground"
                                />
                              </div>
                              <p className="shrink-0 text-sm font-bold tabular-nums">
                                {formatMoney(lineTotal)}
                              </p>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1 pl-12">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className={cn(
                                  'h-7 w-7 rounded-lg',
                                  POS_OUTLINE_BTN
                                )}
                                onClick={() =>
                                  setQty(line.lineId, line.qty - 1)
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-xs font-semibold tabular-nums">
                                {line.qty}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className={cn(
                                  'h-7 w-7 rounded-lg',
                                  POS_OUTLINE_BTN
                                )}
                                onClick={() =>
                                  setQty(line.lineId, line.qty + 1)
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="ml-auto h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  setCart((prev) =>
                                    prev.filter((l) => l.lineId !== line.lineId)
                                  )
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="shrink-0 space-y-2 px-3 py-3 sm:px-4">
                {cart.length > 0 ? (
                  <>
                    <div className="flex items-end justify-between">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => setAdjustOpen((v) => !v)}
                      >
                        Adjust
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            adjustOpen && 'rotate-180'
                          )}
                        />
                      </button>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Total
                        </p>
                        <p
                          className={cn(
                            'text-xl font-bold tabular-nums leading-none',
                            POS_ACCENT_TEXT
                          )}
                        >
                          {formatMoney(grandTotal)}
                        </p>
                      </div>
                    </div>
                    {adjustOpen ? (
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">
                            Tax %
                          </label>
                          <Input
                            className={cn(
                              'h-8 rounded-lg text-xs',
                              POS_INPUT_CLASS
                            )}
                            value={taxPct}
                            onChange={(e) => setTaxPct(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">
                            Discount %
                          </label>
                          <Input
                            className={cn(
                              'h-8 rounded-lg text-xs',
                              POS_INPUT_CLASS
                            )}
                            value={disPct}
                            onChange={(e) => setDisPct(e.target.value)}
                          />
                        </div>
                        {(taxAmount > 0 ||
                          disAmount > 0 ||
                          activeServiceChargeAmount > 0) && (
                          <div className="col-span-2 space-y-0.5 pt-1.5 text-[11px] text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span className="tabular-nums">
                                {formatMoney(subtotal)}
                              </span>
                            </div>
                            {taxAmount > 0 ? (
                              <div className="flex justify-between">
                                <span>Tax</span>
                                <span className="tabular-nums">
                                  {formatMoney(taxAmount)}
                                </span>
                              </div>
                            ) : null}
                            {disAmount > 0 ? (
                              <div className="flex justify-between">
                                <span>Discount</span>
                                <span className="tabular-nums">
                                  {formatMoney(disAmount)}
                                </span>
                              </div>
                            ) : null}
                            {activeServiceChargeAmount > 0 ? (
                              <div className="flex justify-between">
                                <span>Service</span>
                                <span className="tabular-nums">
                                  {formatMoney(activeServiceChargeAmount)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
                    disabled={
                      cart.length === 0 || savingOrder || terminalProcessing
                    }
                    title="Clear cart"
                    onClick={clearCart}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    disabled={
                      cart.length === 0 || savingOrder || terminalProcessing
                    }
                    title="Hold order"
                    onClick={holdCurrentOrder}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative h-11 w-11 shrink-0 rounded-xl"
                    title="Held orders"
                    onClick={() => setArchivedOrdersOpen(true)}
                  >
                    <Archive className="h-4 w-4" />
                    {archivedOrders.length > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fire-500 px-1 text-[10px] font-bold text-white">
                        {archivedOrders.length}
                      </span>
                    ) : null}
                  </Button>
                  <Button
                    type="button"
                    className={cn(
                      'flex h-11 min-w-0 flex-1 items-center justify-between rounded-xl px-3 text-sm font-semibold',
                      POS_ACCENT_BTN
                    )}
                    disabled={
                      cart.length === 0 || savingOrder || terminalProcessing
                    }
                    ref={proceedOrderButtonRef}
                    onClick={() => {
                      if (!canProceedWithOrderMode()) return;
                      if (!requireActiveShift()) return;
                      resetCardPayment();
                      setPaymentMode('cash');
                      setAmountPaid(
                        isEditingKioskOrder ? grandTotal.toFixed(2) : ''
                      );
                      setCheckoutOpen(true);
                      if (tablePayOnLeave) {
                        setTableCheckoutPrepMinutes(15);
                        setTableCheckoutCustomMinutes('');
                        setKeyboardField(null);
                      } else if (!isEditingKioskOrder && tablePayBeforeKitchen) {
                        setKeyboardField('amount');
                      } else if (
                        !isEditingKioskOrder &&
                        orderMode !== 'tables'
                      ) {
                        // Prefer amount keypad for cash checkout on touch POS
                        setKeyboardField('amount');
                      } else if (orderMode !== 'tables') {
                        setKeyboardField('name');
                      } else {
                        setKeyboardField(null);
                      }
                    }}
                  >
                    <span>{editingOrderId ? 'Update' : 'Checkout'}</span>
                    <span className="tabular-nums">
                      {formatMoney(grandTotal)}
                    </span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AlertDialog
        open={posLeaveGuardOpen}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave POS?</AlertDialogTitle>
            <AlertDialogDescription>{posLeaveMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              <X className="mr-2 inline h-4 w-4 align-middle" />
              Stay on POS
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                confirmLeave();
              }}
            >
              <ArrowLeft className="mr-2 inline h-4 w-4 align-middle" />
              Leave POS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet
        open={pendingKitchenOpen}
        onOpenChange={(open) => {
          setPendingKitchenOpen(open);
          if (open) void loadPendingKitchenOrders();
        }}
      >
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Not sent to kitchen</SheetTitle>
            <SheetDescription>
              Paid POS orders waiting for prep time and kitchen display
              {selectedBranchName !== 'No branch selected'
                ? ` · ${selectedBranchName}`
                : ''}
              .
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {loadingPendingKitchen ? (
              <p className="text-sm text-muted-foreground">
                <Loader2 className="animate-spin text-primary text-center mx-auto" />
              </p>
            ) : pendingKitchenOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No POS orders waiting for the kitchen.
              </p>
            ) : (
              pendingKitchenOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {order.ticketNumber != null
                          ? `Ticket #${String(order.ticketNumber).padStart(2, '0')}`
                          : order.shortOrderId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()} ·{' '}
                        {formatMoney(order.total)}
                      </p>
                      {order.tableLabel ? (
                        <p className="text-xs text-muted-foreground">
                          Table: {order.tableLabel}
                        </p>
                      ) : null}
                      {order.customerName ? (
                        <p className="text-xs text-muted-foreground">
                          {order.customerName}
                          {order.customerPhone
                            ? ` · ${order.customerPhone}`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {order.items.map((it, idx) => (
                      <li key={`${order.id}-${idx}`}>
                        {it.quantity}× {it.name}
                      </li>
                    ))}
                  </ul>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row mt-2 w-full">
                    <Button
                      className="w-full"
                      type="button"
                      onClick={() => {
                        setPendingKitchenOpen(false);
                        openKitchenSendDialog({
                          id: order.id,
                          shortOrderId: order.shortOrderId,
                          ticketNumber: order.ticketNumber,
                        });
                      }}
                    >
                      <ChefHatIcon className="h-4 w-4 mr-2" />
                      Send to kitchen
                    </Button>
                    <Button
                      className="w-full"
                      type="button"
                      variant="destructive"
                      onClick={() => setCancelKitchenOrder(order)}
                    >
                      <Cross2Icon className="h-4 w-4 mr-2" />
                      Cancel order
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3 shrink-0"
            disabled={loadingPendingKitchen}
            onClick={() => void loadPendingKitchenOrders()}
          >
            Refresh list
          </Button>
        </SheetContent>
      </Sheet>

      <DeleteConfirmation
        open={cancelKitchenOrder != null}
        title="Cancel order?"
        description="This paid POS order has not been sent to the kitchen. Canceling marks it as canceled and removes it from this list."
        itemName={
          cancelKitchenOrder
            ? cancelKitchenOrder.ticketNumber != null
              ? `Ticket #${String(cancelKitchenOrder.ticketNumber).padStart(2, '0')}`
              : cancelKitchenOrder.shortOrderId
            : undefined
        }
        loading={cancellingKitchenOrder}
        confirmText="Cancel order"
        cancelText="Keep order"
        onConfirm={() => void confirmCancelPendingKitchenOrder()}
        onCancel={() => setCancelKitchenOrder(null)}
      />

      <Sheet open={archivedOrdersOpen} onOpenChange={setArchivedOrdersOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Archived orders</SheetTitle>
            <SheetDescription>
              Held orders can be restored into the POS cart.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {archivedOrders.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                No archived orders yet.
              </div>
            ) : (
              <ScrollArea className="h-[70vh] pr-2">
                <div className="space-y-3">
                  {archivedOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {order.orderMode.toUpperCase()} -{' '}
                            {new Date(order.createdAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.lines.reduce(
                              (sum, line) => sum + line.qty,
                              0
                            )}{' '}
                            items
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatMoney(order.total)}
                        </p>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {order.lines.map((line) => (
                          <div
                            key={`${order.id}-${line.lineId}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="min-w-0">
                              <span className="block truncate">
                                {line.qty}x{' '}
                                {'productName' in line
                                  ? cartLineTitle(
                                    (line as CartLine).productName,
                                    (line as CartLine).variationName
                                  )
                                  : (line as { name?: string }).name}
                              </span>
                              {'modifiers' in line &&
                                Array.isArray((line as CartLine).modifiers) ? (
                                <span className="mt-0.5 block space-y-0.5">
                                  {cartModifierSelectionNames(
                                    (line as CartLine).modifiers
                                  ).map((name, index) => (
                                    <span
                                      key={`${order.id}-${line.lineId}-sel-${index}`}
                                      className="block truncate text-[10px] text-muted-foreground"
                                    >
                                      - {name}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                            <span className="tabular-nums">
                              {formatMoney(line.unitPrice * line.qty)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          onClick={() => restoreArchivedOrder(order)}
                        >
                          Add to cart
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => deleteArchivedOrder(order.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={kitchenSendOpen}
        onOpenChange={() => {
          /* Close only via Cancel / Proceed — not backdrop or Escape */
        }}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Send to kitchen</DialogTitle>
          </DialogHeader>
          {kitchenSendOrder ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Payment recorded. Choose prep time to show this order on the
                kitchen display (not the KDS manager queue).
              </p>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">
                  Order{' '}
                  {kitchenSendOrder.ticketNumber != null
                    ? `#${String(kitchenSendOrder.ticketNumber).padStart(2, '0')}`
                    : kitchenSendOrder.shortOrderId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tracking: {kitchenSendOrder.shortOrderId}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Prep time (minutes)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {KITCHEN_PREP_PRESETS.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      disabled={sendingToKitchen}
                      variant={
                        kitchenPrepMinutes[kitchenSendOrder.id] === m &&
                          !kitchenCustomMinutes.trim()
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => {
                        setKitchenPrepMinutes((prev) => ({
                          ...prev,
                          [kitchenSendOrder.id]: m,
                        }));
                        setKitchenCustomMinutes('');
                        setKitchenPrepKeyboardOpen(false);
                      }}
                    >
                      {m} min
                    </Button>
                  ))}
                </div>
                <Input
                  className="cursor-pointer"
                  inputMode="none"
                  autoComplete="off"
                  placeholder={`Custom (${KITCHEN_PREP_MIN}–${KITCHEN_PREP_MAX})`}
                  value={kitchenCustomMinutes}
                  disabled={sendingToKitchen}
                  onChange={(e) =>
                    setKitchenCustomMinutes(e.target.value.replace(/\D/g, ''))
                  }
                  onPointerDown={() => setKitchenPrepKeyboardOpen(true)}
                  onFocus={() => setKitchenPrepKeyboardOpen(true)}
                />
                {kitchenPrepKeyboardOpen ? (
                  <PosOnScreenKeyboard
                    portal={false}
                    mode="phone"
                    value={kitchenCustomMinutes}
                    maxLength={3}
                    onChange={(next) =>
                      setKitchenCustomMinutes(next.replace(/\D/g, ''))
                    }
                    onClose={() => setKitchenPrepKeyboardOpen(false)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={sendingToKitchen}
              onClick={() => resetKitchenSendDialog()}
            >
              <>
                <X className="mr-2 h-4 w-4" /> <span>Cancel</span>
              </>
            </Button>
            <Button
              type="button"
              disabled={sendingToKitchen || !kitchenSendOrder}
              onClick={() => void sendOrderToKitchen()}
            >
              {sendingToKitchen ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />{' '}
                  <span>Proceed to kitchen</span>
                </>
              )}
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

      <ProductCustomizeDialog
        productName={customizeProduct?.name ?? ''}
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
          restaurantVariationId: v.restaurantVariationId ?? null,
          variationShortLabel: v.restaurantVariation?.shortLabel ?? null,
        }))}
        open={customizeOpen}
        isLoading={customizeLoading}
        onOpenChange={(open) => {
          setCustomizeOpen(open);
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
            selections: m.selections.map((s: MenuOption) => ({
              menuItemId: s.menuItemId,
              name: s.name,
              unitPrice: s.unitPrice,
            })),
          }));
          const times = Math.max(1, Math.floor(quantity));
          for (let i = 0; i < times; i += 1) {
            addToCart(customizeProduct, mapped, variation ?? null);
          }
          setCustomizeOpen(false);
          setCustomizeProduct(null);
          setCustomizeLoading(false);
        }}
      />

      <PosRecentOrdersSheet
        open={recentOrdersOpen}
        onOpenChange={setRecentOrdersOpen}
        branchId={selectedBranchId || activeBranchId || null}
        brandName={branding.name || 'Restaurant'}
        branchName={selectedBranchName}
        logoUrl={branding.logoUrl}
        onEditOrder={(order) => loadOrderForEdit(order, 'pos')}
      />

      <PosCompletedOrdersSheet
        open={completedOrdersOpen}
        onOpenChange={setCompletedOrdersOpen}
        branchId={selectedBranchId || activeBranchId || null}
        brandName={branding.name || 'Restaurant'}
        branchName={selectedBranchName}
        logoUrl={branding.logoUrl}
      />

      <PosKioskOrdersSheet
        open={kioskOrdersOpen}
        onOpenChange={setKioskOrdersOpen}
        branchId={selectedBranchId || activeBranchId || null}
        brandName={branding.name || 'Restaurant'}
        branchName={selectedBranchName}
        logoUrl={branding.logoUrl}
        onEditOrder={(order) => loadOrderForEdit(order, 'kiosk')}
        onOrdersChanged={() => {
          eventBus.emit('refreshRecentOrders');
          const branchId = selectedBranchId || activeBranchId || '';
          if (branchId) {
            void refreshShiftSummary(branchId);
          }
        }}
      />

      <PosTableOrdersSheet
        open={tableOrdersOpen}
        onOpenChange={setTableOrdersOpen}
        branchId={selectedBranchId || activeBranchId || null}
        onOrdersChanged={() => {
          // Soft sync only — sheet already updated SWR optimistically.
          const branchId = selectedBranchId || activeBranchId || '';
          if (branchId) revalidateOpenTableOrders(branchId, 1_500);
        }}
      />

      <PosShiftSheet
        open={shiftSheetOpen}
        onOpenChange={(open) => {
          setShiftSheetOpen(open);
          if (!open) setLogoutEndShiftFlow(false);
        }}
        branchId={selectedBranchId || activeBranchId || null}
        brandName={branding.name || 'Restaurant'}
        branchName={selectedBranchName}
        logoUrl={branding.logoUrl}
        isOwnerOrAdmin={isOwnerOrAdmin}
        logoutAfterEnd={logoutEndShiftFlow}
        onShiftUpdated={handleShiftUpdated}
        onShiftClosed={handleShiftClosed}
      />

      <PosStartShiftDialog
        open={startShiftDialogOpen}
        loading={startingShift}
        branchName={selectedBranchName}
        onStart={() => void handleStartShift()}
        onDismiss={() => setStartShiftDialogOpen(false)}
      />

      <PosLogoutShiftDialog
        open={logoutChoiceOpen}
        onOpenChange={setLogoutChoiceOpen}
        onLogoutOnly={handleLogoutOnly}
        onEndShiftAndLogout={handleLogoutEndShift}
      />
    </div>
  );
}
