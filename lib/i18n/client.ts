import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { uiLanguageCookieHeader } from '@/lib/i18n/language-cookie';
import { resources, UI_LANG_STORAGE_KEY, type UiLanguage } from '@/lib/i18n/resources';

function readStoredLanguage(): UiLanguage {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
  return stored === 'en' || stored === 'es' ? stored : 'es';
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next);
}

/** Keep SSR and the first client paint on the same language (cookie / default). */
export function ensureI18nInitialized(lng: UiLanguage = 'es') {
  if (!i18n.isInitialized) {
    void i18n.init({
      resources,
      lng,
      fallbackLng: 'es',
      supportedLngs: ['en', 'es'],
      nonExplicitSupportedLngs: false,
      interpolation: { escapeValue: false },
    });
    return;
  }

  if (i18n.language !== lng) {
    i18n.language = lng;
  }
}

/** After mount: prefer localStorage when it differs from the cookie snapshot. */
export function hydrateUiLanguageFromStorage() {
  const lang = readStoredLanguage();
  if (i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }
  if (typeof document !== 'undefined') {
    document.cookie = uiLanguageCookieHeader(lang);
  }
}

export function setUiLanguage(lang: UiLanguage) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, lang);
    document.cookie = uiLanguageCookieHeader(lang);
  }
  void i18n.changeLanguage(lang);
}

export { i18n };
