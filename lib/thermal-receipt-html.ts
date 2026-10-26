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

/**
 * Receipt fills an 80mm Sunmi roll and stays centered. It is not locked to 50mm.
 * h-10 = 2.5rem, w-26 = 6.5rem. Logo is a flat rectangle, not a circle.
 */
export function getThermalReceiptDocumentCss(): string {
  return `
      @page { size: auto; margin: 0; }
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
        font-size: 11px;
        line-height: 1.35;
      }
      .r {
        width: 100%;
        max-width: 80mm;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 2mm 2mm 4mm;
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
      .muted { font-size: 10px; }
      .receipt-header { text-align: center; width: 100%; margin-bottom: 4px; }
      .receipt-logo-wrap { display: flex; justify-content: center; width: 100%; margin-bottom: 6px; }
      .receipt-logo {
        width: 6.5rem;
        height: 2.5rem;
        object-fit: contain;
        object-position: center;
        border-radius: 0;
        border: 0;
      }
      .receipt-brand {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.04em;
        line-height: 1.2;
        margin: 0 auto;
        max-width: 100%;
        text-align: center;
        text-transform: uppercase;
      }
      .receipt-branch { font-size: 11px; margin-top: 2px; text-align: center; }
      .receipt-datetime { font-size: 10px; margin-top: 2px; text-align: center; }
      .receipt-line { font-size: 11px; margin-top: 2px; text-align: left; }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 2px 0; font-size: 11px; vertical-align: top; text-align: left; }
      th { text-align: left; font-weight: 700; }
      .qty, .amt { white-space: nowrap; text-align: right; }
      .totals { margin-top: 4px; text-align: left; width: 100%; }
      .totals div { display: flex; justify-content: space-between; margin-top: 2px; }
      .grand { font-weight: 800; font-size: 13px; }
    `;
}
