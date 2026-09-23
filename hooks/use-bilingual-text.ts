'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeUiLanguage } from '@/lib/i18n/language-cookie';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';

/** Resolve stored bilingual product text for the active UI language. */
export function useBilingualText() {
  const { i18n } = useTranslation();
  const lang = normalizeUiLanguage(i18n.resolvedLanguage ?? i18n.language);

  const resolve = useCallback(
    (raw: unknown) => resolveBilingualText(raw, lang),
    [lang]
  );

  return { lang, resolve };
}
