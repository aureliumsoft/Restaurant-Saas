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

/**
 * Strip "Choose" / "Choose from" / "Choose add-ons (...)" so only the
 * recommended category or product name remains. Nested labels
 * (`Parent — Choose from Sauces`) keep the leaf name (Sauces).
 */
export function recommendationGroupDisplayLabel(raw: string): string {
  const source = String(raw ?? '').trim();
  if (!source) return 'Add-ons';

  const stripPart = (part: string): string => {
    let s = part.trim();
    if (!s) return '';
    const addOns = s.match(/^Choose add-ons\s*\((.+)\)\s*$/i);
    if (addOns?.[1]) return addOns[1].trim();
    s = s.replace(/^Choose from\s+/i, '');
    s = s.replace(/^Choose\s+/i, '');
    return s.trim();
  };

  const parts = source.split(/\s+—\s+/).map(stripPart).filter(Boolean);
  if (parts.length === 0) return source;
  // Nested: show the recommended category/product leaf, not the parent prefix.
  return parts[parts.length - 1]!;
}

export type ModifierDisplayLine = {
  /** ↳ category/product label, - selected product, plain = personalize (no arrow). */
  style: 'branch' | 'dash' | 'plain';
  name: string;
  unitPrice?: number;
  quantity?: number;
};

type ModifierDisplayBlock = {
  label: string;
  personalize?: boolean;
  lines: Array<{
    name: string;
    unitPrice?: number;
    quantity?: number;
  }>;
};

function pushBlock(
  blocks: ModifierDisplayBlock[],
  label: string,
  line: { name: string; unitPrice?: number; quantity?: number },
  personalize = false
) {
  const last = blocks[blocks.length - 1];
  if (last && last.label === label && Boolean(last.personalize) === personalize) {
    last.lines.push(line);
    return;
  }
  blocks.push({ label, personalize, lines: [line] });
}

function blocksToDisplayLines(
  blocks: ModifierDisplayBlock[]
): ModifierDisplayLine[] {
  const personalizeBlocks = blocks.filter((b) => b.personalize);
  const otherBlocks = blocks.filter((b) => !b.personalize);
  const ordered = [...personalizeBlocks, ...otherBlocks];

  const out: ModifierDisplayLine[] = [];
  for (const block of ordered) {
    if (block.lines.length === 0) continue;
    if (block.personalize) {
      // Personalize first, plain names — no ↳ / - prefix.
      for (const line of block.lines) {
        out.push({
          style: 'plain',
          name: line.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
        });
      }
      continue;
    }
    out.push({ style: 'branch', name: block.label });
    for (const line of block.lines) {
      out.push({
        style: 'dash',
        name: line.name,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
      });
    }
  }
  return out;
}

/**
 * Cart/checkout format:
 * No onions          ← personalize first, no arrow
 * ↳ Sauces
 * - Tomato (+€0.20)
 * ↳ Drink
 * - Coke
 */
export function cartModifierDisplayTree(modifiers: unknown): ModifierDisplayLine[] {
  const blocks: ModifierDisplayBlock[] = [];
  for (const group of normalizeCartModifiers(modifiers)) {
    for (const sel of group.selections) {
      const line = { name: sel.name, unitPrice: sel.unitPrice };
      if (isPersonalizeModifierMenuItemId(sel.menuItemId)) {
        pushBlock(blocks, 'Personalize', line, true);
      } else {
        pushBlock(
          blocks,
          recommendationGroupDisplayLabel(group.groupName || 'Add-ons'),
          line,
          false
        );
      }
    }
  }
  return blocksToDisplayLines(blocks);
}

export function orderModifierDisplayTree(
  modifiers: Array<{
    name: string;
    menuItemId?: string | null;
    groupName?: string | null;
    unitPrice?: number;
    quantity?: number;
  }>
): ModifierDisplayLine[] {
  const blocks: ModifierDisplayBlock[] = [];
  for (const mod of modifiers) {
    const name = String(mod.name ?? '').trim();
    if (!name) continue;
    const line = {
      name,
      unitPrice: mod.unitPrice,
      quantity: mod.quantity,
    };
    if (!mod.menuItemId) {
      pushBlock(blocks, 'Personalize', line, true);
    } else {
      pushBlock(
        blocks,
        recommendationGroupDisplayLabel(mod.groupName || 'Add-ons'),
        line,
        false
      );
    }
  }
  return blocksToDisplayLines(blocks);
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

/** @deprecated Prefer cartModifierDisplayTree. */
export function cartModifierDisplaySections(
  modifiers: unknown
): ModifierDisplaySection[] {
  const normalized = normalizeCartModifiers(modifiers);
  const personalizeLines: ModifierDisplaySection['lines'] = [];
  const recommendationByGroup = new Map<
    string,
    ModifierDisplaySection['lines']
  >();

  for (const group of normalized) {
    for (const sel of group.selections) {
      const line = { name: sel.name, unitPrice: sel.unitPrice };
      if (isPersonalizeModifierMenuItemId(sel.menuItemId)) {
        personalizeLines.push(line);
      } else {
        const label = recommendationGroupDisplayLabel(
          group.groupName?.trim() || 'Add-ons'
        );
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

/** @deprecated Prefer orderModifierDisplayTree. */
export function orderModifierDisplaySections(
  modifiers: Array<{
    name: string;
    menuItemId?: string | null;
    groupName?: string | null;
    unitPrice?: number;
    quantity?: number;
  }>
): ModifierDisplaySection[] {
  const personalizeLines: ModifierDisplaySection['lines'] = [];
  const recommendationByGroup = new Map<
    string,
    ModifierDisplaySection['lines']
  >();

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
      const label = recommendationGroupDisplayLabel(
        mod.groupName?.trim() || 'Add-ons'
      );
      const existing = recommendationByGroup.get(label) ?? [];
      existing.push(line);
      recommendationByGroup.set(label, existing);
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
