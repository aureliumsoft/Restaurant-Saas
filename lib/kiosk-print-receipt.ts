import { formatCurrency } from '@/lib/format-money';
import {
  parseCustomerFromAddressSnapshot,
  parseCutleryFromAddressSnapshot,
  parseNoteFromAddressSnapshot,
  parseTableFromAddressSnapshot,
} from '@/lib/order-fulfillment';
import {
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import { isKioskSyntheticCustomerPhone } from '@/lib/kiosk-customer';
import { receiptLinesFromOrderItem } from '@/lib/receipt-item-lines';
import { formatBranchDateTime } from '@/lib/branch-timezone';
import {
  PAPER_80MM_DOTS,
  renderThermalReceiptPng,
  type ThermalBitmapReceipt,
} from '@/lib/thermal-receipt-bitmap';

export type PrintKioskReceiptParams = {
  slug: string;
  branchId: string;
  orderId: string;
};

const RECEIPT_SNAPSHOT_KEY = 'foodluk-kiosk-receipt-snapshot';
const PRINTER_BASE_KEY = 'foodluk-kiosk-printer-base';
/** Localhost should answer quickly. A dead address must not hold the customer. */
const PRINTER_TRY_MS = 700;

export type KioskReceiptSnapshot = {
  orderId: string;
  trackingId: string;
  sent?: boolean;
  restaurantName: string;
  branchName: string | null;
  dateTime: string;
  ticketNo: number | null;
  paymentMethod: string;
  paymentState: string;
  tableName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  mode: string;
  note: string | null;
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  paidAmount: number;
  change: number;
  total: number;
  regional?: Partial<RestaurantRegionalSettings> | null;
};

export function saveKioskReceiptSnapshot(snapshot: KioskReceiptSnapshot) {
  try {
    sessionStorage.setItem(RECEIPT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function retargetKioskReceiptSnapshot(orderId: string) {
  const snapshot = readSnapshotRecord();
  if (!snapshot) return;
  saveKioskReceiptSnapshot({ ...snapshot, orderId });
}

export function kioskReceiptAlreadySent(orderId: string): boolean {
  const snapshot = readSnapshotRecord();
  if (!snapshot?.sent) return false;
  return snapshot.orderId === orderId || snapshot.trackingId === orderId;
}

type ReceiptLineItem = {
  name: string;
  quantity: number | null;
  lineTotal: number | null;
};

type ReceiptModel = {
  restaurantName: string;
  logoUrl: string | null;
  branchName: string | null;
  dateTime: string;
  ticketNo: number | null;
  trackingId: string;
  paymentMethod: string;
  paymentState: string;
  tableName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  mode: string;
  cutleryRequested: boolean;
  note: string | null;
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  paidAmount: number;
  change: number;
  total: number;
  money: (n: number) => string;
};

/** Minimal surface commonly exposed by Sunmi WebView JS bridges. */
export type SunmiPrinterBridge = {
  printText?: (text: string, callback?: unknown) => unknown;
  printOriginalText?: (text: string, callback?: unknown) => unknown;
  /** Some bridges use camelCase sendRawData / sendRAWData. */
  sendRawData?: (data: number[] | Uint8Array | string, callback?: unknown) => unknown;
  sendRAWData?: (data: number[] | Uint8Array | string, callback?: unknown) => unknown;
  printerInit?: (callback?: unknown) => unknown;
  lineWrap?: (n: number, callback?: unknown) => unknown;
  cutPaper?: (callback?: unknown) => unknown;
  /** Sunmi text size in printer points (larger ≈ easier to read). */
  setFontSize?: (size: number, callback?: unknown) => unknown;
  /** Stringly typed helpers some wrappers expose. */
  print?: (text: string) => unknown;
  /** PNG data URL or raw base64. Printed full width and centered. */
  printBitmap?: (data: string) => unknown;
};

declare global {
  interface Window {
    sunmiInnerPrinter?: SunmiPrinterBridge;
    sunmiPrinter?: SunmiPrinterBridge;
    SunmiPrinter?: SunmiPrinterBridge;
    printer?: SunmiPrinterBridge;
    /** Historical Sunmi demo bridge name from their HTML docs. */
    lee?: SunmiPrinterBridge & { funAndroid?: (text: string) => unknown };
    Android?: SunmiPrinterBridge & Record<string, unknown>;
  }
}

const BRIDGE_KEYS = [
  'sunmiInnerPrinter',
  'sunmiPrinter',
  'SunmiPrinter',
  'printer',
  'lee',
  'Android',
] as const;

export function detectSunmiPrinterBridge(): SunmiPrinterBridge | null {
  if (typeof window === 'undefined') return null;

  for (const key of BRIDGE_KEYS) {
    const candidate = window[key];
    if (!candidate || typeof candidate !== 'object') continue;
    const bridge = candidate as SunmiPrinterBridge & {
      funAndroid?: (text: string) => unknown;
    };
    if (
      typeof bridge.printText === 'function' ||
      typeof bridge.printOriginalText === 'function' ||
      typeof bridge.sendRawData === 'function' ||
      typeof bridge.sendRAWData === 'function' ||
      typeof bridge.print === 'function' ||
      typeof bridge.funAndroid === 'function'
    ) {
      return bridge;
    }
  }
  return null;
}

export function isSunmiPrinterAvailable(): boolean {
  return detectSunmiPrinterBridge() != null;
}

function envApiBase(name: string): string {
  if (typeof process === 'undefined') return '';
  return process.env[name]?.trim().replace(/\/$/, '') || '';
}

/** Prefer dedicated printer APK, then terminal bridge, then loopback default. */
function localPrintBaseUrls(): string[] {
  const urls = [
    envApiBase('NEXT_PUBLIC_KIOSK_PRINTER_API'),
    envApiBase('NEXT_PUBLIC_POS_TERMINAL_API'),
    'http://127.0.0.1:5055',
  ].filter(Boolean);
  return [...new Set(urls)];
}

/**
 * Chrome / stock WebView cannot talk to the Sunmi thermal printer.
 * Foodluk Printer or Kiosk Terminal exposes POST /print on loopback.
 */
async function printViaLocalApiOnce(
  base: string,
  text: string,
  timeoutMs = PRINTER_TRY_MS
): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      ok?: boolean;
    };
    if (res.ok && (body.ok === true || body.status === 'printed')) {
      return true;
    }
    console.warn('[kiosk-print] local /print failed', base, body);
    return false;
  } catch (e) {
    console.warn('[kiosk-print] local /print unreachable', base, e);
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

function rememberedPrinterBase(): string {
  try {
    return localStorage.getItem(PRINTER_BASE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

function rememberPrinterBase(base: string) {
  try {
    localStorage.setItem(PRINTER_BASE_KEY, base);
  } catch {
    // ignore
  }
}

async function printViaLocalApi(text: string): Promise<boolean> {
  const urls = localPrintBaseUrls();
  const remembered = rememberedPrinterBase();
  const ordered = [
    ...(remembered ? [remembered] : []),
    ...urls.filter((url) => url !== remembered),
  ];
  if (ordered.length === 0) return false;

  const [first, ...rest] = ordered;
  if (first && (await printViaLocalApiOnce(first, text, PRINTER_TRY_MS))) {
    rememberPrinterBase(first);
    return true;
  }

  const winner = await Promise.all(
    rest.map(async (base) =>
      (await printViaLocalApiOnce(base, text, PRINTER_TRY_MS)) ? base : ''
    )
  );
  const found = winner.find(Boolean);
  if (!found) return false;
  rememberPrinterBase(found);
  return true;
}

function readSnapshotRecord(): KioskReceiptSnapshot | null {
  try {
    const raw = sessionStorage.getItem(RECEIPT_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as KioskReceiptSnapshot;
    if (!snapshot || !Array.isArray(snapshot.items)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

function markSnapshotSent() {
  const snapshot = readSnapshotRecord();
  if (!snapshot) return;
  saveKioskReceiptSnapshot({ ...snapshot, sent: true });
}

function modelFromSnapshot(snapshot: KioskReceiptSnapshot): ReceiptModel {
  const regional = parseRestaurantRegionalSettings(snapshot.regional);
  const phone = isKioskSyntheticCustomerPhone(snapshot.customerPhone)
    ? null
    : snapshot.customerPhone;
  return {
    restaurantName: snapshot.restaurantName || 'Restaurant',
    logoUrl: null,
    branchName: snapshot.branchName,
    dateTime: snapshot.dateTime,
    ticketNo: snapshot.ticketNo,
    trackingId: snapshot.trackingId,
    paymentMethod: snapshot.paymentMethod,
    paymentState: snapshot.paymentState,
    tableName: snapshot.tableName,
    customerName: snapshot.customerName,
    customerPhone: phone,
    address: null,
    mode: snapshot.mode,
    cutleryRequested: false,
    note: snapshot.note,
    items: snapshot.items,
    subtotal: snapshot.subtotal,
    tax: snapshot.tax,
    discount: snapshot.discount,
    paidAmount: snapshot.paidAmount,
    change: snapshot.change,
    total: snapshot.total,
    money: (n: number) => formatCurrency(n, regional),
  };
}

function snapshotForOrder(orderId: string): ReceiptModel | null {
  const snapshot = readSnapshotRecord();
  if (!snapshot) return null;
  if (snapshot.orderId !== orderId && snapshot.trackingId !== orderId) return null;
  return modelFromSnapshot(snapshot);
}

export async function printKioskReceipt({
  slug,
  branchId,
  orderId,
}: PrintKioskReceiptParams): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const ready = snapshotForOrder(orderId);
    const model = ready ?? (await loadReceiptModel({ slug, branchId, orderId }));
    const plain = buildReceiptPlainText(model);

    const bridge = detectSunmiPrinterBridge();
    const inNativeKioskBridge =
      typeof window !== 'undefined' &&
      Boolean((window as Window & { __FOODLUK_SUNMI_BRIDGE__?: boolean })
        .__FOODLUK_SUNMI_BRIDGE__);

    if (bridge) {
      const printed = await printViaSunmiBridge(bridge, model);
      if (printed) {
        markSnapshotSent();
        return true;
      }
      console.warn(
        '[kiosk-print] Sunmi JS bridge present but print failed; skipping browser print'
      );
      // Chrome + separate Foodluk printer driver may still listen on loopback.
      // Native kiosk APK has no 5055 server — skip HTTP there.
      if (!inNativeKioskBridge && (await printViaLocalApi(plain))) {
        markSnapshotSent();
        return true;
      }
      return false;
    }

    // Sunmi K2 Chrome has no JS printer bridge — Foodluk Printer driver on this device.
    if (await printViaLocalApi(plain)) {
      markSnapshotSent();
      return true;
    }

    console.warn('[kiosk-print] no kiosk printer available');
    return false;
  } catch (e) {
    console.warn('[kiosk-print] receipt print failed', e);
    return false;
  }
}

async function loadReceiptModel({
  slug,
  branchId,
  orderId,
}: PrintKioskReceiptParams): Promise<ReceiptModel> {
  const [orderRes, restaurantRes, branchesRes] = await Promise.all([
    fetch(`/api/kiosk/order-tracking?orderId=${encodeURIComponent(orderId)}`, {
      cache: 'no-store',
    }),
    fetch(`/api/customer/restaurant?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    }),
    fetch(`/api/customer/branches?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    }),
  ]);

  const orderBody = (await orderRes.json().catch(() => ({}))) as {
    data?: {
      id: string;
      shortOrderId?: string;
      ticketNumber?: number | null;
      total?: number;
      taxAmount?: number;
      discountAmount?: number;
      branchName?: string | null;
      address?: string | null;
      tableLabel?: string | null;
      tableName?: string | null;
      cutleryRequested?: boolean;
      customerComment?: string | null;
      createdAt?: string;
      customer?: { name?: string | null; phone?: string | null } | null;
      payment?: { method?: string; status?: string; amount?: number } | null;
      items?: Array<{
        name: string;
        quantity: number;
        price: number;
        modifiers?: Array<{
          id: string;
          name: string;
          quantity: number;
          unitPrice: number;
          menuItemId?: string | null;
          groupName?: string | null;
        }>;
      }>;
    };
  };
  const restaurantBody = (await restaurantRes.json().catch(() => ({}))) as {
    data?: {
      name?: string | null;
      logoUrl?: string | null;
      regional?: Partial<RestaurantRegionalSettings>;
    } | null;
  };
  const branchesBody = (await branchesRes.json().catch(() => ({}))) as {
    data?: Array<{
      id?: string;
      urlId?: string;
      name?: string | null;
      timeZone?: string | null;
    }>;
  };

  const details = orderBody.data;
  const namedBranches = (branchesBody.data ?? []).filter((b) => b.name?.trim());
  const matchedBranch = namedBranches.find(
    (b) => b.id === branchId || b.urlId === branchId
  );
  const branchName =
    details?.branchName?.trim() ||
    matchedBranch?.name?.trim() ||
    (namedBranches.length === 1 ? namedBranches[0]?.name?.trim() : '') ||
    null;

  const restaurantName = restaurantBody.data?.name?.trim() || 'Restaurant';
  const storedLogo = restaurantBody.data?.logoUrl?.trim() || '';
  const logoUrl = storedLogo.startsWith('data:')
    ? storedLogo
    : `/api/customer/restaurant/media?slug=${encodeURIComponent(slug)}&kind=logo`;
  const regional = parseRestaurantRegionalSettings(restaurantBody.data?.regional);
  const money = (n: number) => formatCurrency(n, regional);
  const ticketNo = details?.ticketNumber ?? null;
  const trackingId = details?.shortOrderId ?? details?.id ?? orderId;
  const rawItems = details?.items ?? [];
  const items: ReceiptLineItem[] = rawItems.flatMap((it) =>
    receiptLinesFromOrderItem({
      name: it.name,
      quantity: it.quantity,
      lineTotal: it.price * it.quantity,
      modifiers: (it.modifiers ?? []).map((m) => ({
        name: m.name,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
        menuItemId: m.menuItemId ?? null,
        groupName: m.groupName ?? null,
      })),
    }).map((line) => ({
      name: line.name,
      quantity: line.qty,
      lineTotal: line.lineTotal,
    }))
  );
  const subtotal = items.reduce(
    (sum, it) => sum + (it.lineTotal != null ? it.lineTotal : 0),
    0
  );
  const total = details?.total ?? subtotal;
  const tax =
    details?.taxAmount != null && Number.isFinite(Number(details.taxAmount))
      ? Number(details.taxAmount)
      : Math.max(0, total - subtotal);
  const discount = Number(details?.discountAmount) || 0;
  const paymentMethod = details?.payment?.method ?? 'Kiosk';
  const paymentState = details?.payment?.status ?? 'pending';
  const paidAmount = details?.payment?.amount ?? total;
  const isCash = paymentMethod.toLowerCase().includes('cash');
  const change = isCash ? Math.max(0, paidAmount - total) : 0;
  const mode = fulfillmentMode(details?.address);

  const fromAddress = parseCustomerFromAddressSnapshot(details?.address);
  const customerName =
    details?.customer?.name?.trim() || fromAddress.name || null;
  const rawPhone =
    details?.customer?.phone?.trim() || fromAddress.phone || null;
  const customerPhone = isKioskSyntheticCustomerPhone(rawPhone)
    ? null
    : rawPhone;
  const tableName =
    details?.tableName?.trim() ||
    details?.tableLabel?.trim() ||
    parseTableFromAddressSnapshot(details?.address);
  const cutleryRequested =
    details?.cutleryRequested === true ||
    parseCutleryFromAddressSnapshot(details?.address);
  const note =
    details?.customerComment?.trim() ||
    parseNoteFromAddressSnapshot(details?.address) ||
    null;

  return {
    restaurantName,
    logoUrl,
    branchName,
    dateTime: formatBranchDateTime(
      details?.createdAt ?? new Date(),
      matchedBranch?.timeZone
    ),
    ticketNo,
    trackingId,
    paymentMethod,
    paymentState,
    tableName,
    customerName,
    customerPhone,
    address: details?.address?.trim() || null,
    mode,
    cutleryRequested,
    note,
    items,
    subtotal,
    tax,
    discount,
    paidAmount,
    change,
    total,
    money,
  };
}

function fulfillmentMode(address: string | null | undefined): string {
  const line = address
    ?.split('\n')
    .find((row) => row.trim().toLowerCase().startsWith('fulfillment:'));
  const value = line?.split(':').slice(1).join(':').trim();
  return value || 'kiosk';
}

const RECEIPT_WIDTH = 48;

/** Wrap on spaces. A tracking id has no spaces, so it stays in one piece. */
function wrapReceiptWords(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function buildReceiptPlainText(model: ReceiptModel): string {
  const pair = (left: string, right = '') => {
    if (!right) return wrapReceiptWords(left, RECEIPT_WIDTH);
    const gap = 1;
    const nameWidth = Math.max(12, RECEIPT_WIDTH - right.length - gap);
    const nameLines = wrapReceiptWords(left, nameWidth);
    return nameLines.map((name, index) => {
      if (index !== 0) return name;
      const spaces = Math.max(gap, RECEIPT_WIDTH - name.length - right.length);
      return `${name}${' '.repeat(spaces)}${right}`;
    });
  };
  const sep = '-'.repeat(RECEIPT_WIDTH);

  const lines: string[] = [];
  lines.push(centerText(model.restaurantName.toUpperCase(), RECEIPT_WIDTH));
  if (model.branchName) lines.push(centerText(model.branchName, RECEIPT_WIDTH));
  lines.push(centerText(model.dateTime, RECEIPT_WIDTH));
  lines.push(sep);
  if (model.ticketNo != null) {
    lines.push(centerText(`Token: #${model.ticketNo}`, RECEIPT_WIDTH));
    lines.push(sep);
  }
  const tracking = `Tracking ID: ${model.trackingId}`;
  if (tracking.length <= RECEIPT_WIDTH) lines.push(tracking);
  else {
    lines.push('Tracking ID:');
    lines.push(model.trackingId);
  }
  lines.push(`Mode: ${model.mode}`);
  lines.push(`Payment: ${model.paymentMethod}`);
  lines.push(`Status: ${model.paymentState}`);
  if (model.tableName && !model.customerName?.toLowerCase().endsWith(' customer')) {
    lines.push(`Table: ${model.tableName}`);
  }
  if (model.customerName) lines.push(`Customer: ${model.customerName}`);
  if (model.address) lines.push(`Address: ${model.address.replace(/\s*\n\s*/g, ' ')}`);
  lines.push(`Phone: ${model.customerPhone || 'N/A'}`);
  if (model.cutleryRequested) lines.push('Cutlery: yes');
  if (model.note) lines.push(`Note: ${model.note}`);
  lines.push(sep);
  lines.push(...pair('Item', 'Amt'));
  for (const it of model.items) {
    const qty = it.quantity != null && it.quantity > 0 ? String(it.quantity) : '';
    const amt = it.lineTotal != null ? model.money(it.lineTotal) : '';
    lines.push(...pair(it.name, [qty, amt].filter(Boolean).join('  ')));
  }
  if (model.items.length === 0) lines.push('No items');
  lines.push(sep);
  lines.push(...pair('Subtotal', model.money(model.subtotal)));
  lines.push(...pair('Tax', model.money(model.tax)));
  lines.push(...pair('Discount', model.money(model.discount)));
  lines.push(...pair('Paid', model.money(model.paidAmount)));
  lines.push(...pair('Change', model.money(model.change)));
  lines.push(...pair('TOTAL', model.money(model.total)));
  lines.push(sep);
  lines.push(centerText('Thank you!', 48));
  lines.push('');
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

function centerText(text: string, width: number): string {
  const t = text.trim().slice(0, width);
  if (t.length >= width) return t;
  const pad = Math.floor((width - t.length) / 2);
  return `${' '.repeat(pad)}${t}`;
}

/** ESC/POS: partial cut (leave a bit attached). */
const ESC_POS_CUT = [0x1d, 0x56, 0x41, 0x00] as const;
/** ESC/POS: feed n lines. */
function escPosFeed(lines: number): number[] {
  return [0x1b, 0x64, Math.max(0, Math.min(255, lines))];
}

function receiptForBitmap(model: ReceiptModel): ThermalBitmapReceipt {
  const isDineInDisplayName =
    !!model.customerName &&
    model.customerName.toLowerCase().endsWith(' customer');
  const meta: Array<{ label: string; value: string }> = [];
  meta.push({ label: 'Tracking ID', value: model.trackingId });
  meta.push({ label: 'Mode', value: model.mode });
  meta.push({ label: 'Payment', value: model.paymentMethod });
  meta.push({ label: 'Status', value: model.paymentState });
  if (model.tableName && !isDineInDisplayName) {
    meta.push({ label: 'Table', value: model.tableName });
  }
  if (model.customerName) meta.push({ label: 'Customer', value: model.customerName });
  if (model.address) {
    meta.push({ label: 'Address', value: model.address.replace(/\s*\n\s*/g, ' ') });
  }
  meta.push({ label: 'Phone', value: model.customerPhone || 'N/A' });
  if (model.cutleryRequested) meta.push({ label: 'Cutlery', value: 'yes' });
  if (model.note) meta.push({ label: 'Note', value: model.note });

  const items = model.items.map((it) => ({
    name: it.name,
    quantity: it.quantity != null && it.quantity > 0 ? it.quantity : undefined,
    amount: it.lineTotal != null ? model.money(it.lineTotal) : '',
    indent:
      it.name.startsWith('↳') ||
      it.name.startsWith('-') ||
      it.quantity == null,
  }));

  return {
    logoUrl: model.logoUrl,
    restaurantName: model.restaurantName,
    branchName: model.branchName,
    dateTime: model.dateTime,
    ticket: model.ticketNo != null ? `Token: #${model.ticketNo}` : null,
    meta,
    items,
    totals: [
      { label: 'Subtotal', value: model.money(model.subtotal) },
      { label: 'Tax', value: model.money(model.tax) },
      { label: 'Discount', value: model.money(model.discount) },
      { label: 'Paid', value: model.money(model.paidAmount) },
      { label: 'Change', value: model.money(model.change) },
      { label: 'Total', value: model.money(model.total), bold: true },
    ],
    footer: 'Thank you!',
    widthDots: PAPER_80MM_DOTS,
    variant: 'kiosk',
  };
}

async function finishSunmiPrint(
  bridge: SunmiPrinterBridge & { funAndroid?: (text: string) => unknown }
) {
  if (typeof bridge.lineWrap === 'function') {
    try {
      bridge.lineWrap(3);
    } catch {
      // ignore
    }
  }
  if (typeof bridge.cutPaper === 'function') {
    try {
      bridge.cutPaper();
    } catch {
      // ignore
    }
  } else {
    const send = bridge.sendRawData ?? bridge.sendRAWData;
    if (typeof send === 'function') {
      try {
        send([...escPosFeed(3), ...ESC_POS_CUT]);
      } catch {
        // ignore cut failures — text may already have printed
      }
    }
  }
}

async function printViaSunmiBridge(
  bridge: SunmiPrinterBridge & { funAndroid?: (text: string) => unknown },
  model: ReceiptModel
): Promise<boolean> {
  if (typeof bridge.printBitmap === 'function') {
    try {
      if (typeof bridge.printerInit === 'function') {
        try {
          bridge.printerInit();
        } catch {
          // ignore
        }
      }
      const png = await renderThermalReceiptPng(receiptForBitmap(model));
      bridge.printBitmap(png);
      await finishSunmiPrint(bridge);
      return true;
    } catch (e) {
      console.warn('[kiosk-print] bitmap receipt failed, using text', e);
    }
  }

  const text = buildReceiptPlainText(model);

  try {
    if (typeof bridge.printerInit === 'function') {
      try {
        bridge.printerInit();
      } catch {
        // some bridges require a callback; ignore init failures
      }
    }

    // Default Sunmi text is ~24pt; ~48pt is roughly double for text fallbacks.
    if (typeof bridge.setFontSize === 'function') {
      try {
        bridge.setFontSize(48);
      } catch {
        // ignore — not all bridges implement this
      }
    }

    if (typeof bridge.printText === 'function') {
      bridge.printText(`${text}\n`);
    } else if (typeof bridge.printOriginalText === 'function') {
      bridge.printOriginalText(`${text}\n`);
    } else if (typeof bridge.print === 'function') {
      bridge.print(`${text}\n`);
    } else if (typeof bridge.funAndroid === 'function') {
      bridge.funAndroid(`${text}\n`);
    } else if (
      typeof bridge.sendRawData === 'function' ||
      typeof bridge.sendRAWData === 'function'
    ) {
      const encoder = new TextEncoder();
      const bytes = Array.from(encoder.encode(`${text}\n`));
      const send = bridge.sendRawData ?? bridge.sendRAWData;
      send?.(bytes);
    } else {
      return false;
    }

    await finishSunmiPrint(bridge);

    return true;
  } catch (e) {
    console.warn('[kiosk-print] Sunmi bridge print failed', e);
    return false;
  }
}

