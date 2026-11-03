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
  /** Multiply base thermal type (1 = default; kiosk uses ~2). */
  fontScale?: number;
};

/**
 * Receipt fills an 80mm Sunmi roll and stays centered. It is not locked to 50mm.
 * h-10 = 2.5rem, w-26 = 6.5rem. Logo is a flat rectangle, not a circle.
 */
export function getThermalReceiptDocumentCss(
  options?: ThermalReceiptCssOptions
): string {
  const scale = Math.max(1, options?.fontScale ?? 1);
  const px = (n: number) => `${Math.round(n * scale)}px`;
  const rem = (n: number) => `${(n * scale).toFixed(2)}rem`;
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
        font-size: ${px(10)};
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
      .muted { font-size: ${px(10)}; }
      .receipt-header { text-align: center; width: 100%; margin-bottom: ${px(4)}; }
      .receipt-logo-wrap { display: flex; justify-content: center; width: 100%; margin-bottom: ${px(6)}; }
      .receipt-logo {
        width: ${rem(6.5)};
        height: ${rem(2.5)};
        object-fit: contain;
        object-position: center;
        border-radius: 0;
        border: 0;
      }
      .receipt-brand {
        font-size: ${px(14)};
        font-weight: 800;
        letter-spacing: 0.04em;
        line-height: 1.2;
        margin: 0 auto;
        max-width: 100%;
        text-align: center;
        text-transform: uppercase;
      }
      .receipt-branch { font-size: ${px(10)}; margin-top: ${px(2)}; text-align: center; }
      .receipt-datetime { font-size: ${px(10)}; margin-top: ${px(2)}; text-align: center; }
      .receipt-line { font-size: ${px(10)}; margin-top: ${px(2)}; text-align: left; }
      .receipt-line strong { font-size: ${px(11)}; font-weight: 700; }
      .receipt-ticket {
        font-size: ${px(20)};
        font-weight: 700;
        line-height: 1.2;
        margin: ${px(2)} 0;
        text-align: center;
      }
      .sep { border-top: 1px dashed #111; margin: ${px(6)} 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: ${px(2)} 0; font-size: ${px(10)}; vertical-align: top; text-align: left; }
      th { font-size: ${px(11)}; text-align: left; font-weight: 700; }
      td.mod { padding-left: ${px(8)}; }
      .qty, .amt { white-space: nowrap; text-align: right; }
      .totals { margin-top: ${px(4)}; text-align: left; width: 100%; font-size: ${px(10)}; }
      .totals div { display: flex; justify-content: space-between; margin-top: ${px(2)}; }
      .grand { font-weight: 800; font-size: ${px(11)}; }
    `;
}
