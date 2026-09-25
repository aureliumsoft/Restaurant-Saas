import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import { normalizeCartModifiers } from '@/lib/cart-normalize';
import {
  DEFAULT_UI_LANGUAGE,
  type UiLanguage,
} from '@/lib/i18n/resources';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';

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

type CartTreeChild = {
  name: string;
  unitPrice: number;
};

type CartTreeNode = {
  key: string;
  name: string;
  unitPrice: number;
  children: CartTreeChild[];
};

function selectionKey(groupId: string, optionId: string) {
  return `${groupId}:${optionId}`;
}

function isSizeLikeChild(parentName: string, childName: string) {
  const parent = parentName.trim().toLowerCase();
  const child = childName.trim().toLowerCase();
  if (!parent || !child || parent === child) return false;
  return (
    child.startsWith(`${parent} `) ||
    child.startsWith(`${parent}(`) ||
    child.startsWith(`${parent} (`)
  );
}

function foldSizeLikeChildren(node: CartTreeNode) {
  const kept: CartTreeChild[] = [];
  for (const child of node.children) {
    if (isSizeLikeChild(node.name, child.name)) {
      node.name = child.name.trim();
      node.unitPrice += child.unitPrice;
      continue;
    }
    kept.push(child);
  }
  node.children = kept;
}

/**
 * Belorder-style composed cart: each wrap/fries line is ↳, extras nest as dashes.
 * Nested XL/size options fold onto the parent name instead of a sibling row.
 */
function buildCartModifierForest(modifiers: unknown): CartTreeNode[] {
  const nodes: CartTreeNode[] = [];
  const byKey = new Map<string, CartTreeNode>();

  for (const group of normalizeCartModifiers(modifiers)) {
    const parentKey = group.parentSelectionKey?.trim() || '';
    const parentNode = parentKey ? byKey.get(parentKey) : undefined;

    if (parentNode) {
      for (const sel of group.selections) {
        if (isPersonalizeModifierMenuItemId(sel.menuItemId)) {
          parentNode.children.push({
            name: sel.name,
            unitPrice: sel.unitPrice,
          });
          continue;
        }
        parentNode.children.push({
          name: sel.name,
          unitPrice: sel.unitPrice,
        });
      }
      continue;
    }

    for (const sel of group.selections) {
      const previous = nodes[nodes.length - 1];
      if (
        previous &&
        !isPersonalizeModifierMenuItemId(sel.menuItemId) &&
        isSizeLikeChild(previous.name, sel.name)
      ) {
        previous.name = sel.name.trim();
        previous.unitPrice += sel.unitPrice;
        continue;
      }

      const key = selectionKey(group.attributeGroupId, sel.menuItemId);
      const node: CartTreeNode = {
        key,
        name: sel.name,
        unitPrice: sel.unitPrice,
        children: [],
      };
      nodes.push(node);
      if (sel.menuItemId) byKey.set(key, node);
    }
  }

  for (const node of nodes) foldSizeLikeChildren(node);
  return nodes;
}

function forestToDisplayLines(nodes: CartTreeNode[]): CartModifierDisplayLine[] {
  const lines: CartModifierDisplayLine[] = [];
  for (const node of nodes) {
    lines.push({
      prefix: 'branch',
      name: node.name,
      unitPrice: node.unitPrice,
    });
    for (const child of node.children) {
      lines.push({
        prefix: 'dash',
        name: child.name,
        unitPrice: child.unitPrice,
      });
    }
  }
  return lines;
}

/** Cart sidebar lines: ↳ composed item, - nested extra. */
export function cartModifierDisplayLines(
  modifiers: Array<{
    selections?: {
      name?: string | null;
      menuItemId?: string;
      unitPrice?: number;
    }[];
  }> | unknown
): CartModifierDisplayLine[] {
  return forestToDisplayLines(buildCartModifierForest(modifiers));
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
 * Resolve bilingual group titles and strip "Choose" / "Choose from" /
 * "Choose add-ons (...)" (and Spanish equivalents) so only the recommended
 * category or product name remains. Nested labels
 * (`Parent — Choose from Sauces`) keep the leaf name (Sauces).
 */
export function recommendationGroupDisplayLabel(
  raw: unknown,
  lang: UiLanguage = DEFAULT_UI_LANGUAGE
): string {
  const resolved = resolveBilingualText(raw, lang).trim();
  const source = resolved || String(raw ?? '').trim();
  if (!source) return 'Add-ons';

  const stripPart = (part: string): string => {
    let s = part.trim();
    if (!s) return '';
    const addOnsEn = s.match(/^Choose add-ons\s*\((.+)\)\s*$/i);
    if (addOnsEn?.[1]) return addOnsEn[1].trim();
    const addOnsEs = s.match(/^Elige complementos\s*\((.+)\)\s*$/i);
    if (addOnsEs?.[1]) return addOnsEs[1].trim();
    s = s.replace(/^Choose from\s+/i, '');
    s = s.replace(/^Elige de\s+/i, '');
    s = s.replace(/^Elige entre\s+/i, '');
    s = s.replace(/^Choose\s+/i, '');
    s = s.replace(/^Elige\s+/i, '');
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
 * ↳ Imperial Wrap XL (+2,00 €)
 * - Algerian spicy
 * ↳ Loaded Fries
 * - Barbecue (+0,30 €)
 */
export function cartModifierDisplayTree(modifiers: unknown): ModifierDisplayLine[] {
  return forestToDisplayLines(buildCartModifierForest(modifiers)).map((line) => ({
    style: line.prefix,
    name: line.name,
    unitPrice: line.unitPrice,
  }));
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
