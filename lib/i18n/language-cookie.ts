import { UI_LANG_STORAGE_KEY, type UiLanguage } from '@/lib/i18n/resources';

export const UI_LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseUiLanguage(value: string | null | undefined): UiLanguage {
  return value === 'en' ? 'en' : 'es';
}

export function uiLanguageCookieHeader(lang: UiLanguage): string {
  return `${UI_LANG_STORAGE_KEY}=${lang}; Path=/; Max-Age=${UI_LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
}
