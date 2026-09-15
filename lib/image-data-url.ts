const DATA_URL_PREFIX_RE =
  /^data:image\/[a-z0-9.+-]+(?:;[a-z0-9=+-]+)*;base64,/i;

export function isDataImageUrl(value: string): boolean {
  return DATA_URL_PREFIX_RE.test(value.trim());
}

export function isHttpImageUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAcceptedImageValue(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  return isHttpImageUrl(t) || isDataImageUrl(t);
}

/** Whether a value looks like a usable img src (for previews). */
export function canPreviewImageValue(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (t.startsWith('blob:')) return true;
  return isHttpImageUrl(t) || t.startsWith('data:image/');
}

export function estimateDataUrlBytes(value: string): number {
  const t = value.trim();
  const commaIdx = t.indexOf(',');
  if (commaIdx <= 0) return 0;
  const b64 = t.slice(commaIdx + 1).replace(/\s+/g, '');
  const padding = (b64.match(/=+$/)?.[0].length ?? 0);
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

type CanvasExportMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Keep formats that support transparency; JPEG photos stay JPEG. */
function exportMimeForSource(file: File): CanvasExportMime {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/png' || type === 'image/gif') return 'image/png';
  if (type === 'image/webp') return 'image/webp';
  // Unknown / HEIC / etc. — prefer PNG so alpha is not flattened to black.
  if (type && type !== 'image/jpeg' && type !== 'image/jpg') {
    return 'image/png';
  }
  return 'image/jpeg';
}

function canvasHasAlpha(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  try {
    const { data } = ctx.getImageData(
      0,
      0,
      Math.min(width, 64),
      Math.min(height, 64)
    );
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) return true;
    }
  } catch {
    // Cross-origin / security — assume no alpha.
  }
  return false;
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: CanvasExportMime,
  quality: number
): string {
  if (mime === 'image/jpeg') {
    return canvas.toDataURL('image/jpeg', quality);
  }
  if (mime === 'image/webp') {
    try {
      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp')) return webp;
    } catch {
      // fall through to PNG
    }
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/png');
}

/**
 * Read a File as a data URL, optionally re-encoding under a max size
 * so large camera photos still preview and save reliably in the DB.
 * PNG/WebP/GIF keep an alpha-capable format (never flattened to black JPEG).
 */
export async function fileToOptimizedDataUrl(
  file: File,
  options?: {
    maxEdge?: number;
    quality?: number;
    maxBytes?: number;
  }
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1600;
  const maxBytes = options?.maxBytes ?? Math.floor(1.5 * 1024 * 1024);
  const preferredMime = exportMimeForSource(file);

  // Small files: keep original encoding when possible
  if (file.size <= 400 * 1024 && file.type.startsWith('image/')) {
    const raw = await readFileAsDataUrl(file);
    if (raw.startsWith('data:image/') && estimateDataUrlBytes(raw) <= maxBytes) {
      return raw;
    }
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Fallback when createImageBitmap is unavailable (or fails on some formats)
    return readFileAsDataUrl(file);
  }

  try {
    let scale = Math.min(1, maxEdge / bitmap.width, maxEdge / bitmap.height);
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      return readFileAsDataUrl(file);
    }

    const draw = (w: number, h: number, mime: CanvasExportMime) => {
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      // JPEG has no alpha — composite onto white so transparent pixels are not black.
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
    };

    draw(width, height, preferredMime);

    // If a "JPEG" source actually has alpha (rare), switch to PNG.
    let mime: CanvasExportMime = preferredMime;
    if (mime === 'image/jpeg' && canvasHasAlpha(ctx, width, height)) {
      mime = 'image/png';
      draw(width, height, mime);
    }

    let quality = options?.quality ?? 0.85;
    let dataUrl = encodeCanvas(canvas, mime, quality);

    // Shrink / re-compress until under maxBytes without converting PNG → JPEG.
    let guard = 0;
    while (estimateDataUrlBytes(dataUrl) > maxBytes && guard < 12) {
      guard += 1;
      if (mime === 'image/jpeg' || mime === 'image/webp') {
        if (quality > 0.45) {
          quality = Math.round((quality - 0.1) * 100) / 100;
          dataUrl = encodeCanvas(canvas, mime, quality);
          continue;
        }
      }
      scale *= 0.85;
      if (scale < 0.15) break;
      width = Math.max(1, Math.round(bitmap.width * scale));
      height = Math.max(1, Math.round(bitmap.height * scale));
      draw(width, height, mime);
      dataUrl = encodeCanvas(canvas, mime, quality);
    }

    return dataUrl;
  } finally {
    bitmap.close?.();
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}
