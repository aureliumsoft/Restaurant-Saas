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

/**
 * Read a File as a data URL, optionally re-encoding as JPEG under a max size
 * so large camera photos still preview and save reliably in the DB.
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
    let { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / width, maxEdge / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return readFileAsDataUrl(file);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = options?.quality ?? 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (estimateDataUrlBytes(dataUrl) > maxBytes && quality > 0.45) {
      quality = Math.round((quality - 0.1) * 100) / 100;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
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
