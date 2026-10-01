import type { UiLanguage } from '@/lib/i18n/resources';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';

/**
 * Expense titles for inventory restocks were stored as
 * `Restock: {"en":"...","es":"..."}`. Resolve that for display.
 * Prefer the linked ingredient name when available.
 */
export function formatExpenseDisplayTitle(opts: {
  title: string;
  type?: string | null;
  ingredientName?: string | null;
  lang: UiLanguage;
  restockLabel?: string;
}): string {
  const restockLabel = opts.restockLabel?.trim() || 'Restock';
  const ingredientLabel = opts.ingredientName
    ? resolveBilingualText(opts.ingredientName, opts.lang).trim()
    : '';

  if (opts.type === 'INVENTORY' && ingredientLabel) {
    return `${restockLabel}: ${ingredientLabel}`;
  }

  return resolveEmbeddedBilingualTitle(opts.title, opts.lang);
}

/** Replace an embedded bilingual JSON blob inside a title string. */
export function resolveEmbeddedBilingualTitle(
  title: string,
  lang: UiLanguage
): string {
  const raw = String(title ?? '').trim();
  if (!raw) return '';

  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) return raw;

  const jsonPart = raw.slice(jsonStart).trim();
  if (!jsonPart.startsWith('{')) return raw;

  try {
    JSON.parse(jsonPart);
  } catch {
    return raw;
  }

  const resolved = resolveBilingualText(jsonPart, lang).trim();
  if (!resolved) return raw;

  const prefix = raw.slice(0, jsonStart).trimEnd();
  return prefix ? `${prefix} ${resolved}` : resolved;
}
