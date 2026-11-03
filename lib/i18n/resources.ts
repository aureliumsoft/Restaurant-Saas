import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';

export {
  DEFAULT_UI_LANGUAGE,
  UI_LANG_STORAGE_KEY,
  UI_LANGUAGES,
  type UiLanguage,
} from '@/lib/i18n/ui-language';

/** Full resource map (server / sync readers). Client i18n loads locales on demand. */
export const resources = {
  en,
  es,
} as const;
