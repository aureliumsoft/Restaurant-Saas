/** Shared 80mm thermal receipt print styles and header (logo → name → branch). */

export type ThermalReceiptHeaderOptions = {
  logoUrl?: string | null;
  brandName: string;
  branchName?: string | null;
  /** ISO or locale string; omitted when empty. */
  dateTime?: string | null;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Logo on top, restaurant name centered below, branch name centered below that. */
export function buildThermalReceiptHeaderHtml(
  opts: ThermalReceiptHeaderOptions
): string {
  const brandName = escapeHtml((opts.brandName || 'Restaurant').trim());
  const branch = opts.branchName?.trim();
  const branchHtml = branch
    ? `<div class="receipt-branch">${escapeHtml(branch)}</div>`
    : '';
  const dateTime = opts.dateTime?.trim();
  const dateHtml = dateTime
    ? `<div class="receipt-datetime">${escapeHtml(dateTime)}</div>`
    : '';

  const logoUrl = opts.logoUrl?.trim();
  const logoHtml = logoUrl
    ? `<div class="receipt-logo-wrap"><img src="${escapeHtml(logoUrl)}" alt="" class="receipt-logo" /></div>`
    : '';

  return `<header class="receipt-header">
      ${logoHtml}
      <div class="receipt-brand">${brandName}</div>
      ${branchHtml}
      ${dateHtml}
    </header>`;
}

export type ThermalReceiptCssOptions = {
  /** Kiosk tickets use the larger fixed sizes. POS stays on the smaller fixed sizes. */
  variant?: 'default' | 'kiosk';
};

const RECEIPT_CSS_SHARED = `
      @page { size: auto; margin: 0; }
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: Arial, sans-serif;
        line-height: 1.35;
      }
      .r {
        width: 100%;
        max-width: 80mm;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 8px 8px 16px;
        text-align: center;
      }
      @media print {
        html, body {
          width: 100% !important;
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
        }
        .r {
          width: 100% !important;
          max-width: 80mm !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
      }
      .center { text-align: center; }
      .receipt-header { text-align: center; width: 100%; margin-bottom: 4px; }
      .receipt-logo-wrap { display: flex; justify-content: center; width: 100%; margin-bottom: 6px; }
      .receipt-logo {
        width: 104px;
        height: 40px;
        object-fit: contain;
        object-position: center;
        border-radius: 0;
        border: 0;
      }
      .receipt-brand {
        font-weight: 800;
        letter-spacing: 0.04em;
        line-height: 1.2;
        margin: 0 auto;
        max-width: 100%;
        text-align: center;
        text-transform: uppercase;
      }
      .receipt-branch, .receipt-datetime { margin-top: 2px; text-align: center; }
      .receipt-line { margin-top: 2px; text-align: left; }
      .receipt-line strong { font-weight: 700; }
      .receipt-ticket {
        font-weight: 700;
        line-height: 1.2;
        margin: 2px 0;
        text-align: center;
      }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { padding: 2px 0; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
      th { text-align: left; font-weight: 700; }
      td.mod { padding-left: 8px; }
      .qty, .amt { white-space: nowrap; text-align: right; }
      .qty { width: 48px; }
      .amt { width: 112px; }
      .totals { margin-top: 4px; text-align: left; width: 100%; }
      .totals div { display: flex; justify-content: space-between; margin-top: 2px; }
      .grand { font-weight: 800; }
`;

/** POS receipt. Every size below is a fixed px value. */
const DEFAULT_RECEIPT_CSS = `
      body, .muted, .receipt-branch, .receipt-datetime, .receipt-line, td { font-size: 10px; }
      .receipt-line strong, th, .grand { font-size: 11px; }
      .receipt-brand { font-size: 14px; }
      .receipt-ticket { font-size: 20px; }
      ${RECEIPT_CSS_SHARED}
`;

/** Kiosk receipt. Every size below is a fixed px value, about twice the POS type. */
const KIOSK_RECEIPT_CSS = `
      body, .muted, .receipt-branch, .receipt-datetime, .receipt-line, td, .totals { font-size: 20px; }
      .receipt-line strong, th, .grand { font-size: 22px; }
      .receipt-brand { font-size: 28px; }
      .receipt-ticket { font-size: 40px; }
      ${RECEIPT_CSS_SHARED}
`;

/**
 * Receipt fills an 80mm roll and stays centered.
 * Logo box is 104px by 40px, a flat rectangle.
 */
export function getThermalReceiptDocumentCss(
  options?: ThermalReceiptCssOptions
): string {
  return options?.variant === 'kiosk' ? KIOSK_RECEIPT_CSS : DEFAULT_RECEIPT_CSS;
}
