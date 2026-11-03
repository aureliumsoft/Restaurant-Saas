import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { normalizeUiLanguage, uiLanguageCookieHeader } from '@/lib/i18n/language-cookie';
import {
  DEFAULT_UI_LANGUAGE,
  UI_LANG_STORAGE_KEY,
  type UiLanguage,
} from '@/lib/i18n/ui-language';

// Default locale is statically imported so SSR / first paint stay sync.
import defaultLocale from '@/lib/i18n/locales/es';

const loadedLocales = new Set<UiLanguage>([DEFAULT_UI_LANGUAGE]);

async function ensureLocaleLoaded(lng: UiLanguage) {
  if (loadedLocales.has(lng)) return;
  if (lng === 'en') {
    const mod = await import('@/lib/i18n/locales/en');
    i18n.addResourceBundle('en', 'translation', mod.default.translation, true, true);
    loadedLocales.add('en');
    return;
  }
  // Future locales: dynamic import here.
  loadedLocales.add(lng);
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next);
}

/** Keep SSR and the first client paint on the same language (cookie / default). */
export function ensureI18nInitialized(lng: UiLanguage = DEFAULT_UI_LANGUAGE) {
  const language = normalizeUiLanguage(lng);

  if (!i18n.isInitialized) {
    const initialResources: Record<string, typeof defaultLocale> = {
      [DEFAULT_UI_LANGUAGE]: defaultLocale,
    };

    void i18n.init({
      resources: initialResources,
      lng: language === DEFAULT_UI_LANGUAGE ? language : DEFAULT_UI_LANGUAGE,
      fallbackLng: DEFAULT_UI_LANGUAGE,
      supportedLngs: ['en', 'es'],
      nonExplicitSupportedLngs: false,
      partialBundledLanguages: true,
      interpolation: { escapeValue: false },
      initAsync: false,
    });

    if (language !== DEFAULT_UI_LANGUAGE) {
      void ensureLocaleLoaded(language).then(() => {
        void i18n.changeLanguage(language);
      });
    }
    return;
  }

  if (normalizeUiLanguage(i18n.language) !== language) {
    void ensureLocaleLoaded(language).then(() => {
      void i18n.changeLanguage(language);
    });
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

  void ensureLocaleLoaded(lang).then(() => {
    if (normalizeUiLanguage(i18n.language) !== lang) {
      void i18n.changeLanguage(lang);
    }
  });

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
  void ensureLocaleLoaded(next).then(() => {
    void i18n.changeLanguage(next);
  });
}

export { i18n };
