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
import {
  buildThermalReceiptHeaderHtml,
  escapeHtml,
  getThermalReceiptDocumentCss,
} from '@/lib/thermal-receipt-html';
import {
  PAPER_80MM_DOTS,
  renderThermalReceiptPng,
} from '@/lib/thermal-receipt-bitmap';

export type PrintKioskReceiptParams = {
  slug: string;
  branchId: string;
  orderId: string;
};

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
  text: string
): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8_000);
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

async function printViaLocalApi(text: string): Promise<boolean> {
  for (const base of localPrintBaseUrls()) {
    if (await printViaLocalApiOnce(base, text)) return true;
  }
  return false;
}

export async function printKioskReceipt({
  slug,
  branchId,
  orderId,
}: PrintKioskReceiptParams): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const model = await loadReceiptModel({ slug, branchId, orderId });
    const plain = buildReceiptPlainText(model);

    const bridge = detectSunmiPrinterBridge();
    const inNativeKioskBridge =
      typeof window !== 'undefined' &&
      Boolean((window as Window & { __FOODLUK_SUNMI_BRIDGE__?: boolean })
        .__FOODLUK_SUNMI_BRIDGE__);

    if (bridge) {
      const printed = await printViaSunmiBridge(bridge, model);
      if (printed) return;
      console.warn(
        '[kiosk-print] Sunmi JS bridge present but print failed; skipping browser print'
      );
      // Chrome + separate Foodluk printer driver may still listen on loopback.
      // Native kiosk APK has no 5055 server — skip HTTP there.
      if (!inNativeKioskBridge && (await printViaLocalApi(plain))) return;
      return;
    }

    // Sunmi K2 Chrome has no JS printer bridge — optional Foodluk Printer driver APK.
    if (await printViaLocalApi(plain)) return;

    await printHtmlInHiddenFrame(buildReceiptHtml(model));
  } catch (e) {
    console.warn('[kiosk-print] receipt print failed', e);
    // Browser print is desktop-only; skip inside native kiosk WebView bridge.
    const inNativeKioskBridge =
      typeof window !== 'undefined' &&
      Boolean((window as Window & { __FOODLUK_SUNMI_BRIDGE__?: boolean })
        .__FOODLUK_SUNMI_BRIDGE__);
    if (inNativeKioskBridge) return;
    try {
      window.print();
    } catch {
      // ignore
    }
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
    data?: Array<{ id?: string; name?: string | null }>;
  };

  const details = orderBody.data;
  const branchName =
    details?.branchName?.trim() ||
    branchesBody.data?.find((b) => b.id === branchId)?.name?.trim() ||
    branchesBody.data?.find((b) => b.name?.trim())?.name?.trim() ||
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
    dateTime: details?.createdAt
      ? new Date(details.createdAt).toLocaleString()
      : new Date().toLocaleString(),
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

function buildReceiptPlainText(model: ReceiptModel): string {
  const line = (left: string, right = '') => {
    const width = 48;
    const l = left.slice(0, width);
    if (!right) return l;
    const r = right.slice(0, width);
    const gap = Math.max(1, width - l.length - r.length);
    return `${l}${' '.repeat(gap)}${r}`;
  };
  const sep = '-'.repeat(48);

  const lines: string[] = [];
  lines.push(centerText(model.restaurantName.toUpperCase(), 48));
  if (model.branchName) lines.push(centerText(model.branchName, 48));
  lines.push(centerText(model.dateTime, 48));
  lines.push(sep);
  if (model.ticketNo != null) {
    lines.push(centerText(`Ticket: #${model.ticketNo}`, 48));
    lines.push(sep);
  }
  lines.push(`Tracking ID: ${model.trackingId}`);
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
  lines.push(line('Item', 'Amt'));
  for (const it of model.items) {
    const qty = it.quantity != null && it.quantity > 0 ? String(it.quantity) : '';
    const amt = it.lineTotal != null ? model.money(it.lineTotal) : '';
    lines.push(line(it.name, [qty, amt].filter(Boolean).join('  ')));
  }
  if (model.items.length === 0) lines.push('No items');
  lines.push(sep);
  lines.push(line('Subtotal', model.money(model.subtotal)));
  lines.push(line('Tax', model.money(model.tax)));
  lines.push(line('Discount', model.money(model.discount)));
  lines.push(line('Paid', model.money(model.paidAmount)));
  lines.push(line('Change', model.money(model.change)));
  lines.push(line('TOTAL', model.money(model.total)));
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

function receiptForBitmap(model: ReceiptModel) {
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
    ticket: model.ticketNo != null ? `Ticket: #${model.ticketNo}` : null,
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

function buildReceiptHtml(model: ReceiptModel): string {
  const isDineInDisplayName =
    !!model.customerName &&
    model.customerName.toLowerCase().endsWith(' customer');
  const metaLines = [
    model.tableName && !isDineInDisplayName
      ? `<div class="receipt-line"><strong>Table:</strong> ${escapeHtml(model.tableName)}</div>`
      : '',
    model.customerName
      ? `<div class="receipt-line"><strong>Customer:</strong> ${escapeHtml(model.customerName)}</div>`
      : '',
    model.address
      ? `<div class="receipt-line"><strong>Address:</strong> ${escapeHtml(model.address.replace(/\s*\n\s*/g, ' '))}</div>`
      : '',
    `<div class="receipt-line"><strong>Phone:</strong> ${escapeHtml(model.customerPhone || 'N/A')}</div>`,
  ]
    .filter(Boolean)
    .join('');

  const rows = model.items
    .map((it) => {
      const isMod =
        it.name.startsWith('↳') ||
        it.name.startsWith('-') ||
        it.quantity == null;
      const qtyCell =
        it.quantity != null && it.quantity > 0 ? String(it.quantity) : '';
      const amtCell =
        it.lineTotal != null ? escapeHtml(model.money(it.lineTotal)) : '';
      return `<tr>
<td${isMod ? ' class="mod"' : ''}>${escapeHtml(it.name)}</td>
<td class="qty">${qtyCell}</td>
<td class="amt">${amtCell}</td>
</tr>`;
    })
    .join('');

  const receiptHeader = buildThermalReceiptHeaderHtml({
    logoUrl: model.logoUrl,
    brandName: model.restaurantName,
    branchName: model.branchName,
    dateTime: model.dateTime,
  });

  const extras = [
    model.cutleryRequested
      ? `<div class="receipt-line"><strong>Cutlery:</strong> yes</div>`
      : '',
    model.note
      ? `<div class="receipt-line"><strong>Note:</strong> ${escapeHtml(model.note)}</div>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!doctype html>
<html>
<head>
  <title>Kiosk Ticket</title>
  <style>${getThermalReceiptDocumentCss()}</style>
</head>
<body>
  <div class="r">
    ${receiptHeader}
    <div class="sep"></div>
    ${model.ticketNo != null ? `<div class="receipt-ticket">Ticket: #${model.ticketNo}</div><div class="sep"></div>` : ''}
    <div class="receipt-line"><strong>Tracking ID:</strong> ${escapeHtml(model.trackingId)}</div>
    <div class="receipt-line"><strong>Mode:</strong> ${escapeHtml(model.mode)}</div>
    <div class="receipt-line"><strong>Payment:</strong> ${escapeHtml(model.paymentMethod)}</div>
    <div class="receipt-line"><strong>Status:</strong> ${escapeHtml(model.paymentState)}</div>
    ${metaLines}
    ${extras}
    <div class="sep"></div>
    <table>
      <thead>
        <tr><th>Item</th><th class="qty">Qty</th><th class="amt">Amt</th></tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="3" class="muted">No items</td></tr>'}</tbody>
    </table>
    <div class="sep"></div>
    <div class="totals">
      <div><span>Subtotal</span><span>${escapeHtml(model.money(model.subtotal))}</span></div>
      <div><span>Tax</span><span>${escapeHtml(model.money(model.tax))}</span></div>
      <div><span>Discount</span><span>${escapeHtml(model.money(model.discount))}</span></div>
      <div><span>Paid</span><span>${escapeHtml(model.money(model.paidAmount))}</span></div>
      <div><span>Change</span><span>${escapeHtml(model.money(model.change))}</span></div>
      <div class="grand"><span>Total</span><span>${escapeHtml(model.money(model.total))}</span></div>
    </div>
    <div class="sep"></div>
    <div class="center muted">Thank you!</div>
  </div>
</body>
</html>`;
}

function printHtmlInHiddenFrame(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.setTimeout(() => {
        frame.remove();
        resolve();
      }, 300);
    };

    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      cleanup();
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
        cleanup();
      }
    };
  });
}
