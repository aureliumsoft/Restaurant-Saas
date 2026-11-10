import { formatCurrency } from '@/lib/format-money';
import {
  DEFAULT_RESTAURANT_REGIONAL,
  parseRestaurantRegionalSettings,
  type RestaurantRegionalSettings,
} from '@/lib/restaurant-regional';
import type { PosShiftPayload } from '@/lib/pos-shift';
import { isCanceledOrderStatus } from '@/lib/sales-order-status';
import {
  buildThermalReceiptHeaderHtml,
  escapeHtml,
  getThermalReceiptDocumentCss,
} from '@/lib/thermal-receipt-html';

function formatSignedMoney(
  n: number,
  regional: RestaurantRegionalSettings
) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${formatCurrency(Math.abs(n), regional)}`;
}

/** Extra thermal styles for shift end (on top of shared 80mm receipt CSS). */
function getThermalShiftPrintCss(): string {
  return `
    ${getThermalReceiptDocumentCss()}
    .section-title {
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      text-align: left;
      margin: 4px 0 2px;
    }
    .shift-title {
      font-weight: 800;
      letter-spacing: 0.04em;
      margin: 2px 0;
      text-align: center;
      text-transform: uppercase;
    }
    .totals .total-row {
      font-weight: 800;
      border-top: 1px solid #111;
      margin-top: 4px;
      padding-top: 4px;
    }
    table.shift-orders th, table.shift-orders td {
      font-size: 9px;
      padding: 2px 0;
    }
    table.shift-orders th.amt, table.shift-orders td.amt {
      text-align: right;
      white-space: nowrap;
      width: 72px;
    }
    table.shift-orders th.pay, table.shift-orders td.pay {
      width: 48px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    tr.canceled td { color: #666; }
    tr.canceled td.amt { text-decoration: line-through; }
    .cancel-tag {
      display: inline-block;
      margin-left: 2px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-decoration: none;
    }
    .note { text-align: left; margin-top: 4px; }
  `;
}

export type PrintPosShiftRecordOptions = {
  shift: PosShiftPayload;
  cashLeftInLocker: number | null;
  brandName: string;
  branchName?: string | null;
  logoUrl?: string | null;
  currencyCode?: string;
  countryCode?: string;
};

export function printPosShiftRecord(options: PrintPosShiftRecordOptions) {
  if (typeof window === 'undefined') return false;

  const {
    shift,
    cashLeftInLocker,
    brandName,
    branchName,
    logoUrl,
    currencyCode,
    countryCode,
  } = options;
  const regional = parseRestaurantRegionalSettings({
    currencyCode: currencyCode ?? DEFAULT_RESTAURANT_REGIONAL.currencyCode,
    countryCode: countryCode ?? DEFAULT_RESTAURANT_REGIONAL.countryCode,
  });
  const money = (n: number) => formatCurrency(n, regional);
  const expected = shift.expectedCashInLocker;
  const leftInLocker = cashLeftInLocker;
  const difference =
    leftInLocker != null && Number.isFinite(leftInLocker)
      ? leftInLocker - expected
      : null;

  const orderRows = shift.orders
    .map((order) => {
      const ticket =
        order.ticketNumber != null
          ? `#${String(order.ticketNumber).padStart(2, '0')}`
          : order.shortOrderId;
      const canceled = isCanceledOrderStatus(order.status);
      const time = new Date(order.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const pay = (order.paymentMethod ?? '—').slice(0, 6);
      return `<tr class="${canceled ? 'canceled' : ''}">
        <td>${escapeHtml(ticket)}${canceled ? ' <span class="cancel-tag">X</span>' : ''}</td>
        <td>${escapeHtml(time)}</td>
        <td class="pay">${escapeHtml(pay)}</td>
        <td class="amt">${escapeHtml(money(order.total))}</td>
      </tr>`;
    })
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
    <meta charset="utf-8" />
    <title>Shift Record — ${escapeHtml(brandName)}</title>
    <style>${getThermalShiftPrintCss()}</style>
  </head>
  <body>
    <div class="r">
      ${receiptHeader}
      <div class="sep"></div>
      <div class="shift-title">Shift end record</div>
      <div class="sep"></div>

      <div class="section-title">Shift details</div>
      <div class="receipt-line"><strong>Started:</strong> ${escapeHtml(new Date(shift.startedAt).toLocaleString())}</div>
      <div class="receipt-line"><strong>Opened by:</strong> ${escapeHtml(shift.openedByName ?? '—')}</div>
      <div class="receipt-line"><strong>Status:</strong> ${escapeHtml(shift.status)}</div>
      <div class="receipt-line"><strong>Orders:</strong> ${shift.orderCount}</div>

      <div class="sep"></div>
      <div class="section-title">Shift orders</div>
      <table class="shift-orders">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Time</th>
            <th class="pay">Pay</th>
            <th class="amt">Amt</th>
          </tr>
        </thead>
        <tbody>
          ${
            orderRows ||
            '<tr><td colspan="4" class="muted">No completed orders.</td></tr>'
          }
        </tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Total sales</span><span>${escapeHtml(money(shift.totalSales))}</span></div>
      </div>

      <div class="sep"></div>
      <div class="section-title">Cash reconciliation</div>
      <div class="totals">
        <div><span>Previous cash left</span><span>${shift.previousClosingCashInLocker != null ? escapeHtml(money(shift.previousClosingCashInLocker)) : '—'}</span></div>
        ${
          shift.previousShiftEndedAt
            ? `<div class="muted"><span>Last shift ended</span><span>${escapeHtml(new Date(shift.previousShiftEndedAt).toLocaleString())}</span></div>`
            : ''
        }
        <div><span>Cash sales</span><span>${escapeHtml(money(shift.cashSalesTotal))}</span></div>
        <div><span>Card / other</span><span>${escapeHtml(money(shift.nonCashSalesTotal))}</span></div>
        <div><span>Expected in locker</span><span>${escapeHtml(money(expected))}</span></div>
        <div><span>Cash left in locker</span><span>${leftInLocker != null ? escapeHtml(money(leftInLocker)) : '—'}</span></div>
        <div class="total-row"><span>Difference</span><span>${difference != null ? escapeHtml(formatSignedMoney(difference, regional)) : '—'}</span></div>
      </div>
      <div class="note muted">Difference = cash left − expected.</div>

      <div class="sep"></div>
      <div class="center">End of shift record</div>
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
