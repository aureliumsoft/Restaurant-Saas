import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import {
  DEFAULT_UI_LANGUAGE,
  type UiLanguage,
} from '@/lib/i18n/resources';

export const DELETED_PRODUCT_LABEL = 'Deleted product';

export function orderItemDisplayName(
  item: {
    productName?: string | null;
    menuItem?: { name?: string | null } | null;
  },
  lang: UiLanguage = DEFAULT_UI_LANGUAGE
): string {
  const live = item.menuItem?.name;
  if (live != null && String(live).trim()) {
    return resolveBilingualText(live, lang);
  }
  const snap = item.productName;
  if (snap != null && String(snap).trim()) {
    return resolveBilingualText(snap, lang);
  }
  return DELETED_PRODUCT_LABEL;
}
