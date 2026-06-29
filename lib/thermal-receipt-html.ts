/** Shared 2″ thermal receipt print styles and header (logo → name → branch). */

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

/** Base CSS for POS / kiosk thermal print windows. */
export function getThermalReceiptDocumentCss(): string {
  return `
      @page { size: 80mm auto; margin: 0; }
      html {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        width: 100%;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: Arial, sans-serif;
        font-size: 10px;
        line-height: 1.35;
      }
      .r {
        width: 2in;
        max-width: 72mm;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 0.06in 0;
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
          margin-left: auto !important;
          margin-right: auto !important;
        }
      }
      .center { text-align: center; }
      .muted { font-size: 9px; }
      .receipt-header { text-align: center; width: 100%; margin-bottom: 4px; }
      .receipt-logo-wrap { display: flex; justify-content: center; margin-bottom: 4px; }
      .receipt-logo { width: 42px; height: 42px; object-fit: cover; border-radius: 999px; border: 1px solid #ddd; }
      .receipt-brand { font-size: 12px; font-weight: 700; line-height: 1.2; margin: 0 auto; max-width: 1.35in; }
      .receipt-branch { font-size: 9px;  margin-top: 2px; }
      .receipt-datetime {  font-size: 9px; margin-top: 2px; }
      .receipt-line { font-size: 9px; margin-top: 1px; text-align: left; }
      .sep { border-top: 1px dashed; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 2px 0; font-size: 9px; vertical-align: top; text-align: left; }
      th { text-align: left; font-weight: 700; }
      .qty, .amt { white-space: nowrap; text-align: right; }
      .totals { margin-top: 4px; text-align: left; }
      .totals div { display: flex; justify-content: space-between; margin-top: 1px; }
      .grand { font-weight: 700; font-size: 11px; }
    `;
}
