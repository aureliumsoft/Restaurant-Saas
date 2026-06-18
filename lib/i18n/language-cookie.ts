import {
  DEFAULT_UI_LANGUAGE,
  UI_LANG_STORAGE_KEY,
  type UiLanguage,
} from '@/lib/i18n/resources';

export const UI_LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function normalizeUiLanguage(
  value: string | null | undefined
): UiLanguage {
  if (!value?.trim()) return DEFAULT_UI_LANGUAGE;
  const base = value.trim().toLowerCase().split('-')[0];
  return base === 'en' ? 'en' : DEFAULT_UI_LANGUAGE;
}

export function parseUiLanguage(value: string | null | undefined): UiLanguage {
  return normalizeUiLanguage(value);
}

export function uiLanguageCookieHeader(lang: UiLanguage): string {
  return `${UI_LANG_STORAGE_KEY}=${lang}; Path=/; Max-Age=${UI_LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
}
