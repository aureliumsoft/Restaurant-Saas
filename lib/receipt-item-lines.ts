import {
  cartLineTitle,
  cartModifierDisplayTree,
  orderModifierDisplayTree,
  type ModifierDisplayLine,
} from '@/lib/cart-line-display';
import {
  DEFAULT_UI_LANGUAGE,
  type UiLanguage,
} from '@/lib/i18n/resources';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { stripLegacyEmbeddedModifierSuffix } from '@/lib/kitchen-ticket-items';

export type ReceiptItemLine = {
  name: string;
  qty: number | null;
  lineTotal: number | null;
};

function formatModifierReceiptName(line: ModifierDisplayLine): string {
  if (line.style === 'branch') return `↳ ${line.name}`;
  if (line.style === 'plain') return line.name;
  return `- ${line.name}`;
}

function expandModifierLines(
  tree: ModifierDisplayLine[],
  parentQty: number
): ReceiptItemLine[] {
  return tree.map((line) => {
    const unit = line.unitPrice ?? 0;
    const isBranch = line.style === 'branch';
    return {
      name: formatModifierReceiptName(line),
      qty: isBranch ? null : line.quantity != null && line.quantity > 0
        ? line.quantity
        : null,
      lineTotal: isBranch || unit <= 0 ? null : unit * Math.max(1, parentQty),
    };
  });
}

/** Cart / POS place-order: main title + cart-style modifier rows (not brackets). */
export function receiptLinesFromCartLine(
  input: {
    productName: string;
    variationName?: string | null;
    quantity: number;
    lineTotal: number;
    modifiers: unknown;
  },
  lang: UiLanguage = DEFAULT_UI_LANGUAGE
): ReceiptItemLine[] {
  const title = cartLineTitle(input.productName, input.variationName, lang);
  const rows: ReceiptItemLine[] = [
    {
      name: title,
      qty: input.quantity,
      lineTotal: input.lineTotal,
    },
  ];
  rows.push(
    ...expandModifierLines(
      cartModifierDisplayTree(input.modifiers, lang),
      input.quantity
    )
  );
  return rows;
}

/** Reprint / kiosk: clean name + order modifier tree (not brackets). */
export function receiptLinesFromOrderItem(
  input: {
    name: string;
    quantity: number;
    lineTotal: number;
    modifiers?: Array<{
      name: string;
      menuItemId?: string | null;
      groupName?: string | null;
      unitPrice?: number;
      quantity?: number;
    }>;
  },
  lang: UiLanguage = DEFAULT_UI_LANGUAGE
): ReceiptItemLine[] {
  const cleaned =
    stripLegacyEmbeddedModifierSuffix(input.name) || input.name;
  const title = resolveBilingualText(cleaned, lang).trim() || cleaned;
  const rows: ReceiptItemLine[] = [
    {
      name: title,
      qty: input.quantity,
      lineTotal: input.lineTotal,
    },
  ];
  const mods = input.modifiers ?? [];
  if (mods.length === 0) return rows;
  rows.push(
    ...expandModifierLines(orderModifierDisplayTree(mods, lang), input.quantity)
  );
  return rows;
}
