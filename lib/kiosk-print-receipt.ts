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

export async function printKioskReceipt({
  slug,
  branchId,
  orderId,
}: PrintKioskReceiptParams): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
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
    const displayTrackingId =
      details?.shortOrderId ?? details?.id ?? orderId;
    const items = details?.items ?? [];
    const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
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
    const isDineInDisplayName =
      !!customerName && customerName.toLowerCase().endsWith(' customer');
    const metaLines = [
      tableName && !isDineInDisplayName
        ? `<div class="receipt-line"><strong>Table:</strong> ${escapeHtml(tableName)}</div>`
        : '',
      customerName
        ? `<div class="receipt-line"><strong>Customer:</strong> ${escapeHtml(customerName)}</div>`
        : '',
      customerPhone
        ? `<div class="receipt-line"><strong>Phone:</strong> ${escapeHtml(customerPhone)}</div>`
        : '',
    ]
      .filter(Boolean)
      .join('');

    const rows = items
      .map((it) => {
        const modifierRows = (it.modifiers ?? [])
          .map(
            (m) => `<tr>
<td style="padding-left:10px;color:#555;">${escapeHtml(m.name)}</td>
<td class="qty">${m.quantity}</td>
<td class="amt">${escapeHtml(money(m.unitPrice * m.quantity))}</td>
</tr>`
          )
          .join('');
        return `<tr>
<td>${escapeHtml(it.name)}</td>
<td class="qty">${it.quantity}</td>
<td class="amt">${escapeHtml(money(it.price * it.quantity))}</td>
</tr>${modifierRows}`;
      })
      .join('');

    const receiptHeader = buildThermalReceiptHeaderHtml({
      logoUrl,
      brandName: restaurantName,
      branchName,
      dateTime: details?.createdAt
        ? new Date(details.createdAt).toLocaleString()
        : new Date().toLocaleString(),
    });

    const html = `<!doctype html>
<html>
<head>
  <title>Kiosk Ticket</title>
  <style>${getThermalReceiptDocumentCss()}</style>
</head>
<body>
  <div class="r">
    ${receiptHeader}
    <div class="sep"></div>
    ${ticketNo != null ? `<div class="receipt-line"><strong>Ticket:</strong> #${ticketNo}</div>` : ''}
    <div class="receipt-line"><strong>Tracking:</strong> ${escapeHtml(displayTrackingId)}</div>
    <div class="receipt-line"><strong>Payment:</strong> ${escapeHtml(paymentMethod)}</div>
    <div class="receipt-line"><strong>Status:</strong> ${escapeHtml(paymentState)}</div>
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
      <div><span>Subtotal</span><span>${escapeHtml(money(subtotal))}</span></div>
      <div><span>Tax</span><span>${escapeHtml(money(tax))}</span></div>
      <div><span>Paid</span><span>${escapeHtml(money(paidAmount))}</span></div>
      <div class="grand"><span>Total</span><span>${escapeHtml(money(total))}</span></div>
    </div>
    <div class="sep"></div>
    <div class="center muted">Thank you!</div>
  </div>
</body>
</html>`;

    await printHtmlInHiddenFrame(html);
  } catch {
    window.print();
  }
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
