import {
  cartLineTitle,
  recommendationGroupDisplayLabel,
} from '@/lib/cart-line-display';
import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';

export type KitchenTicketModifierInput = {
  name: string;
  quantity: number;
  menuItemId?: string | null;
  groupName?: string | null;
};

export type KitchenTicketLineInput = {
  quantity: number;
  productName?: string | null;
  variationName?: string | null;
  menuItem?: { name?: string | null } | null;
  modifiers: KitchenTicketModifierInput[];
};

/** Marks personalize kitchen rows so KDS can render them plain (no ↳ / qty×). */
const KITCHEN_PERSONALIZE_MARKER = '\u200B';

export function isKitchenPersonalizeModifier(mod: {
  menuItemId?: string | null;
}): boolean {
  if (mod.menuItemId == null) return true;
  return isPersonalizeModifierMenuItemId(mod.menuItemId);
}

/** Main product line only — modifiers are separate kitchen ticket rows. */
export function kitchenTicketMainLineName(line: KitchenTicketLineInput): string {
  // Prefer the order snapshot so parent variation in `Product (XL)` is kept.
  // Live menuItem.name is the base product only and would hide the variation.
  const snap = line.productName?.trim();
  if (snap) {
    const stripped = stripLegacyEmbeddedModifierSuffix(snap);
    if (stripped) {
      const variation = line.variationName?.trim();
      if (
        variation &&
        !stripped.toLowerCase().includes(`(${variation.toLowerCase()})`)
      ) {
        return cartLineTitle(stripped, variation);
      }
      return stripped;
    }
  }

  const fromMenu = line.menuItem?.name?.trim();
  if (fromMenu) return cartLineTitle(fromMenu, line.variationName);

  return cartLineTitle(line.productName ?? 'Item', line.variationName);
}

/** Strip trailing `(a, b; Group: x)` baked modifier lists; keep simple `(variation)`. */
export function stripLegacyEmbeddedModifierSuffix(name: string): string {
  let base = name.trim();
  if (!base) return base;

  let changed = true;
  while (changed) {
    changed = false;
    if (!base.endsWith(')')) break;

    // Walk backwards so nested parens like `(Tacos (XL), Pepsi)` still match.
    let depth = 0;
    let openAt = -1;
    for (let i = base.length - 1; i >= 0; i--) {
      const ch = base[i];
      if (ch === ')') depth += 1;
      else if (ch === '(') {
        depth -= 1;
        if (depth === 0) {
          openAt = i;
          break;
        }
      }
    }
    if (openAt <= 0) break;
    if (!/\s/.test(base[openAt - 1]!)) break;

    const before = base.slice(0, openAt).trimEnd();
    const inner = base.slice(openAt + 1, -1).trim();
    if (!inner.includes(',') && !inner.includes(':') && !inner.includes(';')) {
      break;
    }
    if (!before) break;
    base = before;
    changed = true;
  }

  return base || name.trim();
}

function isSizeLikeChildName(parentName: string, childName: string): boolean {
  const parent = parentName.trim().toLowerCase();
  const child = childName.trim().toLowerCase();
  if (!parent || !child || parent === child) return false;
  return (
    child.startsWith(`${parent} `) ||
    child.startsWith(`${parent}(`) ||
    child.startsWith(`${parent} (`)
  );
}

/**
 * Kitchen rows:
 * Burger (XL)
 * No onions          ← personalize first, no arrow
 * ↳ Sauces
 * - Tomato
 * ↳ Drink
 * - Coke
 *
 * Recommendation size/variation options fold onto the parent selection name
 * (same as cart), e.g. "Los Tacos Chuncky" + "Los Tacos Chuncky (TALLA XL)".
 */
export function buildKitchenTicketItemRows(
  lines: KitchenTicketLineInput[]
): { productName: string; quantity: number }[] {
  const rows: { productName: string; quantity: number }[] = [];

  for (const line of lines) {
    rows.push({
      productName: kitchenTicketMainLineName(line),
      quantity: line.quantity,
    });

    const personalize: KitchenTicketModifierInput[] = [];
    const others: KitchenTicketModifierInput[] = [];
    for (const mod of line.modifiers) {
      const modName = String(mod.name || '').trim();
      if (!modName) continue;
      if (isKitchenPersonalizeModifier(mod)) personalize.push(mod);
      else others.push(mod);
    }

    for (const mod of personalize) {
      rows.push({
        productName: `${KITCHEN_PERSONALIZE_MARKER}${String(mod.name).trim()}`,
        quantity: 0,
      });
    }

    type Folded = {
      header: string;
      name: string;
      quantity: number;
    };
    const folded: Folded[] = [];
    for (const mod of others) {
      const modName = String(mod.name || '').trim();
      const header = recommendationGroupDisplayLabel(mod.groupName || 'Add-ons');
      const qty = mod.quantity > 0 ? mod.quantity : 1;
      const previous = folded[folded.length - 1];
      if (
        previous &&
        previous.header === header &&
        isSizeLikeChildName(previous.name, modName)
      ) {
        previous.name = modName;
        previous.quantity = qty;
        continue;
      }
      folded.push({ header, name: modName, quantity: qty });
    }

    let lastHeader: string | null = null;
    for (const mod of folded) {
      if (mod.header !== lastHeader) {
        rows.push({ productName: `↳ ${mod.header}`, quantity: 0 });
        lastHeader = mod.header;
      }
      rows.push({
        productName: `- ${mod.name}`,
        quantity: mod.quantity,
      });
    }
  }

  return rows;
}

export type KitchenTicketItemDisplay =
  | { kind: 'main'; name: string; quantity: number }
  | { kind: 'branch'; name: string }
  | { kind: 'nested'; name: string; quantity: number }
  | { kind: 'personalize'; name: string }
  | { kind: 'addon'; name: string; quantity: number };

export function isLegacyBakedKitchenTicketName(name: string): boolean {
  const trimmed = String(name || '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('↳') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-')
  ) {
    return false;
  }
  return /\([^)]*,[^)]*\)/.test(trimmed);
}

export function kitchenTicketItemsLookLegacy(
  items: { productName: string }[]
): boolean {
  if (items.length === 0) return false;
  const hasStructured = items.some((item) => {
    const name = item.productName.trim();
    return (
      name.startsWith('↳') || name.startsWith('+') || name.startsWith('-')
    );
  });
  if (hasStructured) {
    return items.some((item) => isLegacyBakedKitchenTicketName(item.productName));
  }
  return items.some((item) => isLegacyBakedKitchenTicketName(item.productName));
}

export function kitchenTicketDisplayRows(
  lines: KitchenTicketLineInput[]
): { productName: string; quantity: number }[] {
  return buildKitchenTicketItemRows(lines);
}

export function kitchenTicketModifierPrefix(mod: {
  menuItemId?: string | null;
}): '' | '- ' {
  return isKitchenPersonalizeModifier(mod) ? '' : '- ';
}

export function parseKitchenTicketItemDisplay(
  productName: string,
  quantity: number
): KitchenTicketItemDisplay {
  const raw = String(productName || '');
  if (raw.startsWith(KITCHEN_PERSONALIZE_MARKER)) {
    return {
      kind: 'personalize',
      name: raw.slice(KITCHEN_PERSONALIZE_MARKER.length).trim(),
    };
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith('↳')) {
    return {
      kind: 'branch',
      name: trimmed.replace(/^↳\s*/, '').trim(),
    };
  }
  if (trimmed.startsWith('-')) {
    return {
      kind: 'nested',
      name: trimmed.replace(/^-\s*/, '').trim(),
      quantity: quantity > 0 ? quantity : 1,
    };
  }
  if (trimmed.startsWith('+')) {
    return {
      kind: 'addon',
      name: trimmed.replace(/^\+\s*/, '').trim(),
      quantity: quantity > 0 ? quantity : 1,
    };
  }

  return {
    kind: 'main',
    name: stripLegacyEmbeddedModifierSuffix(trimmed) || trimmed,
    quantity: quantity > 0 ? quantity : 1,
  };
}
