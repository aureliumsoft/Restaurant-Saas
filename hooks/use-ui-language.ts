'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeUiLanguage } from '@/lib/i18n/language-cookie';
import type { UiLanguage } from '@/lib/i18n/resources';

/** Current UI language; updates immediately when LanguageSwitcher changes. */
export function useUiLanguage(): UiLanguage {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<UiLanguage>(() =>
    normalizeUiLanguage(i18n.resolvedLanguage ?? i18n.language)
  );

  useEffect(() => {
    const sync = () => {
      setLang(normalizeUiLanguage(i18n.resolvedLanguage ?? i18n.language));
    };
    sync();
    i18n.on('languageChanged', sync);
    return () => {
      i18n.off('languageChanged', sync);
    };
  }, [i18n]);

  return lang;
}
