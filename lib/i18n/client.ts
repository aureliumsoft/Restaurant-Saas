import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { normalizeUiLanguage, uiLanguageCookieHeader } from '@/lib/i18n/language-cookie';
import {
  DEFAULT_UI_LANGUAGE,
  resources,
  UI_LANG_STORAGE_KEY,
  type UiLanguage,
} from '@/lib/i18n/resources';

function readStoredLanguage(): UiLanguage {
  if (typeof window === 'undefined') return DEFAULT_UI_LANGUAGE;
  return normalizeUiLanguage(window.localStorage.getItem(UI_LANG_STORAGE_KEY));
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next);
}

/** Keep SSR and the first client paint on the same language (cookie / default). */
export function ensureI18nInitialized(lng: UiLanguage = DEFAULT_UI_LANGUAGE) {
  const language = normalizeUiLanguage(lng);

  if (!i18n.isInitialized) {
    void i18n.init({
      resources,
      lng: language,
      fallbackLng: DEFAULT_UI_LANGUAGE,
      supportedLngs: ['en', 'es'],
      nonExplicitSupportedLngs: false,
      interpolation: { escapeValue: false },
      initAsync: false,
    });
    return;
  }

  if (normalizeUiLanguage(i18n.language) !== language) {
    void i18n.changeLanguage(language);
  }
}

/** After mount: prefer localStorage when set; otherwise persist Spanish as default. */
export function hydrateUiLanguageFromStorage() {
  if (typeof window === 'undefined') return;

  const stored = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
  const lang = normalizeUiLanguage(stored);

  if (!stored) {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, DEFAULT_UI_LANGUAGE);
  }

  if (normalizeUiLanguage(i18n.language) !== lang) {
    void i18n.changeLanguage(lang);
  }

  document.cookie = uiLanguageCookieHeader(lang);
  document.documentElement.lang = lang;
}

export function setUiLanguage(lang: UiLanguage) {
  const next = normalizeUiLanguage(lang);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, next);
    document.cookie = uiLanguageCookieHeader(next);
    document.documentElement.lang = next;
  }
  void i18n.changeLanguage(next);
}

export { i18n };
