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
  ArrowRight,
  CreditCard,
  Banknote,
  X,
  LogOut,
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
} from 'lucide-react';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useProgressiveRestaurantMenu } from '@/hooks/use-progressive-restaurant-menu';
import {
  ProductCardSkeletonGrid,
  CategoryPillSkeleton,
} from '@/components/menu/product-card-skeleton';
import {
  fetchPosShiftSummary,
  PosShiftSheet,
} from '@/components/pos/pos-shift-sheet';
import {
  PosRecentOrdersSheet,
  type PosOrderDetail,
} from '@/components/pos/pos-recent-orders-sheet';
import { PosKioskOrdersSheet } from '@/components/pos/pos-kiosk-orders-sheet';
import { printPosOrderReceipt } from '@/lib/pos-order-receipt-print';
import {
  parseRestaurantServiceCharges,
  resolveServiceChargeAmount,
  type RestaurantServiceCharges,
} from '@/lib/restaurant-service-charge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';
import axios from 'axios';
import eventBus from '@/lib/even';
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
  cartLineTitle,
  cartModifierSelectionNames,
  cartPersonalizeSelectionNames,
} from '@/lib/cart-line-display';
import { buildCustomerAttributeGroup } from '@/lib/menu/build-customer-attribute-group';
import { getCategoryDisplayImageUrl } from '@/lib/menu/category-display-image';
import { findBundleParentProducts } from '@/lib/menu/find-bundle-parent-products';
import { productNeedsCustomizeDialog } from '@/lib/menu/personalize-options';

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

function formatMoney(n: number) {
  return n.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  const base = cartLineTitle(line.productName, line.variationName);
  const addonNames = cartModifierSelectionNames(line.modifiers);
  if (!addonNames.length) return base;
  return `${base} (${addonNames.join(', ')})`;
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
  const personalizeNames = cartPersonalizeSelectionNames(line.modifiers);
  const addonNames = cartModifierSelectionNames(line.modifiers);
  return (
    <>
      <p className={titleClassName}>
        {cartLineTitle(line.productName, line.variationName)}
      </p>
      {personalizeNames.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {personalizeNames.map((name, index) => (
            <p
              key={`${line.lineId}-personalize-${index}`}
              className="text-xs font-medium text-foreground/90"
            >
              {name}
            </p>
          ))}
        </div>
      ) : null}
      {addonNames.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {addonNames.map((name, index) => (
            <p key={`${line.lineId}-sel-${index}`} className={subItemClassName}>
              - {name}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

const POS_ARCHIVED_ORDERS_KEY = 'pos_archived_orders_v1';
/** Poll pending kiosk cash orders (picks up DB trigger / external updates). */
const KIOSK_PENDING_POLL_MS = 5000;

export function PosScreen() {
  const router = useRouter();
  const { setPosCartHasItems } = usePosCartGuard();
  const {
    branches: scopedBranches,
    activeBranchId,
    isOwnerOrAdmin,
    setActiveBranch,
  } = useBranchContext();
  const [orderMode, setOrderMode] = useState<OrderMode>('tables');
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
  const [branding, setBranding] = useState<RestaurantBranding>({
    name: 'Restaurant',
    logoUrl: null,
  });
  const [serviceCharges, setServiceCharges] =
    useState<RestaurantServiceCharges>(() =>
      parseRestaurantServiceCharges(undefined)
    );

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
  const [menuOfferOpen, setMenuOfferOpen] = useState(false);
  const [menuOfferProduct, setMenuOfferProduct] =
    useState<PosMenuProduct | null>(null);
  const [menuOfferBundles, setMenuOfferBundles] = useState<PosMenuProduct[]>(
    []
  );

  const [now, setNow] = useState<Date>(() => new Date());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [cardPaymentStatus, setCardPaymentStatus] =
    useState<CardPaymentStatus>('idle');
  const [cardProcessingOpen, setCardProcessingOpen] = useState(false);
  const [cardPaymentOutcomeOpen, setCardPaymentOutcomeOpen] = useState<
    'success' | 'error' | null
  >(null);
  const [cardTransactionId, setCardTransactionId] = useState<
    string | undefined
  >();
  const cardPaymentCancelledRef = useRef(false);
  const cardPaymentResolvedRef = useRef(false);
  const [archivedOrdersOpen, setArchivedOrdersOpen] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState<ArchivedOrder[]>([]);
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false);
  const [recentOrdersOpen, setRecentOrdersOpen] = useState(false);
  const [kioskOrdersOpen, setKioskOrdersOpen] = useState(false);
  const [kioskPendingCount, setKioskPendingCount] = useState(0);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
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
  const [lastShiftEndedAt, setLastShiftEndedAt] = useState<string | null>(null);
  const shiftSummaryBranchRef = useRef('');

  const KITCHEN_PREP_PRESETS = [10, 15, 30] as const;
  const KITCHEN_PREP_MIN = 1;
  const KITCHEN_PREP_MAX = 240;
  const [kitchenSendOpen, setKitchenSendOpen] = useState(false);
  const [kitchenSendOrder, setKitchenSendOrder] = useState<{
    id: string;
    shortOrderId: string;
    ticketNumber: number | null;
  } | null>(null);
  const [kitchenPrepMinutes, setKitchenPrepMinutes] = useState<
    Record<string, number>
  >({});
  const [kitchenCustomMinutes, setKitchenCustomMinutes] = useState('');
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

  const categories = useMemo<Category[]>(() => {
    const next: Category[] = [{ id: 'all', label: 'ALL' }];
    for (const menu of progressiveCategories) {
      next.push({
        id: menu.id,
        label: String(menu.name || 'UNNAMED').toUpperCase(),
        imageUrl: getCategoryDisplayImageUrl(menu),
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
      const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
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
  }, [selectedBranchId, activeBranchId]);

  useEffect(() => {
    if (!menuMeta) return;
    setThemePrimaryColor(menuMeta.themePrimaryColor?.trim() || null);
    setServiceCharges(
      (menuMeta.serviceCharges as RestaurantServiceCharges | undefined) ??
        parseRestaurantServiceCharges(undefined)
    );
  }, [menuMeta]);

  useEffect(() => {
    if (menuLoadError) {
      toast.error('Failed to load menu products for POS.');
    }
  }, [menuLoadError]);

  useEffect(() => {
    void loadPendingKitchenOrders();
  }, [loadPendingKitchenOrders]);

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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/restaurant', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: {
            name?: string | null;
            logoUrl?: string | null;
            themePrimaryColor?: string | null;
          } | null;
        };
        const data = json?.data;
        if (cancelled || !data) return;
        setBranding({
          name: (data.name?.trim() || 'Restaurant') as string,
          logoUrl: data.logoUrl ?? null,
        });
        if (data.themePrimaryColor?.trim()) {
          setThemePrimaryColor(data.themePrimaryColor.trim());
        }
      } catch {
        // ignore branding fetch errors for printing fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/restaurant/branches', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('branches');
        const json = (await res.json()) as { data?: BranchOption[] };
        const list = Array.isArray(json?.data) ? json.data : [];
        if (cancelled) return;
        setBranches(list);
        setSelectedBranchId((prev) => prev || list[0]?.id || '');
      } catch {
        if (!cancelled) {
          setBranches([]);
          setSelectedBranchId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        const branchQuery = activeBranchId
          ? `?branchId=${encodeURIComponent(activeBranchId)}`
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

  const showCategorySections =
    categoryId === 'all' && !search.trim() && !categoriesLoading;

  const itemsCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  const attributeGroupsForDialog: AttributeGroup[] = useMemo(() => {
    if (!customizeProduct) return [];
    return customizeProduct.attributeGroups.map((g) =>
      buildCustomerAttributeGroup(g, customizeProduct.id)
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
  const isEditingKioskOrder =
    Boolean(editingOrderId) && editingOrderSource === 'kiosk';

  const isTableMode = orderMode === 'tables';
  const isDeliveryMode = orderMode === 'delivery';
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
      orderCount: number;
      lastClosingCashInLocker: number | null;
      lastShiftEndedAt: string | null;
    }) => {
      setShiftOrderCount((prev) =>
        prev === summary.orderCount ? prev : summary.orderCount
      );
      setLastClosingCashInLocker((prev) =>
        prev === summary.lastClosingCashInLocker
          ? prev
          : summary.lastClosingCashInLocker
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
          orderCount: 0,
          lastClosingCashInLocker: null,
          lastShiftEndedAt: null,
        });
      }
    },
    [applyShiftSummary]
  );

  const refreshKioskPendingCount = useCallback(async (branchId: string) => {
    try {
      const res = await axios.get<{ count?: number }>(
        '/api/restaurant/kiosk-order/pending-cash',
        { params: { branchId, count: '1' } }
      );
      const count = res.data.count ?? 0;
      setKioskPendingCount((prev) => (prev === count ? prev : count));
    } catch {
      setKioskPendingCount((prev) => (prev === 0 ? prev : 0));
    }
  }, []);

  const handleShiftUpdated = useCallback(
    (shift: { orderCount: number } | null) => {
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
      applyShiftSummary({
        orderCount: 0,
        ...summary,
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
      setKioskPendingCount(0);
      shiftSummaryBranchRef.current = '';
      return;
    }
    if (shiftSummaryBranchRef.current === branchId) return;
    shiftSummaryBranchRef.current = branchId;
    void refreshShiftSummary(branchId);
  }, [selectedBranchId, activeBranchId, refreshShiftSummary]);

  useEffect(() => {
    const branchId = selectedBranchId || activeBranchId || '';
    if (!branchId) {
      setKioskPendingCount(0);
      return;
    }

    const refresh = () => void refreshKioskPendingCount(branchId);
    refresh();

    const intervalId = window.setInterval(refresh, KIOSK_PENDING_POLL_MS);

    const onBranchChanged = () => refresh();
    const onKioskOrdersChanged = () => refresh();

    window.addEventListener('branch-changed', onBranchChanged);
    eventBus.on('refreshKioskOrders', onKioskOrdersChanged);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('branch-changed', onBranchChanged);
      eventBus.removeListener('refreshKioskOrders', onKioskOrdersChanged);
    };
  }, [selectedBranchId, activeBranchId, refreshKioskPendingCount]);

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
    });
    if (!ok) toast.error('Could not open print preview.');
  }

  const addToCart = (
    product: PosMenuProduct,
    modifiers: CartModifierSelection[],
    variation?: SelectedProductVariation | null
  ) => {
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

  const openCustomize = (p: PosMenuProduct) => {
    setCustomizeProduct(p);
    setCustomizeOpen(true);
  };

  const resolveCatalogProduct = (ref: { id: string }) =>
    products.find((p) => p.id === ref.id) ?? null;

  const proceedWithProduct = (p: PosMenuProduct) => {
    if (productNeedsCustomizeDialog(p)) openCustomize(p);
    else addToCart(p, []);
  };

  const handleProductSelect = (p: PosMenuProduct) => {
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
    if (qty < 1) {
      setCart((prev) => prev.filter((l) => l.lineId !== lineId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, qty } : l))
    );
  }

  function setLineDisc(lineId: string, pct: number) {
    const v = Math.min(100, Math.max(0, pct));
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, lineDiscPct: v } : l))
    );
  }

  function clearCart() {
    setCart([]);
    setEditingOrderId(null);
    setEditingOrderLabel(null);
    setEditingOrderSource(null);
  }

  function cancelEditingOrder() {
    clearCart();
    setPayment('');
    setAmountPaid('');
    setCustomerName('');
    setCustomerPhone('');
    setOrderAddress('');
    setTableId('');
    setCheckoutOpen(false);
    toast.info('Order edit canceled.');
  }

  function loadOrderForEdit(
    detail: PosOrderDetail,
    source: 'pos' | 'kiosk' = 'pos'
  ) {
    const lines: CartLine[] = detail.items.map((item) =>
      normalizeCartLine({
        lineId:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `edit-${item.id}`,
        menuItemId: item.menuItemId,
        name: item.name,
        unitPrice: item.unitPrice,
        qty: item.quantity,
        lineDiscPct: 0,
        imageUrl: item.imageUrl,
      })
    );
    const loadedSubtotal = lines.reduce(
      (sum, line) => sum + lineUnitTotal(line) * line.qty,
      0
    );
    setCart(lines);
    setEditingOrderId(detail.id);
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

  function resetKitchenSendDialog() {
    setKitchenSendOpen(false);
    setKitchenSendOrder(null);
    setKitchenCustomMinutes('');
    setKitchenPrepMinutes({});
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
      const res = await fetch('/api/restaurant/kds/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: kitchenSendOrder.id,
          selectedMinutes: minutes,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || 'Could not send order to kitchen.');
      }
      toast.success(`Order sent to kitchen · ${minutes} min prep`);
      resetKitchenSendDialog();
      void loadPendingKitchenOrders();
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
        `/api/restaurant/pos-order/${encodeURIComponent(cancelKitchenOrder.id)}/cancel`,
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
  }) {
    setKitchenSendOrder(order);
    setKitchenCustomMinutes('');
    setKitchenPrepMinutes((prev) => ({
      ...prev,
      [order.id]: prev[order.id] ?? 15,
    }));
    setKitchenSendOpen(true);
  }

  function resetCardPayment() {
    setCardPaymentStatus('idle');
    setCardTransactionId(undefined);
    setCardPaymentOutcomeOpen(null);
    cardPaymentCancelledRef.current = false;
    cardPaymentResolvedRef.current = false;
  }

  function handleCheckoutOpenChange(open: boolean) {
    setCheckoutOpen(open);
    if (!open) {
      resetCardPayment();
      setPaymentMode('cash');
      setAmountPaid('');
    }
  }

  function handleSelectPaymentMode(mode: 'cash' | 'card') {
    setPaymentMode(mode);
    resetCardPayment();
    setAmountPaid('');
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
      setCardPaymentOutcomeOpen('success');
      return;
    }
    setCardPaymentStatus(result === 'cancelled' ? 'cancelled' : 'error');
    setCardTransactionId(undefined);
    setAmountPaid('');
    setPayment('');
    setCardPaymentOutcomeOpen('error');
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
          currency: 'EUR',
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

  async function handleCardPayClick() {
    if (cardPaymentStatus === 'success') return;
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
    const effectivePaymentMode = opts?.paymentMode ?? paymentMode;
    const effectivePayment = opts?.payment ?? payment;
    const isEditingKiosk =
      Boolean(editingOrderId) && editingOrderSource === 'kiosk';
    if (cart.length === 0) {
      toast.warn('Add at least one product to the cart.');
      return;
    }
    if (!isEditingKiosk && !effectivePayment.trim()) {
      toast.warn('Enter the payment amount before saving.');
      return;
    }
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();
    const tableTrim = tableId.trim();
    const addressTrim = orderAddress.trim();
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
      const paymentAmount = isTerminal
        ? grandTotal.toFixed(2)
        : effectivePayment.trim();
      const orderPayload = {
        grandTotal,
        payment: paymentAmount,
        paymentMode: effectivePaymentMode,
        paymentStatus: isTerminal ? 'pending' : 'completed',
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
        })),
      };
      let savedOrder: {
        id?: string;
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
          `/api/restaurant/kiosk-order/${encodeURIComponent(editingOrderId!)}`,
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
          `Kiosk order updated — ${itemsCount} items · €${formatMoney(grandTotal)}`
        );
        clearCart();
        setPayment('');
        setAmountPaid('');
        setCheckoutOpen(false);
        const branchId = selectedBranchId || activeBranchId || '';
        if (branchId) void refreshKioskPendingCount(branchId);
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
          `/api/restaurant/pos-order/${encodeURIComponent(editingOrderId!)}`,
          orderPayload
        );
        savedOrder = patchRes.data.data;
      } else {
        const postRes = await axios.post<{
          id?: string;
          shortOrderId?: string;
          ticketNumber?: number | null;
        }>('/api/restaurant/pos-order', orderPayload);
        savedOrder = postRes.data;
      }
      const dbOrderId = savedOrder.id || editingOrderId || `POS-${Date.now()}`;
      const trackingId =
        savedOrder.shortOrderId || editingOrderLabel || dbOrderId;
      const ticketNumber = savedOrder.ticketNumber ?? null;
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
              currency: 'EUR',
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
            `/api/restaurant/pos-order/${encodeURIComponent(dbOrderId)}/terminal-payment`,
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
          ? `Order updated — ${itemsCount} items · €${formatMoney(grandTotal)}`
          : `Order saved — ${itemsCount} items · €${formatMoney(grandTotal)} · ${effectivePaymentMode}`
      );
      printOrderReceipt(trackingId, ticketNumber, {
        mode: effectivePaymentMode,
        paid: Number(paymentAmount) || 0,
      });
      eventBus.emit('refreshSalesOrders');
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
      if (!isEditing) {
        openKitchenSendDialog({
          id: dbOrderId,
          shortOrderId: trackingId,
          ticketNumber,
        });
        void loadPendingKitchenOrders();
      }
      const branchId = selectedBranchId || activeBranchId || '';
      if (branchId) void refreshShiftSummary(branchId);
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && e.response?.data?.error
          ? String(e.response.data.error)
          : 'Could not save POS order.';
      toast.error(msg);
    } finally {
      setSavingOrder(false);
    }
  }

  const modeButtons: {
    id: OrderMode;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[] = [
    { id: 'new', label: 'New', icon: UtensilsCrossed },
    { id: 'tables', label: 'Table', icon: TableIcon },
    { id: 'delivery', label: 'Delivery', icon: Truck },
    { id: 'takeaway', label: 'Take-away', icon: ShoppingBag },
  ];

  const renderPosProductButton = (p: PosMenuProduct) => (
    <button
      key={p.id}
      type="button"
      onClick={() => handleProductSelect(p)}
      className="group flex flex-col items-center gap-2 rounded-xl border bg-background p-3 text-center transition hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="h-14 w-14 overflow-hidden rounded-full bg-muted ring-2 ring-primary/20 transition group-hover:scale-[1.02]">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- POS accepts external image URLs
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/90 text-xs font-bold text-primary-foreground">
            {p.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="line-clamp-2 text-[11px] font-semibold leading-tight">
        {p.name}
      </span>
      <span className="text-sm font-medium tabular-nums text-muted-foreground">
        {formatMoney(effectiveUnitPrice(p.price, p.salePrice))}
      </span>
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={requestDashboard}
        >
          <ChevronLeft />
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-muted ring-1 ring-border">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- POS accepts external image URLs
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
                {(branding.name || 'R').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {branding.name || 'Restaurant'}
            </div>
            <div className="text-[11px] text-muted-foreground ">
              {selectedBranchName}
            </div>
          </div>
        </div>

        <div className="relative ml-2 w-full max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              categoryId === 'all'
                ? 'Search all products…'
                : 'Search in this category…'
            }
            className="h-10 bg-background pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            onClick={() => setRecentOrdersOpen(true)}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Recent</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            onClick={() => setKioskOrdersOpen(true)}
          >
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Kiosk</span>
            {kioskPendingCount > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {kioskPendingCount}
              </span>
            ) : null}
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="h-10 gap-2"
            onClick={() => setShiftSheetOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Shift End</span>
          </Button>

          {lastClosingCashInLocker != null ? (
            <div
              className="flex max-w-[9rem] items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5 text-xs sm:max-w-none sm:gap-2 sm:px-3 sm:py-2"
              title={
                lastShiftEndedAt
                  ? `Left in locker at last shift end · ${new Date(lastShiftEndedAt).toLocaleString()}`
                  : 'Cash left in locker from last shift end'
              }
            >
              <Banknote className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  €{formatMoney(lastClosingCashInLocker)}
                </p>
              </div>
            </div>
          ) : null}

          <ModeToggle />
          <UserMenu className="h-10" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[240px_1fr_minmax(320px,400px)] lg:grid-rows-1">
        {/* Categories */}
        <ScrollArea className="min-h-0 max-h-[40dvh] border-b bg-muted/10 lg:h-full lg:max-h-full lg:border-b-0 lg:border-r">
          <div className="space-y-2 p-3">
            {isOwnerOrAdmin && (
              <>
                <div className="text-sm font-semibold">Branch</div>
                <div className="mb-2">
                  {isOwnerOrAdmin ? (
                    <Select
                      value={selectedBranchId}
                      onValueChange={(value) => {
                        setSelectedBranchId(value);
                        void setActiveBranch(value);
                      }}
                    >
                      <SelectTrigger className="h-7 w-full text-xs">
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
                    <p className="rounded-md border bg-background px-2 py-1.5 text-xs text-muted-foreground">
                      {selectedBranchName}
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="text-sm font-semibold">Categories</div>
            <div className="space-y-2">
              {categoriesLoading && progressiveCategories.length === 0 ? (
                <>
                  <CategoryPillSkeleton className="h-12 w-full rounded-xl" />
                  <CategoryPillSkeleton className="h-12 w-full rounded-xl" />
                  <CategoryPillSkeleton className="h-12 w-full rounded-xl" />
                </>
              ) : (
                categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                      categoryId === c.id
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'bg-background hover:bg-muted/40'
                    )}
                    onClick={() => setCategoryId(c.id)}
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                    <span className="min-w-0 flex-1 font-medium">
                      {c.label}
                    </span>
                    {categoryId === c.id ? (
                      <Check className="h-4 w-4 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Products */}
        <ScrollArea className="min-h-0 max-h-[50dvh] border-b lg:h-full lg:max-h-full lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6">
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
                    <div key={category.id} className="col-span-full space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {category.name}
                      </p>
                      <ProductCardSkeletonGrid
                        count={6}
                        variant="pos"
                        gridClassName="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6"
                      />
                    </div>
                  );
                }

                if (categoryProducts.length === 0) return null;

                return (
                  <div key={category.id} className="col-span-full space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6">
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
                <p className="text-[#64748b]">
                  No products match this category or search.
                </p>
                <Button
                  type="button"
                  variant="default"
                  className="w-full bg-primary p-2 text-primary-foreground hover:bg-primary/90"
                  onClick={() => setCategoryId('all')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to all products
                </Button>
              </div>
            ) : null}
          </div>
        </ScrollArea>
        {/* Checkout */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-t bg-muted/20 p-3 lg:h-full lg:border-t-0">
          <div className="grid grid-cols-4 gap-2">
            {modeButtons.map((b) => {
              const active = orderMode === b.id;
              const Icon = b.icon;
              return (
                <button
                  key={b.id}
                  type="button"
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border bg-background text-xs font-medium transition',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'hover:bg-muted/40'
                  )}
                  onClick={() => setOrderMode(b.id)}
                >
                  <Icon className="h-5 w-5" />
                  <span>{b.label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-2xl font-semibold leading-none">
                Order Ticket
              </h3>
              {editingOrderId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs"
                  onClick={cancelEditingOrder}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
            {editingOrderId ? (
              <p className="mt-1 text-xs font-medium text-primary">
                {isEditingKioskOrder ? 'Editing kiosk order' : 'Editing order'}{' '}
                {editingOrderLabel}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {orderMode === 'tables'
                  ? 'Table order'
                  : orderMode === 'delivery'
                    ? 'Delivery order'
                    : orderMode === 'takeaway'
                      ? 'Take-away order'
                      : 'New order'}
              </p>
            )}

            <ScrollArea className="mt-3 h-[250px] max-h-[250px] border-y">
              <div className="space-y-3 py-3">
                {cart.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No Products in Cart!
                  </p>
                ) : (
                  cart.map((line) => {
                    const gross = lineUnitTotal(line) * line.qty;
                    const discAmt = gross * (line.lineDiscPct / 100);
                    const lineTotal = gross - discAmt;
                    return (
                      <div
                        key={line.lineId}
                        className="space-y-1 border-b px-1 pb-2 last:border-b-0"
                      >
                        <div className="flex items-start gap-2 text-sm">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                            {line.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- POS accepts external image URLs
                              <img
                                src={line.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <PosCartLineSummary
                              line={line}
                              titleClassName="text-sm font-medium leading-snug"
                              subItemClassName="text-[11px] text-muted-foreground"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              {line.qty}x · €{formatMoney(lineUnitTotal(line))}{' '}
                              each
                            </p>
                          </div>
                          <p className="shrink-0 tabular-nums">
                            €{formatMoney(lineTotal)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setQty(line.lineId, line.qty - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center text-xs tabular-nums">
                            {line.qty}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setQty(line.lineId, line.qty + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Input
                            className="ml-1 h-6 w-16 px-1 text-center text-xs"
                            inputMode="decimal"
                            value={line.lineDiscPct || ''}
                            placeholder="%"
                            onChange={(e) =>
                              setLineDisc(
                                line.lineId,
                                Number(e.target.value) || 0
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-6 w-6 text-destructive"
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

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">€{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({taxPct || '0'}%)
                </span>
                <span className="tabular-nums">€{formatMoney(taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount ({disPct || '0'}%)
                </span>
                <span className="tabular-nums">€{formatMoney(disAmount)}</span>
              </div>
              {activeServiceChargeAmount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service charge</span>
                  <span className="tabular-nums">
                    €{formatMoney(activeServiceChargeAmount)}
                  </span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t pt-2 text-lg font-semibold">
                <span>Total</span>
                <span className="tabular-nums">€{formatMoney(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/10 p-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-muted-foreground">
                Tax %
              </label>
              <Input
                className="h-8 text-xs"
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-muted-foreground">
                Discount %
              </label>
              <Input
                className="h-8 text-xs"
                value={disPct}
                onChange={(e) => setDisPct(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-auto space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={
                  cart.length === 0 || savingOrder || terminalProcessing
                }
                onClick={clearCart}
              >
                <Trash2 className="h-4 w-4 mr-2" /> <span>Clear Cart</span>
              </Button>
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  disabled={
                    cart.length === 0 || savingOrder || terminalProcessing
                  }
                  onClick={holdCurrentOrder}
                >
                  <Clock className="h-4 w-4 mr-2" /> <span>Hold Order</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setArchivedOrdersOpen(true)}
                >
                  <Archive className="h-5 w-5" />
                  <span className="text-xs font-medium mb-2 bg-primary/10 text-primary rounded-full p-0.5">
                    {archivedOrders.length}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setPendingKitchenOpen(true);
                    void loadPendingKitchenOrders();
                  }}
                >
                  <ChefHat className="h-5 w-5 " />
                  <span className="text-xs font-medium mb-2 bg-primary/10 text-primary rounded-full p-0.5">
                    {pendingKitchenOrders.length}
                  </span>
                </Button>
              </div>
            </div>
            <div>
              <Button
                type="button"
                variant="default"
                className="w-full"
                disabled={
                  cart.length === 0 || savingOrder || terminalProcessing
                }
                onClick={() => {
                  resetCardPayment();
                  setPaymentMode('cash');
                  setAmountPaid(
                    isEditingKioskOrder ? grandTotal.toFixed(2) : ''
                  );
                  setCheckoutOpen(true);
                }}
              >
                {editingOrderId ? 'Update order' : 'Proceed Order'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
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
                        {new Date(order.createdAt).toLocaleString()} · €
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
                          €{formatMoney(order.total)}
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
                              €{formatMoney(line.unitPrice * line.qty)}
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

      <Dialog open={checkoutOpen} onOpenChange={handleCheckoutOpenChange}>
        <DialogContent
          className={cn(
            'max-w-2xl flex max-h-[min(90dvh,42rem)] flex-col gap-0 overflow-hidden p-6',
            'sm:max-h-[min(92dvh,44rem)]'
          )}
        >
          <DialogHeader className="shrink-0 space-y-1.5 pb-2 text-left">
            <DialogTitle>
              {isEditingKioskOrder
                ? 'Update kiosk order'
                : editingOrderId
                  ? 'Update order'
                  : 'Checkout'}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
            <div className="grid gap-4 pb-1 md:grid-cols-[1fr_280px]">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-center text-xs">Qty</TableHead>
                      <TableHead className="text-right text-xs">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((line) => {
                      const gross = lineUnitTotal(line) * line.qty;
                      const discAmt = gross * (line.lineDiscPct / 100);
                      const lineTotal = gross - discAmt;
                      return (
                        <TableRow key={line.lineId}>
                          <TableCell className="text-xs">
                            <PosCartLineSummary
                              line={line}
                              titleClassName="text-xs font-medium leading-snug"
                              subItemClassName="text-[11px] text-muted-foreground"
                            />
                          </TableCell>
                          <TableCell className="text-center text-xs tabular-nums">
                            {line.qty}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            €{formatMoney(lineTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-medium">Order details</div>
                  <div className="mt-2 grid gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Branch
                      </label>
                      <Input
                        readOnly
                        className="h-9 bg-muted/40 text-sm font-medium"
                        value={selectedBranchName}
                      />
                    </div>
                    {isTableMode ? (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Select table
                        </label>
                        <Select value={tableId} onValueChange={setTableId}>
                          <SelectTrigger className="h-9 bg-background">
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
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      €{formatMoney(subtotal)}
                    </span>
                  </div>
                  {activeServiceChargeAmount > 0 ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Service charge
                      </span>
                      <span className="tabular-nums">
                        €{formatMoney(activeServiceChargeAmount)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">
                      €{formatMoney(grandTotal)}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {isEditingKioskOrder ? (
                      <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                        Cash payment stays pending until you collect payment
                        from Kiosk orders.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Payment method
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant={
                                paymentMode === 'cash' ? 'default' : 'outline'
                              }
                              className="justify-start gap-2"
                              onClick={() => handleSelectPaymentMode('cash')}
                            >
                              <Banknote className="h-4 w-4" />
                              Cash
                            </Button>
                            <Button
                              type="button"
                              variant={
                                paymentMode === 'card' ? 'default' : 'outline'
                              }
                              className="justify-start gap-2"
                              onClick={() => handleSelectPaymentMode('card')}
                            >
                              <CreditCard className="h-4 w-4" />
                              Card
                            </Button>
                          </div>
                          {isCardMode ? (
                            <Button
                              type="button"
                              className={cn(
                                'w-full gap-2',
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
                                  Pay
                                </>
                              ) : cardPaymentStatus === 'processing' ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Processing…
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4" />
                                  Pay €{formatMoney(grandTotal)}
                                </>
                              )}
                            </Button>
                          ) : null}
                        </div>

                        {isCardMode ? (
                          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            {isCardPaymentComplete ? (
                              <span className="text-emerald-700 dark:text-emerald-400">
                                Card payment completed — you can place the
                                order.
                              </span>
                            ) : (
                              <span>
                                Complete card payment before placing the order.
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              Total payment
                            </label>
                            <Input
                              className="h-9 bg-background"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={amountPaid}
                              onChange={(e) => setAmountPaid(e.target.value)}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Change</span>
                              <span className="tabular-nums text-foreground">
                                €
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
                      </>
                    )}
                  </div>
                </div>

                {orderMode !== 'tables' ? (
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">Customer</div>
                    <div className="mt-2 grid gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Name
                        </label>
                        <Input
                          className="h-9 bg-background"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Phone
                        </label>
                        <Input
                          className="h-9 bg-background"
                          inputMode="tel"
                          value={customerPhone}
                          onChange={(event) => {
                            const value = event.target.value.replace(/\D/g, '');
                            setCustomerPhone(value);
                          }}
                        />
                      </div>
                      {isDeliveryMode ? (
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Delivery address
                          </label>
                          <textarea
                            className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Enter delivery address"
                            value={orderAddress}
                            onChange={(e) => setOrderAddress(e.target.value)}
                            rows={3}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3 shrink-0 gap-2 border-t border-border/60 bg-background pt-4 sm:gap-0 w-full">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setCheckoutOpen(false)}
            >
              <>
                <X className="mr-2 h-4 w-4" /> <span>Cancel</span>
              </>
            </Button>

            <Button
              type="button"
              className="w-full"
              disabled={
                cart.length === 0 ||
                savingOrder ||
                terminalProcessing ||
                cardPaymentStatus === 'processing' ||
                (isEditingKioskOrder
                  ? false
                  : isCardMode
                    ? !isCardPaymentComplete
                    : amountPaid.trim() === '')
              }
              onClick={() => {
                if (isEditingKioskOrder) {
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
              <>
                {savingOrder ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />{' '}
                    <span>
                      {editingOrderId ? 'Update order' : 'Place Order'}
                    </span>
                  </>
                )}
              </>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cardProcessingOpen}
        onOpenChange={(open) => {
          if (!open && cardPaymentStatus === 'processing') return;
          setCardProcessingOpen(open);
        }}
      >
        <DialogContent
          className="max-w-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle>Payment processing</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative flex h-28 w-36 flex-col items-center justify-end rounded-xl border-2 border-primary/40 bg-muted/50 p-3 shadow-inner">
              <div className="absolute inset-x-3 top-3 h-10 rounded-md bg-primary/15">
                <div className="mx-auto mt-2 h-2 w-16 animate-pulse rounded-full bg-primary/50" />
                <div className="mx-auto mt-2 h-1.5 w-10 animate-pulse rounded-full bg-primary/30 [animation-delay:150ms]" />
              </div>
              <div className="mb-1 flex h-10 w-full items-center justify-center rounded-md border border-primary/30 bg-background">
                <CreditCard className="h-6 w-6 animate-bounce text-primary" />
              </div>
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                ATM
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Insert or tap card on the terminal…
            </p>
            <p className="text-lg font-semibold tabular-nums">
              €{formatMoney(grandTotal)}
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleCardPaymentBypass}
            >
              Bypass payment (test)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleCardPaymentCancel}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cardPaymentOutcomeOpen === 'success'}
        onOpenChange={(open) => {
          if (!open) setCardPaymentOutcomeOpen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Payment successful
            </AlertDialogTitle>
            <AlertDialogDescription>
              Card payment of €{formatMoney(grandTotal)} was approved
              {cardTransactionId ? ` (${cardTransactionId})` : ''}. You can now
              place the order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCardPaymentOutcomeOpen(null)}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cardPaymentOutcomeOpen === 'error'}
        onOpenChange={(open) => {
          if (!open) setCardPaymentOutcomeOpen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Payment failed
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cardPaymentStatus === 'cancelled'
                ? 'Card payment was cancelled. Tap Pay to try again.'
                : 'Card payment could not be completed. Tap Pay to try again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCardPaymentOutcomeOpen(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                      }}
                    >
                      {m} min
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={KITCHEN_PREP_MIN}
                  max={KITCHEN_PREP_MAX}
                  placeholder={`Custom (${KITCHEN_PREP_MIN}–${KITCHEN_PREP_MAX})`}
                  value={kitchenCustomMinutes}
                  onChange={(e) => setKitchenCustomMinutes(e.target.value)}
                />
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
        onOpenChange={(open) => {
          setCustomizeOpen(open);
          if (!open) setCustomizeProduct(null);
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

      <PosKioskOrdersSheet
        open={kioskOrdersOpen}
        onOpenChange={setKioskOrdersOpen}
        branchId={selectedBranchId || activeBranchId || null}
        brandName={branding.name || 'Restaurant'}
        branchName={selectedBranchName}
        logoUrl={branding.logoUrl}
        onEditOrder={(order) => loadOrderForEdit(order, 'kiosk')}
        onOrdersChanged={() => {
          eventBus.emit('refreshKioskOrders');
          eventBus.emit('refreshRecentOrders');
          const branchId = selectedBranchId || activeBranchId || '';
          if (branchId) {
            void refreshKioskPendingCount(branchId);
            void refreshShiftSummary(branchId);
          }
        }}
      />

      <PosShiftSheet
        open={shiftSheetOpen}
        onOpenChange={setShiftSheetOpen}
        branchId={selectedBranchId || activeBranchId || null}
        brandName={branding.name || 'Restaurant'}
        branchName={selectedBranchName}
        logoUrl={branding.logoUrl}
        onShiftUpdated={handleShiftUpdated}
        onShiftClosed={handleShiftClosed}
      />
    </div>
  );
}
