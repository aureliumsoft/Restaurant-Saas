'use server';

import { cookies } from 'next/headers';

import { normalizeUiLanguage } from '@/lib/i18n/language-cookie';
import { UI_LANG_STORAGE_KEY, type UiLanguage } from '@/lib/i18n/resources';

export async function getServerUiLanguage(): Promise<UiLanguage> {
  const cookieStore = await cookies();
  return normalizeUiLanguage(cookieStore.get(UI_LANG_STORAGE_KEY)?.value);
}
