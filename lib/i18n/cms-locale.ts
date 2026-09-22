import type { UiLanguage } from '@/lib/i18n/resources';

/** Pick CMS locale text: primary language, then the other, then empty. */
export function pickCmsText(
  parts: { en?: string | null; es?: string | null },
  lang: UiLanguage
): string {
  const en = parts.en?.trim() ?? '';
  const es = parts.es?.trim() ?? '';
  if (lang === 'en') return en || es;
  return es || en;
}
