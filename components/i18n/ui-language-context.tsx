'use client';

import { createContext, useContext } from 'react';

import { DEFAULT_UI_LANGUAGE, type UiLanguage } from '@/lib/i18n/resources';

const UiLanguageContext = createContext<UiLanguage>(DEFAULT_UI_LANGUAGE);

export function UiLanguageProvider({
  language,
  children,
}: {
  language: UiLanguage;
  children: React.ReactNode;
}) {
  return (
    <UiLanguageContext.Provider value={language}>
      {children}
    </UiLanguageContext.Provider>
  );
}

export function useUiLanguageSnapshot() {
  return useContext(UiLanguageContext);
}
