import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import { normalizeCartModifiers } from '@/lib/cart-normalize';

export type CartModifierSelectionLike = {
  selections: { name?: string | null; menuItemId?: string }[];
};

function selectionNames(
  modifiers: CartModifierSelectionLike[],
  personalize: boolean
): string[] {
  const names: string[] = [];
  for (const mod of modifiers) {
    const selections = Array.isArray(mod.selections) ? mod.selections : [];
    for (const sel of selections) {
      const isPersonalize = sel.menuItemId
        ? isPersonalizeModifierMenuItemId(sel.menuItemId)
        : false;
      if (isPersonalize !== personalize) continue;
      const n = String(sel.name ?? '').trim();
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
    selections?: {
      name?: string | null;
      menuItemId?: string;
      unitPrice?: number;
    }[];
  }> | unknown
): CartModifierDisplayLine[] {
  const lines: CartModifierDisplayLine[] = [];
  for (const mod of normalizeCartModifiers(modifiers)) {
    for (const sel of mod.selections) {
      lines.push({
        prefix: sel.menuItemId
          ? isPersonalizeModifierMenuItemId(sel.menuItemId)
            ? 'branch'
            : 'dash'
          : 'dash',
        name: sel.name,
        unitPrice: sel.unitPrice,
      });
    }
  }
  return lines;
}

/** Personalize selections — shown below the product name. */
export function cartPersonalizeSelectionNames(
  modifiers: CartModifierSelectionLike[] | unknown
): string[] {
  return selectionNames(
    Array.isArray(modifiers) ? modifiers : normalizeCartModifiers(modifiers),
    true
  );
}

/** Addon / recommendation names only — no personalize, no category group labels. */
export function cartModifierSelectionNames(
  modifiers: CartModifierSelectionLike[] | unknown
): string[] {
  return selectionNames(
    Array.isArray(modifiers) ? modifiers : normalizeCartModifiers(modifiers),
    false
  );
}

export function cartLineTitle(
  productName: string | null | undefined,
  variationName?: string | null
): string {
  const base = String(productName ?? '').trim() || 'Item';
  const variation = variationName?.trim();
  return variation ? `${base} (${variation})` : base;
}

export type ModifierDisplaySection = {
  kind: 'personalize' | 'recommendation';
  label: string;
  lines: Array<{
    name: string;
    unitPrice?: number;
    quantity?: number;
  }>;
};

/** Grouped personalize vs recommendation sections with labels for cart lines. */
export function cartModifierDisplaySections(
  modifiers: unknown
): ModifierDisplaySection[] {
  const normalized = normalizeCartModifiers(modifiers);
  const personalizeLines: ModifierDisplaySection['lines'] = [];
  const recommendationByGroup = new Map<string, ModifierDisplaySection['lines']>();

  for (const group of normalized) {
    for (const sel of group.selections) {
      const line = { name: sel.name, unitPrice: sel.unitPrice };
      if (isPersonalizeModifierMenuItemId(sel.menuItemId)) {
        personalizeLines.push(line);
      } else {
        const label = group.groupName?.trim() || 'Add-ons';
        const existing = recommendationByGroup.get(label) ?? [];
        existing.push(line);
        recommendationByGroup.set(label, existing);
      }
    }
  }

  const sections: ModifierDisplaySection[] = [];
  if (personalizeLines.length > 0) {
    sections.push({
      kind: 'personalize',
      label: 'Personalize',
      lines: personalizeLines,
    });
  }
  for (const [label, lines] of recommendationByGroup) {
    sections.push({ kind: 'recommendation', label, lines });
  }
  return sections;
}

/** Grouped sections from persisted order modifiers (menuItemId null = personalize). */
export function orderModifierDisplaySections(
  modifiers: Array<{
    name: string;
    menuItemId?: string | null;
    unitPrice?: number;
    quantity?: number;
  }>
): ModifierDisplaySection[] {
  const personalizeLines: ModifierDisplaySection['lines'] = [];
  const addonLines: ModifierDisplaySection['lines'] = [];

  for (const mod of modifiers) {
    const name = String(mod.name ?? '').trim();
    if (!name) continue;
    const line = {
      name,
      unitPrice: mod.unitPrice,
      quantity: mod.quantity,
    };
    if (!mod.menuItemId) {
      personalizeLines.push(line);
    } else {
      addonLines.push(line);
    }
  }

  const sections: ModifierDisplaySection[] = [];
  if (personalizeLines.length > 0) {
    sections.push({
      kind: 'personalize',
      label: 'Personalize',
      lines: personalizeLines,
    });
  }
  if (addonLines.length > 0) {
    sections.push({
      kind: 'recommendation',
      label: 'Add-ons',
      lines: addonLines,
    });
  }
  return sections;
}

/** Kitchen ticket / receipt single-line label — selection names only, no group titles. */
export function ticketProductName(
  productName: string,
  modifiers: unknown
): string {
  const groups = normalizeCartModifiers(modifiers);
  if (!groups.length) return productName;
  const names: string[] = [];
  for (const group of groups) {
    for (const sel of group.selections) {
      const name = String(sel.name ?? '').trim();
      if (name) names.push(name);
    }
  }
  if (!names.length) return productName;
  return `${productName} (${names.join(', ')})`;
}

export function cartLineDisplayName(
  productName: string,
  variationName: string | null | undefined,
  modifiers: unknown
): string {
  return ticketProductName(
    cartLineTitle(productName, variationName),
    modifiers
  );
}

export type ProductImageSource = {
  id: string;
  imageUrl?: string | null;
};

/** Map menu item id → image URL for cart display hydration. */
export function buildProductImageByIdMap(
  products: Iterable<ProductImageSource>
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const product of products) {
    const id = String(product.id ?? '').trim();
    if (!id) continue;
    const url =
      typeof product.imageUrl === 'string' && product.imageUrl.trim()
        ? product.imageUrl.trim()
        : null;
    map.set(id, url);
  }
  return map;
}

/** Prefer stored URL; fall back to live menu catalog (storage may omit images). */
export function resolveCartLineImageUrl(
  line: { menuItemId?: string | null; imageUrl?: string | null },
  productImageById?: Map<string, string | null> | null
): string | null {
  const stored =
    typeof line.imageUrl === 'string' && line.imageUrl.trim()
      ? line.imageUrl.trim()
      : null;
  if (stored) return stored;

  const menuItemId = String(line.menuItemId ?? '').trim();
  if (!menuItemId || !productImageById) return null;
  return productImageById.get(menuItemId) ?? null;
}
