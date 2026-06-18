import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';

export type CartModifierSelectionLike = {
  selections: { name: string; menuItemId?: string }[];
};

function selectionNames(
  modifiers: CartModifierSelectionLike[],
  personalize: boolean
): string[] {
  const names: string[] = [];
  for (const mod of modifiers) {
    for (const sel of mod.selections) {
      const isPersonalize = sel.menuItemId
        ? isPersonalizeModifierMenuItemId(sel.menuItemId)
        : false;
      if (isPersonalize !== personalize) continue;
      const n = sel.name.trim();
      if (n.length > 0) names.push(n);
    }
  }
  return names;
}

export type CartModifierDisplayLine = {
  prefix: 'branch' | 'dash';
  name: string;
  unitPrice: number;
};

/** Cart sidebar lines with ↳ personalize vs - addon prefixes. */
export function cartModifierDisplayLines(
  modifiers: Array<{
    selections: { name: string; menuItemId?: string; unitPrice?: number }[];
  }>
): CartModifierDisplayLine[] {
  const lines: CartModifierDisplayLine[] = [];
  for (const mod of modifiers) {
    for (const sel of mod.selections) {
      const name = sel.name.trim();
      if (!name) continue;
      const isPersonalize = sel.menuItemId
        ? isPersonalizeModifierMenuItemId(sel.menuItemId)
        : false;
      lines.push({
        prefix: isPersonalize ? 'branch' : 'dash',
        name,
        unitPrice: sel.unitPrice ?? 0,
      });
    }
  }
  return lines;
}

/** Personalize selections — shown below the product name. */
export function cartPersonalizeSelectionNames(
  modifiers: CartModifierSelectionLike[]
): string[] {
  return selectionNames(modifiers, true);
}

/** Addon / recommendation names only — no personalize, no category group labels. */
export function cartModifierSelectionNames(
  modifiers: CartModifierSelectionLike[]
): string[] {
  return selectionNames(modifiers, false);
}

export function cartLineTitle(
  productName: string,
  variationName?: string | null
): string {
  const base = productName.trim();
  const variation = variationName?.trim();
  return variation ? `${base} (${variation})` : base;
}
