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
