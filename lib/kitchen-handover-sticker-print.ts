import { escapeHtml } from '@/lib/thermal-receipt-html';

export type KitchenHandoverLine = {
  name: string;
  quantity?: number;
  kind: 'main' | 'branch' | 'nested' | 'addon' | 'personalize';
};

export type PrintKitchenHandoverStickerOptions = {
  ticketNumber: string;
  lines: KitchenHandoverLine[];
  /** Small label above the number, e.g. “Ticket”. */
  heading: string;
  customerName?: string | null;
  orderMethod?: string | null;
};

const STYLE_ID = 'kds-handover-print-style';
const ROOT_ID = 'kds-handover-print';

const PRINT_CSS = `
  @media screen {
    #${ROOT_ID} {
      position: fixed;
      left: 0;
      top: 0;
      width: 80mm;
      height: auto;
      margin: 0;
      background: #fff;
      z-index: 2147483646;
      visibility: hidden;
      pointer-events: none;
    }
  }
  @media print {
    @page { size: 80mm auto; margin: 4mm; }
    html, body {
      background: #fff !important;
      height: auto !important;
      overflow: visible !important;
    }
    body > *:not(#${ROOT_ID}) {
      display: none !important;
    }
    #${ROOT_ID} {
      display: block !important;
      visibility: visible !important;
      position: static !important;
      width: auto !important;
      height: auto !important;
      pointer-events: auto !important;
    }
  }
  #${ROOT_ID} .slip {
    width: 72mm;
    margin: 0 auto;
    padding: 2mm 1mm 6mm;
    color: #1c1410;
    font-family: "Segoe UI", Arial, sans-serif;
  }
  #${ROOT_ID} .kicker {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6b5e56;
  }
  #${ROOT_ID} .number {
    margin: 2px 0 0;
    font-size: 72px;
    font-weight: 800;
    line-height: 0.85;
    letter-spacing: -0.05em;
  }
  #${ROOT_ID} .method {
    display: inline-block;
    margin: 8px 0 0;
    padding: 4px 12px;
    border-radius: 999px;
    background: #f3ebe4;
    font-size: 14px;
    font-weight: 700;
  }
  #${ROOT_ID} .rule {
    border: 0;
    border-top: 1px solid #eadfd4;
    margin: 12px 0 12px;
  }
  #${ROOT_ID} .product {
    margin: 12px 0 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  #${ROOT_ID} .product span { margin-right: 6px; }
  #${ROOT_ID} .pack {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  #${ROOT_ID} .pack li { margin-top: 8px; }
  #${ROOT_ID} .group {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b5e56;
  }
  #${ROOT_ID} .choice, #${ROOT_ID} .note {
    margin: 2px 0 0;
    padding-left: 12px;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
  }
  #${ROOT_ID} .note { font-style: italic; font-weight: 600; }
`;

function stickerBody(options: PrintKitchenHandoverStickerOptions, ticketNumber: string): string {
  const method = options.orderMethod?.trim();
  const parts: string[] = [];
  let listOpen = false;
  let groupOpen = false;

  const closeGroup = () => {
    if (!groupOpen) return;
    parts.push('</li>');
    groupOpen = false;
  };
  const closeList = () => {
    closeGroup();
    if (!listOpen) return;
    parts.push('</ul>');
    listOpen = false;
  };
  const ensureList = () => {
    if (listOpen) return;
    parts.push('<ul class="pack">');
    listOpen = true;
  };

  for (const line of options.lines) {
    const name = line.name.trim();
    if (!name) continue;
    if (line.kind === 'main') {
      closeList();
      const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
      parts.push(
        `<p class="product"><span>${qty}×</span> ${escapeHtml(name)}</p>`
      );
      continue;
    }
    if (line.kind === 'branch') {
      ensureList();
      closeGroup();
      parts.push(`<li><p class="group">${escapeHtml(name)}</p>`);
      groupOpen = true;
      continue;
    }
    ensureList();
    if (!groupOpen) {
      parts.push('<li>');
      groupOpen = true;
    }
    const cls = line.kind === 'personalize' ? 'note' : 'choice';
    parts.push(`<p class="${cls}">${escapeHtml(name)}</p>`);
  }
  closeList();

  const items = parts.join('') || '<p class="product">—</p>';
  return `<article class="slip">
      <p class="kicker">${escapeHtml(options.heading)}</p>
      <p class="number">${escapeHtml(ticketNumber)}</p>
      ${method ? `<p class="method">${escapeHtml(method)}</p>` : ''}
      <hr class="rule" />
      ${items}
    </article>`;
}

/**
 * Prints the handover sticker from the main window.
 * Other page content is hidden while printing, so the dialog is the sticker
 * and not the kitchen screen. The node stays until the dialog closes so a
 * long order is not clipped.
 */
export function printKitchenHandoverSticker(
  options: PrintKitchenHandoverStickerOptions
): boolean {
  if (typeof window === 'undefined') return false;

  const ticketNumber = options.ticketNumber.trim();
  if (!ticketNumber) return false;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
  }

  document.getElementById(ROOT_ID)?.remove();
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = stickerBody(options, ticketNumber);
  document.body.appendChild(root);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    root.remove();
    document.body.style.removeProperty('pointer-events');
    document.body.removeAttribute('data-scroll-locked');
  };

  try {
    window.addEventListener('afterprint', release, { once: true });
    window.setTimeout(release, 120_000);
    window.print();
  } catch {
    release();
    return false;
  }
  return true;
}
