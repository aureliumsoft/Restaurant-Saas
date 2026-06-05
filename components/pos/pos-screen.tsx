'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  LayoutDashboard,
  Archive,
  ChefHat,
  ChefHatIcon,
  CrossIcon,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
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
import {
  buildThermalReceiptHeaderHtml,
  getThermalReceiptDocumentCss,
} from '@/lib/thermal-receipt-html';
import { toast } from 'react-toastify';
import axios from 'axios';
import eventBus from '@/lib/even';
import { usePosCartGuard } from '@/components/pos/pos-cart-guard-context';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { ModeToggle } from '@/components/darkmode/darkmode';
import UserMenu from '@/components/dashboard/UserMenu';
import { Cross2Icon } from '@radix-ui/react-icons';

export type OrderMode = 'new' | 'tables' | 'delivery' | 'takeaway' | 'queue';

type Product = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  imageUrl?: string | null;
  variations?: {
    id: string;
    name?: string;
    title?: string;
    imageUrl?: string | null;
    swatchHex?: string | null;
    priceDelta: number;
  }[];
};

type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  lineDiscPct: number;
  variationId?: string | null;
  variationName?: string | null;
};

/** `all` shows every product; other ids match `Product.categoryId`. */
type Category = {
  id: string;
  label: string;
};

type RestaurantMenuApi = {
  data?: {
    menus?: Array<{
      id: string;
      name: string;
      showInFront?: boolean;
      items?: Array<{
        id: string;
        name: string;
        imageUrl?: string | null;
        price: number | string | null;
        salePrice: number | string | null;
        variations?: Array<{
          id: string;
          name?: string;
          title?: string;
          imageUrl?: string | null;
          swatchHex?: string | null;
          priceDelta: number | string | null;
        }>;
      }>;
    }>;
  };
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

const POS_ARCHIVED_ORDERS_KEY = 'pos_archived_orders_v1';

export function PosScreen() {
  const router = useRouter();
  const { setPosCartHasItems } = usePosCartGuard();
  const [orderMode, setOrderMode] = useState<OrderMode>('tables');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([
    { id: 'all', label: 'ALL' },
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
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

  const [srChPct, setSrChPct] = useState('0');
  const [taxPct, setTaxPct] = useState('0');
  const [disPct, setDisPct] = useState('0');

  const [paymentMode, setPaymentMode] = useState('cash');
  const [payment, setPayment] = useState('');
  const [kotNote, setKotNote] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [terminalProcessing, setTerminalProcessing] = useState(false);
  const [swatchDialogOpen, setSwatchDialogOpen] = useState(false);
  const [swatchProduct, setSwatchProduct] = useState<Product | null>(null);
  const [swatchId, setSwatchId] = useState<string>('');

  const [now, setNow] = useState<Date>(() => new Date());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [archivedOrdersOpen, setArchivedOrdersOpen] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState<ArchivedOrder[]>([]);

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

  const loadPendingKitchenOrders = useCallback(async () => {
    setLoadingPendingKitchen(true);
    try {
      const res = await fetch('/api/restaurant/pos-order/pending-kitchen', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load');
      const json = (await res.json()) as { data?: PosPendingKitchenOrder[] };
      setPendingKitchenOrders(json.data ?? []);
    } catch {
      setPendingKitchenOrders([]);
    } finally {
      setLoadingPendingKitchen(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      setLoadingMenu(true);
      try {
        const res = await fetch('/api/restaurant/menu', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load menu');
        const json = (await res.json()) as RestaurantMenuApi;
        const menus = (json.data?.menus ?? []).filter(
          (menu) =>
            menu.showInFront !== false && (menu.items?.length ?? 0) > 0
        );

        const nextCategories: Category[] = [{ id: 'all', label: 'ALL' }];
        const nextProducts: Product[] = [];

        for (const menu of menus) {
          nextCategories.push({
            id: menu.id,
            label: String(menu.name || 'UNNAMED').toUpperCase(),
          });
          for (const item of menu.items ?? []) {
            const sale = Number(item.salePrice);
            const base = Number(item.price);
            const price =
              Number.isFinite(sale) && sale > 0
                ? sale
                : Number.isFinite(base)
                  ? base
                  : 0;
            nextProducts.push({
              id: item.id,
              name: item.name,
              price,
              categoryId: menu.id,
              imageUrl: item.imageUrl ?? null,
              variations: (item.variations ?? []).map((v) => ({
                id: v.id,
                name: v.name,
                title: v.title,
                imageUrl: v.imageUrl ?? null,
                swatchHex: v.swatchHex ?? null,
                priceDelta: Number(v.priceDelta ?? 0),
              })),
            });
          }
        }

        if (!isMounted) return;
        setCategories(nextCategories);
        setProducts(nextProducts);
      } catch {
        if (!isMounted) return;
        setCategories([{ id: 'all', label: 'ALL' }]);
        setProducts([]);
        toast.error('Failed to load menu products for POS.');
      } finally {
        if (isMounted) setLoadingMenu(false);
      }
    }

    void loadMenu();
    void loadPendingKitchenOrders();
    return () => {
      isMounted = false;
    };
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
      if (Array.isArray(parsed)) setArchivedOrders(parsed);
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
          data?: { name?: string | null; logoUrl?: string | null } | null;
        };
        const data = json?.data;
        if (cancelled || !data) return;
        setBranding({
          name: (data.name?.trim() || 'Restaurant') as string,
          logoUrl: data.logoUrl ?? null,
        });
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
    let cancelled = false;
    async function loadTables() {
      setTablesLoading(true);
      try {
        const res = await fetch('/api/restaurant/tables', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('tables');
        const json = (await res.json()) as { data?: DiningTableOption[] };
        const list = Array.isArray(json?.data) ? json.data : [];
        if (!cancelled) setDiningTables(list);
      } catch {
        if (!cancelled) {
          setDiningTables([]);
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
  }, []);

  useEffect(() => {
    setPosCartHasItems(cart.length > 0);
    return () => setPosCartHasItems(false);
  }, [cart, setPosCartHasItems]);

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
    return products.filter((p) => {
      const inCategory = categoryId === 'all' || p.categoryId === categoryId;
      if (!inCategory) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [categoryId, products, search]);

  const itemsCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, line) => {
      const gross = line.unitPrice * line.qty;
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
  const grandTotal = Math.max(0, afterSr + taxAmount - disAmount);

  const isTableMode = orderMode === 'tables';
  const isDeliveryMode = orderMode === 'delivery';
  const selectedBranchName =
    branches.find((b) => b.id === selectedBranchId)?.name ??
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

  function printOrderReceipt(
    orderRef: string,
    ticketNumber?: number | null,
    receiptPayment?: { mode: string; paid: number }
  ) {
    if (typeof window === 'undefined') return;

    const rows = cart
      .map((line) => {
        const gross = line.unitPrice * line.qty;
        const discAmt = gross * (line.lineDiscPct / 100);
        const lineTotal = gross - discAmt;
        const nestedMatch = line.name.match(/^(.*)\((.*)\)\s*$/);
        const baseName = nestedMatch?.[1]?.trim() || line.name;
        const nestedRaw = nestedMatch?.[2]?.trim() || '';
        const nestedRows = nestedRaw
          ? nestedRaw
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean)
              .map(
                (part) => `<tr>
          <td style="padding-left:10px;color:#555;">${part}</td>
          <td class="qty">1</td>
          <td class="amt">—</td>
        </tr>`
              )
              .join('')
          : '';
        return `<tr>
          <td>${baseName}</td>
          <td class="qty">${line.qty}</td>
          <td class="amt">€${formatMoney(lineTotal)}</td>
        </tr>${nestedRows}`;
      })
      .join('');

    const receiptMode = receiptPayment?.mode ?? paymentMode;
    const paidAmount =
      receiptPayment?.paid ??
      (receiptMode === 'card_terminal'
        ? grandTotal
        : Math.max(0, Number(payment) || 0));
    const changeAmount =
      receiptMode === 'cash' ? Math.max(0, paidAmount - grandTotal) : 0;
    const paymentMethodLabel =
      receiptMode === 'card_terminal'
        ? 'Card Terminal'
        : receiptMode.charAt(0).toUpperCase() + receiptMode.slice(1);
    const receiptHeader = buildThermalReceiptHeaderHtml({
      logoUrl: branding.logoUrl,
      brandName: branding.name || 'Restaurant',
      branchName: selectedBranchName,
      dateTime: new Date().toLocaleString(),
    });

    const html = `<!doctype html>
<html>
  <head>
    <title>Order Receipt</title>
    <style>${getThermalReceiptDocumentCss()}</style>
  </head>
  <body>
    <div class="r">
      ${receiptHeader}
      <div class="sep"></div>
      ${ticketNumber != null ? `<div style="font-size: 9px; color: #555; margin-top: 1px;"><strong>Ticket:</strong> #${ticketNumber}</div>` : ''}
      <div style="font-size: 9px; color: #555; margin-top: 1px;"><strong>Tracking ID:</strong> ${orderRef}</div>
      <div style="font-size: 9px; color: #555; margin-top: 1px;"><strong>Mode:</strong> ${orderMode}</div>
      <div style="font-size: 9px; color: #555; margin-top: 1px;"><strong>Payment:</strong> ${paymentMethodLabel}</div>
      <div style="font-size: 9px; color: #555; margin-top: 1px;"><strong>Status:</strong> paid</div>
    ${
      tableId
        ? `<div><strong>Table:</strong> ${diningTables.find((t) => t.id === tableId)?.name ?? tableId}</div>`
        : ''
    }
    ${customerName ? `<div><strong>Customer:</strong> ${customerName}</div>` : ''}
    ${customerPhone ? `<div><strong>Phone:</strong> ${customerPhone}</div>` : ''}
    ${orderAddress ? `<div><strong>Address:</strong> ${orderAddress}</div>` : ''}
    ${kotNote ? `<div><strong>Note:</strong> ${kotNote}</div>` : ''}
    <div class="sep"></div>
    <table>
      <thead>
        <tr><th>Item</th><th class="qty">Qty</th><th class="amt">Amt</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sep"></div>
    <div class="totals">
      <div><span>Subtotal</span><span>€${formatMoney(subtotal)}</span></div>
      <div><span>Tax</span><span>€${formatMoney(taxAmount)}</span></div>
      <div><span>Discount</span><span>€${formatMoney(disAmount)}</span></div>
      <div><span>Paid</span><span>€${formatMoney(paidAmount)}</span></div>
      <div><span>Change</span><span>€${formatMoney(changeAmount)}</span></div>
      <div class="grand"><span>Total</span><span>€${formatMoney(grandTotal)}</span></div>
    </div>
    <div class="sep"></div>
    <div class="center muted">Thank you!</div>
    </div>
  </body>
</html>`;
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      toast.error('Could not open print preview.');
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
      }
    };
  }

  function addProduct(
    p: Product,
    swatch?: { id: string; name: string; price: number } | null
  ) {
    const productId = swatch ? `${p.id}::sw:${swatch.id}` : p.id;
    const unitPrice = swatch ? swatch.price : p.price;
    const displayName = swatch ? `${p.name} (${swatch.name})` : p.name;
    if (p.price <= 0) {
      toast.info('Open modifiers from staff menu — price is 0 for this item.');
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId,
          name: displayName,
          unitPrice,
          qty: 1,
          lineDiscPct: 0,
          variationId: swatch?.id ?? null,
          variationName: swatch?.name ?? null,
        },
      ];
    });
  }

  function requestAddProduct(p: Product) {
    if ((p.variations?.length ?? 0) === 0) {
      addProduct(p, null);
      return;
    }
    setSwatchProduct(p);
    setSwatchId('');
    setSwatchDialogOpen(true);
  }

  function setQty(productId: string, qty: number) {
    if (qty < 1) {
      setCart((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty } : l))
    );
  }

  function setLineDisc(productId: string, pct: number) {
    const v = Math.min(100, Math.max(0, pct));
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, lineDiscPct: v } : l
      )
    );
  }

  function clearCart() {
    setCart([]);
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
    setCart(order.lines);
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

  async function saveOrder(opts?: { paymentMode?: string; payment?: string }) {
    const effectivePaymentMode = opts?.paymentMode ?? paymentMode;
    const effectivePayment = opts?.payment ?? payment;
    if (cart.length === 0) {
      toast.warn('Add at least one product to the cart.');
      return;
    }
    if (!effectivePayment.trim()) {
      toast.warn('Enter the payment amount before saving.');
      return;
    }
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();
    const tableTrim = tableId.trim();
    const addressTrim = orderAddress.trim();
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
    setSavingOrder(true);
    try {
      const isTerminal = effectivePaymentMode === 'card_terminal';
      const paymentAmount = isTerminal
        ? grandTotal.toFixed(2)
        : effectivePayment.trim();
      const res = await axios.post<{
        id?: string;
        shortOrderId?: string;
        ticketNumber?: number | null;
      }>('/api/restaurant/pos-order', {
        grandTotal,
        payment: paymentAmount,
        paymentMode: effectivePaymentMode,
        paymentStatus: isTerminal ? 'pending' : 'completed',
        address: addressTrim || undefined,
        taxAmount,
        discountAmount: disAmount,
        customerName: nameTrim || undefined,
        customerPhone: phoneTrim || undefined,
        tableId: tableTrim || undefined,
        orderMode,
        items: cart.map((l) => ({
          productId: l.productId,
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineDiscPct: l.lineDiscPct,
        })),
      });
      const dbOrderId = res.data?.id || `POS-${Date.now()}`;
      const trackingId = res.data?.shortOrderId || dbOrderId;
      if (isTerminal) {
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
        `Order saved — ${itemsCount} items · €${formatMoney(grandTotal)} · ${effectivePaymentMode}`
      );
      printOrderReceipt(trackingId, res.data?.ticketNumber ?? null, {
        mode: effectivePaymentMode,
        paid: Number(paymentAmount) || 0,
      });
      eventBus.emit('refreshSalesOrders');
      clearCart();
      setPayment('');
      setAmountPaid('');
      setOrderAddress('');
      setCustomerName('');
      setCustomerPhone('');
      setTableId('');
      setCheckoutOpen(false);
      openKitchenSendDialog({
        id: dbOrderId,
        shortOrderId: trackingId,
        ticketNumber: res.data?.ticketNumber ?? null,
      });
      void loadPendingKitchenOrders();
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

  return (
    <ScrollArea className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
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
            <div className="text-[11px] text-muted-foreground">
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
            className="hidden h-10 gap-2 md:inline-flex"
            onClick={requestDashboard}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>

          <div className="hidden items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground md:flex">
            <Clock className="h-4 w-4" />
            <span className="tabular-nums">
              {now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <ModeToggle />
          <UserMenu className="h-10" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_1fr_minmax(320px,400px)]">
        {/* Categories */}
        <ScrollArea className="min-h-0 border-b bg-muted/10 lg:border-b-0 lg:border-r">
          <div className="space-y-2 p-3">
            <div className="text-sm font-semibold">Select Branch</div>
            <div className="mb-2">
              <Select
                value={selectedBranchId}
                onValueChange={setSelectedBranchId}
              >
                <SelectTrigger className="h-7 w-full text-xs">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm font-semibold">Categories</div>
            <div className="space-y-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition',
                    categoryId === c.id
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'bg-background hover:bg-muted/40'
                  )}
                  onClick={() => setCategoryId(c.id)}
                >
                  <span className="font-medium">{c.label}</span>
                  {categoryId === c.id ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Products */}
        <ScrollArea className="min-h-0 border-b lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4  2xl:grid-cols-6">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => requestAddProduct(p)}
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
                    <div className="flex h-full w-full items-center justify-center bg-primary/90 text-primary-foreground text-xs font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight">
                  {p.name}
                </span>
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {formatMoney(p.price)}
                </span>
              </button>
            ))}
            {loadingMenu ? (
              <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                <Loader2 className="animate-spin text-primary text-center mx-auto" />
              </div>
            ) : (
              filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  <p className="text-[#64748b]">
                    No products match this category or search.
                  </p>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 p-2"
                    onClick={() => setCategoryId('all')}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to all products
                  </Button>
                </div>
              )
            )}
          </div>
        </ScrollArea>
        {/* Checkout */}
        <div className="flex min-h-0 flex-col gap-3 border-t bg-muted/20 p-3 lg:border-t-0">
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
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold leading-none">
                Order Ticket
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {orderMode === 'tables'
                ? 'Table order'
                : orderMode === 'delivery'
                  ? 'Delivery order'
                  : orderMode === 'takeaway'
                    ? 'Take-away order'
                    : 'New order'}
            </p>

            <ScrollArea className="mt-3 h-[250px] max-h-[250px] border-y">
              <div className="space-y-3 py-3">
                {cart.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No Products in Cart!
                  </p>
                ) : (
                  cart.map((line) => {
                    const gross = line.unitPrice * line.qty;
                    const discAmt = gross * (line.lineDiscPct / 100);
                    const lineTotal = gross - discAmt;
                    return (
                      <div
                        key={line.productId}
                        className="space-y-1 border-b px-1 pb-2 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{line.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {line.qty}x
                            </p>
                          </div>
                          <p className="tabular-nums">
                            €{formatMoney(lineTotal)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setQty(line.productId, line.qty - 1)}
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
                            onClick={() => setQty(line.productId, line.qty + 1)}
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
                                line.productId,
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
                                prev.filter(
                                  (l) => l.productId !== line.productId
                                )
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
                  setAmountPaid('');
                  setCheckoutOpen(true);
                }}
              >
                Proceed Order
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
              Paid POS orders waiting for prep time and kitchen display.
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
                            key={`${order.id}-${line.productId}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              {line.qty}x {line.name}
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

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent
          className={cn(
            'max-w-2xl flex max-h-[min(90dvh,42rem)] flex-col gap-0 overflow-hidden p-6',
            'sm:max-h-[min(92dvh,44rem)]'
          )}
        >
          <DialogHeader className="shrink-0 space-y-1.5 pb-2 text-left">
            <DialogTitle>Checkout</DialogTitle>
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
                      const gross = line.unitPrice * line.qty;
                      const discAmt = gross * (line.lineDiscPct / 100);
                      const lineTotal = gross - discAmt;
                      return (
                        <TableRow key={line.productId}>
                          <TableCell className="text-xs font-medium">
                            {line.name}
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

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">
                      €{formatMoney(grandTotal)}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2">
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
                          onClick={() => setPaymentMode('cash')}
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
                          onClick={() => setPaymentMode('card')}
                        >
                          <CreditCard className="h-4 w-4" />
                          Card
                        </Button>
                      </div>
                    </div>

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
                            Math.max(0, (Number(amountPaid) || 0) - grandTotal)
                          )}
                        </span>
                      </div>
                    </div>
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
                amountPaid.trim() === ''
              }
              onClick={() => {
                const pm = paymentMode === 'card' ? 'card' : 'cash';
                const pay = (Number(amountPaid) || 0).toFixed(2);
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
                    <Check className="h-4 w-4 mr-2" /> <span>Place Order</span>
                  </>
                )}
              </>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={swatchDialogOpen} onOpenChange={setSwatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select swatch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Swatch</label>
            <Select value={swatchId} onValueChange={setSwatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose swatch" />
              </SelectTrigger>
              <SelectContent>
                {(swatchProduct?.variations ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {(v.name ?? v.title ?? 'Swatch') +
                      ` - ${formatMoney(Number(v.priceDelta ?? 0))}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSwatchDialogOpen(false)}
            >
              <>
                <X className="mr-2 h-4 w-4" /> <span>Cancel</span>
              </>
            </Button>
            <Button
              type="button"
              disabled={!swatchId || !swatchProduct}
              onClick={() => {
                if (!swatchProduct) return;
                const picked = (swatchProduct.variations ?? []).find(
                  (v) => v.id === swatchId
                );
                if (!picked) return;
                addProduct(swatchProduct, {
                  id: picked.id,
                  name: picked.name ?? picked.title ?? 'Swatch',
                  price: Number(picked.priceDelta ?? 0),
                });
                setSwatchDialogOpen(false);
                setSwatchProduct(null);
                setSwatchId('');
              }}
            >
              <>
                <Plus className="h-4 w-4 mr-2" /> <span>Add Swatch</span>
              </>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
