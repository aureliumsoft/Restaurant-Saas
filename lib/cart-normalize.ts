/** Normalized cart modifier row — safe for display and price math. */
export type CartModifierSelectionNormalized = {
  attributeGroupId: string;
  groupName: string;
  selections: {
    menuItemId: string;
    name: string;
    unitPrice: number;
  }[];
};

export type CartLinePricingInput = {
  baseUnitPrice: number;
  quantity?: number;
  variationId?: string | null;
  variationName?: string | null;
  variationPriceOverride?: number | null;
  /** Kiosk cart uses price delta for variations. */
  variationPriceDelta?: number | null;
  modifiers: unknown;
};

/** Coerce stored / API cart modifiers so UI never crashes on missing fields. */
export function normalizeCartModifiers(
  modifiers: unknown
): CartModifierSelectionNormalized[] {
  if (!Array.isArray(modifiers)) return [];

  const out: CartModifierSelectionNormalized[] = [];
  for (const mod of modifiers) {
    if (!mod || typeof mod !== 'object') continue;
    const row = mod as Record<string, unknown>;
    const selectionsRaw = Array.isArray(row.selections) ? row.selections : [];
    const selections = selectionsRaw
      .map((sel) => {
        if (!sel || typeof sel !== 'object') return null;
        const s = sel as Record<string, unknown>;
        const menuItemId = String(s.menuItemId ?? s.id ?? '').trim();
        const name = String(s.name ?? '').trim() || 'Option';
        const unitPrice = Number(s.unitPrice);
        return {
          menuItemId,
          name,
          unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    out.push({
      attributeGroupId: String(row.attributeGroupId ?? ''),
      groupName: String(row.groupName ?? ''),
      selections,
    });
  }
  return out;
}

function safeBaseUnitPrice(line: CartLinePricingInput): number {
  const base = Number(line.baseUnitPrice);
  if (!line.variationId) {
    return Number.isFinite(base) ? base : 0;
  }
  if (line.variationPriceOverride != null) {
    const v = Number(line.variationPriceOverride);
    if (Number.isFinite(v)) return v;
  }
  if (line.variationPriceDelta != null) {
    const v = Number(line.variationPriceDelta);
    if (Number.isFinite(v)) return v;
  }
  return Number.isFinite(base) ? base : 0;
}

export function cartLineUnitTotal(line: CartLinePricingInput): number {
  const mods = normalizeCartModifiers(line.modifiers);
  const modTotal = mods.reduce(
    (sum, m) =>
      sum + m.selections.reduce((inner, sel) => inner + sel.unitPrice, 0),
    0
  );
  return safeBaseUnitPrice(line) + modTotal;
}

export function cartLineTotal(
  line: CartLinePricingInput & { quantity: number }
): number {
  const qty = Number(line.quantity);
  return cartLineUnitTotal(line) * (Number.isFinite(qty) && qty > 0 ? qty : 1);
}
