import { cartLineTitle } from '@/lib/cart-line-display';
import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import { orderItemDisplayName } from '@/lib/orders/order-item-name';

export type KitchenTicketModifierInput = {
  name: string;
  quantity: number;
  menuItemId?: string | null;
};

export type KitchenTicketLineInput = {
  quantity: number;
  productName?: string | null;
  variationName?: string | null;
  menuItem?: { name?: string | null } | null;
  modifiers: KitchenTicketModifierInput[];
};

export function isKitchenPersonalizeModifier(mod: {
  menuItemId?: string | null;
}): boolean {
  if (mod.menuItemId == null) return true;
  return isPersonalizeModifierMenuItemId(mod.menuItemId);
}

export function kitchenTicketModifierPrefix(mod: {
  menuItemId?: string | null;
}): '↳ ' | '+ ' {
  return isKitchenPersonalizeModifier(mod) ? '↳ ' : '+ ';
}

/** Main product line only — modifiers are separate kitchen ticket rows. */
export function kitchenTicketMainLineName(line: KitchenTicketLineInput): string {
  const fromMenu = line.menuItem?.name?.trim();
  if (fromMenu) return fromMenu;

  const snap = line.productName?.trim();
  if (snap) {
    const stripped = stripLegacyEmbeddedModifierSuffix(snap);
    if (stripped) return stripped;
  }

  return cartLineTitle(line.productName ?? 'Item', line.variationName);
}

/** Remove modifier lists baked into legacy single-line ticket names. */
function stripLegacyEmbeddedModifierSuffix(name: string): string {
  let base = name.trim();
  if (!base) return base;

  // Drop trailing parenthetical blocks that look like comma-separated modifier lists.
  let changed = true;
  while (changed) {
    changed = false;
    const match = base.match(/^(.*)\s+\(([^()]+)\)\s*$/);
    if (!match) break;
    const inner = match[2].trim();
    if (!inner.includes(',') && !inner.includes(':') && !inner.includes(';')) {
      break;
    }
    base = match[1].trim();
    changed = true;
  }

  return base || name.trim();
}

export function buildKitchenTicketItemRows(
  lines: KitchenTicketLineInput[]
): { productName: string; quantity: number }[] {
  const rows: { productName: string; quantity: number }[] = [];

  for (const line of lines) {
    rows.push({
      productName: kitchenTicketMainLineName(line),
      quantity: line.quantity,
    });

    for (const mod of line.modifiers) {
      const modName = String(mod.name || '').trim();
      if (!modName) continue;
      rows.push({
        productName: `${kitchenTicketModifierPrefix(mod)}${modName}`,
        quantity: mod.quantity > 0 ? mod.quantity : 1,
      });
    }
  }

  return rows;
}

export type KitchenTicketItemDisplay =
  | { kind: 'main'; name: string; quantity: number }
  | { kind: 'personalize'; name: string }
  | { kind: 'addon'; name: string; quantity: number };

/** True when a ticket row still has modifiers baked into one parenthetical string. */
export function isLegacyBakedKitchenTicketName(name: string): boolean {
  const trimmed = String(name || '').trim();
  if (!trimmed || trimmed.startsWith('↳') || trimmed.startsWith('+')) {
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
    return name.startsWith('↳') || name.startsWith('+');
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

export function parseKitchenTicketItemDisplay(
  productName: string,
  quantity: number
): KitchenTicketItemDisplay {
  const trimmed = String(productName || '').trim();
  if (trimmed.startsWith('↳')) {
    return {
      kind: 'personalize',
      name: trimmed.replace(/^↳\s*/, '').trim(),
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
