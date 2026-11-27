import {
  DEFAULT_UI_LANGUAGE,
  resources,
  type UiLanguage,
} from '@/lib/i18n/resources';

/** Read a locale string outside React. Supports dotted keys such as `pos.cart.groupAddons`. */
export function uiText(
  lang: UiLanguage | string | null | undefined,
  key: string
): string {
  const language: UiLanguage =
    lang === 'en' || lang === 'es' ? lang : DEFAULT_UI_LANGUAGE;
  const parts = key.split('.');
  let current: unknown = resources[language]?.translation;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return key;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
}
