import { formatCurrency } from '@/lib/format-money';
import {
  parseCustomerFromAddressSnapshot,
  parseTableFromAddressSnapshot,
} from '@/lib/order-fulfillment';
import {
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import { isKioskSyntheticCustomerPhone } from '@/lib/kiosk-customer';
import {
  buildThermalReceiptHeaderHtml,
  escapeHtml,
  getThermalReceiptDocumentCss,
} from '@/lib/thermal-receipt-html';

export type PrintKioskReceiptParams = {
  slug: string;
  branchId: string;
  orderId: string;
};

type ReceiptLineItem = {
  name: string;
  quantity: number;
  lineTotal: number;
  modifiers: Array<{ name: string; quantity: number; lineTotal: number }>;
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
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  paidAmount: number;
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
    if (bridge) {
      const printed = await printViaSunmiBridge(bridge, model);
      if (printed) return;
    }

    // Sunmi K2 Chrome has no JS printer bridge — Foodluk Printer / Terminal APK does.
    if (await printViaLocalApi(plain)) return;

    await printHtmlInHiddenFrame(buildReceiptHtml(model));
  } catch {
    // Last resort: browser print dialog (desktop only; useless on bare K2 WebView).
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
      address?: string | null;
      tableLabel?: string | null;
      tableName?: string | null;
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

  const branchName =
    branchesBody.data?.find((b) => b.id === branchId)?.name?.trim() ??
    branchesBody.data?.find((b) => b.name?.trim())?.name?.trim() ??
    null;

  const details = orderBody.data;
  const restaurantName = restaurantBody.data?.name?.trim() || 'Restaurant';
  const logoUrl = restaurantBody.data?.logoUrl ?? null;
  const regional = parseRestaurantRegionalSettings(restaurantBody.data?.regional);
  const money = (n: number) => formatCurrency(n, regional);
  const ticketNo = details?.ticketNumber ?? null;
  const trackingId = details?.shortOrderId ?? details?.id ?? orderId;
  const rawItems = details?.items ?? [];
  const items: ReceiptLineItem[] = rawItems.map((it) => ({
    name: it.name,
    quantity: it.quantity,
    lineTotal: it.price * it.quantity,
    modifiers: (it.modifiers ?? []).map((m) => ({
      name: m.name,
      quantity: m.quantity,
      lineTotal: m.unitPrice * m.quantity,
    })),
  }));
  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const total = details?.total ?? subtotal;
  const tax = Math.max(0, total - subtotal);
  const paymentMethod = details?.payment?.method ?? 'Kiosk';
  const paymentState = details?.payment?.status ?? 'pending';
  const paidAmount = details?.payment?.amount ?? total;

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
    items,
    subtotal,
    tax,
    paidAmount,
    total,
    money,
  };
}

function buildReceiptPlainText(model: ReceiptModel): string {
  const line = (left: string, right = '') => {
    const width = 32;
    const l = left.slice(0, width);
    if (!right) return l;
    const r = right.slice(0, width);
    const gap = Math.max(1, width - l.length - r.length);
    return `${l}${' '.repeat(gap)}${r}`;
  };
  const sep = '-'.repeat(32);

  const lines: string[] = [];
  lines.push(centerText(model.restaurantName, 32));
  if (model.branchName) lines.push(centerText(model.branchName, 32));
  lines.push(centerText(model.dateTime, 32));
  lines.push(sep);
  if (model.ticketNo != null) lines.push(`Ticket: #${model.ticketNo}`);
  lines.push(`Tracking: ${model.trackingId}`);
  lines.push(`Payment: ${model.paymentMethod}`);
  lines.push(`Status: ${model.paymentState}`);
  if (model.tableName && !model.customerName?.toLowerCase().endsWith(' customer')) {
    lines.push(`Table: ${model.tableName}`);
  }
  if (model.customerName) lines.push(`Customer: ${model.customerName}`);
  if (model.customerPhone) lines.push(`Phone: ${model.customerPhone}`);
  lines.push(sep);
  lines.push(line('Item', 'Amt'));
  for (const it of model.items) {
    lines.push(line(`${it.quantity}x ${it.name}`, model.money(it.lineTotal)));
    for (const m of it.modifiers) {
      lines.push(
        line(`  ${m.quantity}x ${m.name}`, model.money(m.lineTotal))
      );
    }
  }
  if (model.items.length === 0) lines.push('No items');
  lines.push(sep);
  lines.push(line('Subtotal', model.money(model.subtotal)));
  lines.push(line('Tax', model.money(model.tax)));
  lines.push(line('Paid', model.money(model.paidAmount)));
  lines.push(line('TOTAL', model.money(model.total)));
  lines.push(sep);
  lines.push(centerText('Thank you!', 32));
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

async function printViaSunmiBridge(
  bridge: SunmiPrinterBridge & { funAndroid?: (text: string) => unknown },
  model: ReceiptModel
): Promise<boolean> {
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

    // Prefer native helpers when present; otherwise send ESC/POS feed + cut.
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
    model.customerPhone
      ? `<div class="receipt-line"><strong>Phone:</strong> ${escapeHtml(model.customerPhone)}</div>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const rows = model.items
    .map((it) => {
      const modifierRows = it.modifiers
        .map(
          (m) => `<tr>
<td style="padding-left:10px;color:#555;">${escapeHtml(m.name)}</td>
<td class="qty">${m.quantity}</td>
<td class="amt">${escapeHtml(model.money(m.lineTotal))}</td>
</tr>`
        )
        .join('');
      return `<tr>
<td>${escapeHtml(it.name)}</td>
<td class="qty">${it.quantity}</td>
<td class="amt">${escapeHtml(model.money(it.lineTotal))}</td>
</tr>${modifierRows}`;
    })
    .join('');

  const receiptHeader = buildThermalReceiptHeaderHtml({
    logoUrl: model.logoUrl,
    brandName: model.restaurantName,
    branchName: model.branchName,
    dateTime: model.dateTime,
  });

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
    ${model.ticketNo != null ? `<div class="receipt-line"><strong>Ticket:</strong> #${model.ticketNo}</div>` : ''}
    <div class="receipt-line"><strong>Tracking:</strong> ${escapeHtml(model.trackingId)}</div>
    <div class="receipt-line"><strong>Payment:</strong> ${escapeHtml(model.paymentMethod)}</div>
    <div class="receipt-line"><strong>Status:</strong> ${escapeHtml(model.paymentState)}</div>
    ${metaLines}
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
      <div><span>Paid</span><span>${escapeHtml(model.money(model.paidAmount))}</span></div>
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
