/** Sunmi inner printer dot widths. 576 fills an 80mm roll; 384 fills a 58mm (~50mm) roll. */
export const PAPER_80MM_DOTS = 576;
export const PAPER_58MM_DOTS = 384;

export type ThermalBitmapLine = {
  name: string;
  quantity: number;
  amount: string;
  indent?: boolean;
};

export type ThermalBitmapReceipt = {
  logoUrl?: string | null;
  restaurantName: string;
  branchName?: string | null;
  dateTime: string;
  meta: Array<{ label: string; value: string }>;
  items: ThermalBitmapLine[];
  totals: Array<{ label: string; value: string; bold?: boolean }>;
  footer: string;
  /** Defaults to 80mm (576 dots) so a Sunmi K2 roll is full width and centered. */
  widthDots?: number;
};

const FONT = 'Arial, sans-serif';

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

async function loadLogo(url: string): Promise<HTMLImageElement | null> {
  let src = url;
  if (!url.startsWith('data:')) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) return null;
      src = URL.createObjectURL(await res.blob());
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function contain(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

function drawReceipt(
  receipt: ThermalBitmapReceipt,
  logo: HTMLImageElement | null
): string {
  const width = receipt.widthDots ?? PAPER_80MM_DOTS;
  const pad = Math.round(width * 0.03);
  const contentW = width - pad * 2;
  const qtyW = Math.round(contentW * 0.14);
  const amtW = Math.round(contentW * 0.24);
  const itemW = contentW - qtyW - amtW;
  // h-10 = 2.5rem, w-26 = 6.5rem, sized for a 50mm / 58mm roll.
  const logoBoxW = Math.round(width * (104 / 219));
  const logoBoxH = Math.round(width * (40 / 219));
  const brandSize = Math.max(22, Math.round(width * 0.052));
  const branchSize = Math.max(16, Math.round(width * 0.034));
  const bodySize = Math.max(16, Math.round(width * 0.034));
  const totalSize = Math.max(20, Math.round(width * 0.044));
  const lineGap = Math.round(bodySize * 0.38);

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Canvas is not available');

  const brand = (receipt.restaurantName || 'Restaurant').trim().toUpperCase();
  measure.font = `800 ${brandSize}px ${FONT}`;
  const brandLines = wrapText(measure, brand, contentW);
  measure.font = `${branchSize}px ${FONT}`;
  const branchLines = receipt.branchName?.trim()
    ? wrapText(measure, receipt.branchName.trim(), contentW)
    : [];
  measure.font = `${bodySize}px ${FONT}`;
  const dateLines = wrapText(measure, receipt.dateTime.trim(), contentW);

  const itemBlocks = receipt.items.map((item) => {
    const indent = item.indent ? Math.round(bodySize * 0.8) : 0;
    measure.font = `${bodySize}px ${FONT}`;
    return {
      lines: wrapText(measure, item.name, Math.max(40, itemW - indent)),
      quantity: String(item.quantity),
      amount: item.amount,
      indent: Boolean(item.indent),
    };
  });

  const sep = 10;
  let height = pad;
  if (logo) height += logoBoxH + 10;
  height += brandLines.length * (brandSize + lineGap) + 6;
  height += branchLines.length * (branchSize + lineGap);
  height += dateLines.length * (bodySize + lineGap) + 8;
  height += sep + 8;
  height += (bodySize + lineGap) * Math.max(1, receipt.meta.length) + 8;
  height += sep + 8;
  height += bodySize + lineGap + 4;
  for (const block of itemBlocks) {
    height += block.lines.length * (bodySize + lineGap);
  }
  if (itemBlocks.length === 0) height += bodySize + lineGap;
  height += sep + 8;
  height += receipt.totals.length * (totalSize + lineGap) + 8;
  height += sep + 8;
  height += bodySize + lineGap + pad + 28;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(height, 200);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = pad;

  if (logo) {
    const fit = contain(logo.naturalWidth, logo.naturalHeight, logoBoxW, logoBoxH);
    const x = Math.round((width - logoBoxW) / 2 + fit.x);
    ctx.drawImage(logo, x, y + fit.y, fit.w, fit.h);
    y += logoBoxH + 10;
  }

  ctx.font = `800 ${brandSize}px ${FONT}`;
  ctx.textAlign = 'center';
  for (const line of brandLines) {
    ctx.fillText(line, width / 2, y);
    y += brandSize + lineGap;
  }
  y += 4;

  ctx.font = `${branchSize}px ${FONT}`;
  for (const line of branchLines) {
    ctx.fillText(line, width / 2, y);
    y += branchSize + lineGap;
  }

  ctx.font = `${bodySize}px ${FONT}`;
  for (const line of dateLines) {
    ctx.fillText(line, width / 2, y);
    y += bodySize + lineGap;
  }
  y += 8;

  const dash = () => {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    ctx.restore();
    y += 12;
  };

  dash();

  ctx.textAlign = 'left';
  ctx.font = `${bodySize}px ${FONT}`;
  for (const row of receipt.meta) {
    ctx.fillText(`${row.label}: ${row.value}`, pad, y);
    y += bodySize + lineGap;
  }
  y += 6;
  dash();

  ctx.font = `700 ${bodySize}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('Item', pad, y);
  ctx.textAlign = 'right';
  ctx.fillText('Qty', width - pad - amtW, y);
  ctx.fillText('Amt', width - pad, y);
  y += bodySize + lineGap + 4;

  ctx.font = `${bodySize}px ${FONT}`;
  if (itemBlocks.length === 0) {
    ctx.textAlign = 'left';
    ctx.fillText('No items', pad, y);
    y += bodySize + lineGap;
  }
  for (const block of itemBlocks) {
    const indent = block.indent ? Math.round(bodySize * 0.8) : 0;
    block.lines.forEach((line, index) => {
      ctx.textAlign = 'left';
      ctx.fillText(line, pad + indent, y);
      if (index === 0) {
        ctx.textAlign = 'right';
        ctx.fillText(block.quantity, width - pad - amtW, y);
        ctx.fillText(block.amount, width - pad, y);
      }
      y += bodySize + lineGap;
    });
  }
  y += 6;
  dash();

  for (const row of receipt.totals) {
    ctx.font = `${row.bold ? '800' : '400'} ${row.bold ? totalSize : bodySize}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(row.label, pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(row.value, width - pad, y);
    y += (row.bold ? totalSize : bodySize) + lineGap;
  }
  y += 6;
  dash();

  ctx.font = `${bodySize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(receipt.footer || 'Thank you!', width / 2, y);

  return canvas.toDataURL('image/png');
}

/** Full-width black-on-white receipt image for the Sunmi inner printer. */
export async function renderThermalReceiptPng(
  receipt: ThermalBitmapReceipt
): Promise<string> {
  const logo = receipt.logoUrl?.trim()
    ? await loadLogo(receipt.logoUrl.trim())
    : null;
  try {
    return drawReceipt(receipt, logo);
  } catch {
    return drawReceipt(receipt, null);
  }
}
