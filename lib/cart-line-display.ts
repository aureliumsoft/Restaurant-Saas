export type CartModifierSelectionLike = {
  selections: { name: string }[];
};

/** Addon / recommendation names only — no category group labels. */
export function cartModifierSelectionNames(
  modifiers: CartModifierSelectionLike[]
): string[] {
  const names: string[] = [];
  for (const mod of modifiers) {
    for (const sel of mod.selections) {
      const n = sel.name.trim();
      if (n.length > 0) names.push(n);
    }
  }
  return names;
}

export function cartLineTitle(
  productName: string,
  variationName?: string | null
): string {
  const base = productName.trim();
  const variation = variationName?.trim();
  return variation ? `${base} (${variation})` : base;
}
