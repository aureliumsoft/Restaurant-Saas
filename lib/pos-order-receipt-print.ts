import { formatCurrency } from '@/lib/format-money';
import {
  DEFAULT_RESTAURANT_REGIONAL,
  RestaurantCountryCode,
  RestaurantCurrencyCode,
  parseRestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import {
  buildThermalReceiptHeaderHtml,
  escapeHtml,
  getThermalReceiptDocumentCss,
} from '@/lib/thermal-receipt-html';

export type PosOrderReceiptLine = {
  name: string;
  qty: number;
  lineTotal: number;
};

export type PrintPosOrderReceiptOptions = {
  orderRef: string;
  ticketNumber?: number | null;
  brandName: string;
  branchName?: string | null;
  logoUrl?: string | null;
  orderMode?: string;
  paymentMethodLabel: string;
  tableLabel?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  address?: string | null;
  note?: string | null;
  lines: PosOrderReceiptLine[];
  subtotal: number;
  serviceChargeAmount?: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  paidAmount: number;
  paymentMode?: string;
  currencyCode?: string;
  countryCode?: string;
};

export function printPosOrderReceipt(options: PrintPosOrderReceiptOptions) {
  if (typeof window === 'undefined') return false;

  const {
    orderRef,
    ticketNumber,
    brandName,
    branchName,
    logoUrl,
    orderMode = 'pos',
    paymentMethodLabel,
    tableLabel,
    customerName,
    customerPhone,
    address,
    note,
    lines,
    subtotal,
    serviceChargeAmount = 0,
    taxAmount,
    discountAmount,
    grandTotal,
    paidAmount,
    paymentMode = 'cash',
    currencyCode = DEFAULT_RESTAURANT_REGIONAL.currencyCode,
    countryCode = DEFAULT_RESTAURANT_REGIONAL.countryCode,
  } = options;

  const regional = parseRestaurantRegionalSettings({
    currencyCode: currencyCode as RestaurantCurrencyCode,
    countryCode: countryCode as RestaurantCountryCode,
  });
  const money = (n: number) => formatCurrency(n, regional);

  const changeAmount =
    paymentMode === 'cash' ? Math.max(0, paidAmount - grandTotal) : 0;

  const rows = lines
    .map(
      (line) => `<tr>
          <td>${escapeHtml(line.name)}</td>
          <td class="qty">${line.qty}</td>
          <td class="amt">${escapeHtml(money(line.lineTotal))}</td>
        </tr>`
    )
    .join('');

  const receiptHeader = buildThermalReceiptHeaderHtml({
    logoUrl,
    brandName,
    branchName,
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
      ${ticketNumber != null ? `<div class="receipt-line"><strong>Ticket:</strong> #${ticketNumber}</div>` : ''}
      <div class="receipt-line"><strong>Tracking ID:</strong> ${escapeHtml(orderRef)}</div>
      <div class="receipt-line"><strong>Mode:</strong> ${escapeHtml(orderMode)}</div>
      <div class="receipt-line"><strong>Payment:</strong> ${escapeHtml(paymentMethodLabel)}</div>
      <div class="receipt-line"><strong>Status:</strong> paid</div>
      ${tableLabel ? `<div class="receipt-line"><strong>Table:</strong> ${escapeHtml(tableLabel)}</div>` : ''}
      ${customerName ? `<div class="receipt-line"><strong>Customer:</strong> ${escapeHtml(customerName)}</div>` : ''}
      ${customerPhone ? `<div class="receipt-line"><strong>Phone:</strong> ${escapeHtml(customerPhone)}</div>` : ''}
      ${address ? `<div class="receipt-line"><strong>Address:</strong> ${escapeHtml(address)}</div>` : ''}
      ${note ? `<div class="receipt-line"><strong>Note:</strong> ${escapeHtml(note)}</div>` : ''}
      <div class="sep"></div>
      <table>
        <thead>
          <tr><th>Item</th><th class="qty">Qty</th><th class="amt">Amt</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sep"></div>
      <div class="totals">
        <div><span>Subtotal</span><span>${escapeHtml(money(subtotal))}</span></div>
        ${serviceChargeAmount > 0 ? `<div><span>Service charge</span><span>${escapeHtml(money(serviceChargeAmount))}</span></div>` : ''}
        <div><span>Tax</span><span>${escapeHtml(money(taxAmount))}</span></div>
        <div><span>Discount</span><span>${escapeHtml(money(discountAmount))}</span></div>
        <div><span>Paid</span><span>${escapeHtml(money(paidAmount))}</span></div>
        <div><span>Change</span><span>${escapeHtml(money(changeAmount))}</span></div>
        <div class="grand"><span>Total</span><span>${escapeHtml(money(grandTotal))}</span></div>
      </div>
      <div class="sep"></div>
      <div class="center">Thank you!</div>
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
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => frame.remove(), 1000);
    }
  };

  return true;
}
