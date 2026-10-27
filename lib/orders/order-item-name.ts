import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import {
  DEFAULT_UI_LANGUAGE,
  type UiLanguage,
} from '@/lib/i18n/resources';
import { stripLegacyEmbeddedModifierSuffix } from '@/lib/kitchen-ticket-items';

export const DELETED_PRODUCT_LABEL = 'Deleted product';

export function orderItemDisplayName(
  item: {
    productName?: string | null;
    menuItem?: { name?: string | null } | null;
  },
  lang: UiLanguage = DEFAULT_UI_LANGUAGE
): string {
  // Prefer the order snapshot so parent variation (`Product (XL)`) survives.
  // Strip legacy baked `(mod1, mod2)` lists — modifiers print as separate lines.
  const snap = item.productName;
  if (snap != null && String(snap).trim()) {
    const cleaned = stripLegacyEmbeddedModifierSuffix(String(snap).trim());
    return resolveBilingualText(cleaned || snap, lang);
  }
  const live = item.menuItem?.name;
  if (live != null && String(live).trim()) {
    return resolveBilingualText(live, lang);
  }
  return DELETED_PRODUCT_LABEL;
}
