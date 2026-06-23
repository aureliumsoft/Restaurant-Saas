import type { PosShiftPayload } from '@/lib/pos-shift';
import { isCanceledOrderStatus } from '@/lib/sales-order-status';
import { escapeHtml } from '@/lib/thermal-receipt-html';

function formatMoney(n: number) {
  return n.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}€${formatMoney(Math.abs(n))}`;
}

function getA4ShiftPrintCss(): string {
  return `
    @page { size: A4 portrait; margin: 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 12px;
      line-height: 1.45;
    }
    .page { width: 100%; max-width: 180mm; margin: 0 auto; }
    .header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
    .logo {
      width: 56px; height: 56px; object-fit: cover;
      border-radius: 999px; border: 1px solid #ddd;
    }
    .header-text { flex: 1; }
    .brand { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .branch { font-size: 13px; color: #555; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #666; margin: 0; }
    .title {
      font-size: 18px; font-weight: 700; text-align: center;
      margin: 0 0 16px; letter-spacing: 0.04em;
    }
    .section { margin-bottom: 18px; }
    .section-title {
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: #333; margin: 0 0 8px;
      border-bottom: 1px solid #ddd; padding-bottom: 4px;
    }
    .grid-2 {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;
    }
    .row {
      display: flex; justify-content: space-between; gap: 16px;
      padding: 4px 0;
    }
    .row strong { font-weight: 600; }
    .row.total {
      border-top: 2px solid #111; margin-top: 6px; padding-top: 8px;
      font-size: 14px; font-weight: 700;
    }
    .muted { color: #666; font-size: 11px; }
    table {
      width: 100%; border-collapse: collapse; font-size: 11px;
    }
    th, td {
      border: 1px solid #ddd; padding: 8px 10px; vertical-align: top;
    }
    th {
      background: #f5f5f5; text-align: left; font-weight: 700;
    }
    td.amt, th.amt { text-align: right; white-space: nowrap; }
    tr.canceled td { color: #888; }
    tr.canceled td.amt { text-decoration: line-through; }
    .cancel-tag {
      display: inline-block; margin-left: 6px; padding: 1px 5px;
      border-radius: 3px; background: #fee2e2; color: #b91c1c;
      font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
      text-decoration: none;
    }
    .footer {
      margin-top: 24px; padding-top: 12px; border-top: 1px dashed #aaa;
      text-align: center; color: #666; font-size: 11px;
    }
  `;
}

function buildA4HeaderHtml(options: {
  logoUrl?: string | null;
  brandName: string;
  branchName?: string | null;
}): string {
  const brandName = escapeHtml((options.brandName || 'Restaurant').trim());
  const branch = options.branchName?.trim();
  const logoUrl = options.logoUrl?.trim();
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" class="logo" />`
    : '';

  return `<header class="header">
    ${logoHtml}
    <div class="header-text">
      <h1 class="brand">${brandName}</h1>
      ${branch ? `<p class="branch">${escapeHtml(branch)}</p>` : ''}
      <p class="meta">Printed ${escapeHtml(new Date().toLocaleString())}</p>
    </div>
  </header>`;
}

export type PrintPosShiftRecordOptions = {
  shift: PosShiftPayload;
  cashLeftInLocker: number | null;
  brandName: string;
  branchName?: string | null;
  logoUrl?: string | null;
};

export function printPosShiftRecord(options: PrintPosShiftRecordOptions) {
  if (typeof window === 'undefined') return false;

  const { shift, cashLeftInLocker, brandName, branchName, logoUrl } = options;
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
      return `<tr class="${canceled ? 'canceled' : ''}">
        <td>${escapeHtml(ticket)}${canceled ? ' <span class="cancel-tag">CANCELED</span>' : ''}</td>
        <td>${escapeHtml(new Date(order.createdAt).toLocaleString())}</td>
        <td>${escapeHtml(order.paymentMethod ?? '—')}</td>
        <td>${escapeHtml(order.customerName ?? '—')}</td>
        <td class="amt${canceled ? ' canceled' : ''}">€${formatMoney(order.total)}</td>
      </tr>`;
    })
    .join('');

  const headerHtml = buildA4HeaderHtml({ logoUrl, brandName, branchName });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Shift Record — ${escapeHtml(brandName)}</title>
    <style>${getA4ShiftPrintCss()}</style>
  </head>
  <body>
    <div class="page">
      ${headerHtml}
      <h2 class="title">SHIFT END RECORD</h2>

      <section class="section">
        <h3 class="section-title">Shift details</h3>
        <div class="grid-2">
          <div class="row"><span>Shift started</span><strong>${escapeHtml(new Date(shift.startedAt).toLocaleString())}</strong></div>
          <div class="row"><span>Opened by</span><strong>${escapeHtml(shift.openedByName ?? '—')}</strong></div>
          <div class="row"><span>Status</span><strong>${escapeHtml(shift.status)}</strong></div>
          <div class="row"><span>Completed orders</span><strong>${shift.orderCount}</strong></div>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Shift orders</h3>
        <table>
          <thead>
            <tr>
              <th>Ticket / ID</th>
              <th>Time</th>
              <th>Payment</th>
              <th>Customer</th>
              <th class="amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${
              orderRows ||
              '<tr><td colspan="5" class="muted">No completed orders in this shift.</td></tr>'
            }
          </tbody>
        </table>
        <div class="row total">
          <span>Total shift sales</span>
          <span>€${formatMoney(shift.totalSales)}</span>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">Cash reconciliation</h3>
        <div class="row"><span>Previous cash left</span><strong>${shift.previousClosingCashInLocker != null ? `€${formatMoney(shift.previousClosingCashInLocker)}` : '—'}</strong></div>
        ${
          shift.previousShiftEndedAt
            ? `<div class="row muted"><span>Last shift ended</span><span>${escapeHtml(new Date(shift.previousShiftEndedAt).toLocaleString())}</span></div>`
            : ''
        }
        <div class="row"><span>Cash sales (shift)</span><strong>€${formatMoney(shift.cashSalesTotal)}</strong></div>
        <div class="row"><span>Card / other sales</span><strong>€${formatMoney(shift.nonCashSalesTotal)}</strong></div>
        <div class="row"><span>Expected in locker</span><strong>€${formatMoney(expected)}</strong></div>
        <div class="row"><span>Cash left in locker</span><strong>${leftInLocker != null ? `€${formatMoney(leftInLocker)}` : '—'}</strong></div>
        <div class="row total">
          <span>Difference</span>
          <span>${difference != null ? formatSignedMoney(difference) : '—'}</span>
        </div>
        <p class="muted">Cash left is what you leave in the locker when ending this shift. Difference = cash left − expected.</p>
      </section>

      <div class="footer">End of shift record</div>
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
