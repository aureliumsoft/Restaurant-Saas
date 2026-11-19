import { parseStoredBilingualText } from '@/lib/menu/bilingual-text';

/** Editor hydrate: stored heading/sub heading name → separate English and Spanish. */
export function splitStoredDocName(raw: unknown): { en: string; es: string } {
  const parts = parseStoredBilingualText(raw);
  if (parts.en === parts.es) return { en: parts.en, es: '' };
  return { en: parts.en, es: parts.es };
}

/** Admin label without the `&&&&` separator. */
export function formatDocAdminName(raw: unknown): string {
  const parts = parseStoredBilingualText(raw);
  const en = parts.en.trim();
  const es = parts.es.trim();
  if (en && es && en !== es) return `${en} · ${es}`;
  return en || es;
}
