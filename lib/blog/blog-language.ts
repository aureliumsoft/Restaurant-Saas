import type { UiLanguage } from '@/lib/i18n/resources';

export type BlogLanguageFlags = {
  english: boolean;
  spanish: boolean;
};

/** Prisma `where` fragment for public blog lists by UI language. */
export function blogLanguageWhere(lang: UiLanguage): BlogLanguageFlags {
  if (lang === 'es') {
    return { english: false, spanish: true };
  }
  return { english: true, spanish: false };
}

export function normalizeBlogLanguageFlags(input: {
  english?: boolean | null;
  spanish?: boolean | null;
  language?: 'en' | 'es' | null;
}): BlogLanguageFlags {
  if (input.language === 'es' || input.spanish === true) {
    return { english: false, spanish: true };
  }
  return { english: true, spanish: false };
}

export function blogLanguageFromFlags(
  flags: Partial<BlogLanguageFlags> | null | undefined
): UiLanguage {
  if (flags?.spanish && !flags?.english) return 'es';
  return 'en';
}
