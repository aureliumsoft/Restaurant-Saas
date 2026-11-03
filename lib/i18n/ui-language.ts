export const UI_LANG_STORAGE_KEY = 'restaurant-ui-language';

/** Default customer / storefront UI language. */
export const DEFAULT_UI_LANGUAGE = 'es' as const;

export const UI_LANGUAGES = ['en', 'es'] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number];
