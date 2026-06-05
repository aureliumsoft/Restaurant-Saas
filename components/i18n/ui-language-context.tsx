'use client';

import { createContext, useContext } from 'react';

import type { UiLanguage } from '@/lib/i18n/resources';

const UiLanguageContext = createContext<UiLanguage>('es');

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
