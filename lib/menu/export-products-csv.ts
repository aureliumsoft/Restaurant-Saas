/** Escape a cell for RFC-style CSV (quotes + double quotes). */
function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  // BOM helps Excel open UTF-8 correctly
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export type ProductCsvExportItem = {
  name: string;
  description: string | null;
  price: number;
  salePrice: number | null;
  category: { name: string } | null;
  categoryLinks: Array<{
    sortOrder: number;
    category: { name: string } | null;
  }>;
  variations: Array<{
    name: string;
    title: string;
    priceDelta: number;
    sortOrder: number;
    swatchHex: string | null;
    restaurantVariation: {
      name: string;
      shortLabel: string | null;
    } | null;
  }>;
  attributeGroups: Array<{
    name: string;
    sortOrder: number;
    selectionType: string;
    required: boolean;
    sourceType: string;
    multipleMode: string | null;
    freeQuantity: number | null;
    minItems: number | null;
    maxItems: number | null;
    includeDefaultLinkedVariationPrice: boolean;
    useVariationPricing: boolean;
    linkedCategory: { name: string } | null;
    linkedProduct: { name: string } | null;
    defaultLinkedMenuItem: { name: string } | null;
    defaultLinkedRestaurantVariation: {
      name: string;
      shortLabel: string | null;
    } | null;
    variationLimits: Array<{
      minItems: number;
      maxItems: number;
      variation: { name: string; title: string } | null;
    }>;
  }>;
  offersFromThis: Array<{
    sortOrder: number;
    offeredItem: { name: string } | null;
  }>;
  personalizeGroups: Array<{
    parentName: string;
    maxItems: number;
    sortOrder: number;
    options: Array<{
      name: string;
      sortOrder: number;
    }>;
  }>;
  ingredientRecipes: Array<{
    quantity: number;
    menuItemVariationId: string | null;
    ingredient: { name: string } | null;
    variation: {
      name: string;
      title: string;
      restaurantVariation: {
        name: string;
        shortLabel: string | null;
      } | null;
    } | null;
  }>;
};

function categoryNames(p: ProductCsvExportItem): string {
  const names = [
    p.category?.name,
    ...p.categoryLinks.map((l) => l.category?.name),
  ].filter((n): n is string => Boolean(n && n.trim()));
  return [...new Set(names)].join('; ');
}

function variationsValue(p: ProductCsvExportItem): string {
  return (p.variations ?? [])
    .map((v) => {
      const label = (v.title || v.name || '').trim();
      const catalog = v.restaurantVariation
        ? ` [${v.restaurantVariation.shortLabel || v.restaurantVariation.name}]`
        : '';
      const delta =
        v.priceDelta === 0
          ? ''
          : v.priceDelta > 0
            ? ` +${v.priceDelta}`
            : ` ${v.priceDelta}`;
      const swatch = v.swatchHex ? ` ${v.swatchHex}` : '';
      return `${label}${catalog}${delta}${swatch}`;
    })
    .filter(Boolean)
    .join('; ');
}

function recommendationsValue(p: ProductCsvExportItem): string {
  return (p.attributeGroups ?? [])
    .map((g) => {
      const parts = [
        g.name,
        g.selectionType,
        g.required ? 'required' : 'optional',
        g.sourceType,
      ];
      if (g.linkedCategory?.name) parts.push(`category:${g.linkedCategory.name}`);
      if (g.linkedProduct?.name) parts.push(`product:${g.linkedProduct.name}`);
      if (g.defaultLinkedMenuItem?.name) {
        parts.push(`default:${g.defaultLinkedMenuItem.name}`);
      }
      if (g.defaultLinkedRestaurantVariation?.name) {
        parts.push(
          `defaultVar:${g.defaultLinkedRestaurantVariation.shortLabel || g.defaultLinkedRestaurantVariation.name}`
        );
      }
      if (g.minItems != null || g.maxItems != null) {
        parts.push(`limits:${g.minItems ?? ''}-${g.maxItems ?? ''}`);
      }
      if (g.freeQuantity != null) parts.push(`free:${g.freeQuantity}`);
      if (g.multipleMode) parts.push(g.multipleMode);
      if (g.useVariationPricing) parts.push('variationPricing');
      if (g.includeDefaultLinkedVariationPrice) {
        parts.push('includeDefaultVarPrice');
      }
      if (g.variationLimits?.length) {
        const lim = g.variationLimits
          .map((l) => {
            const vName =
              l.variation?.title || l.variation?.name || 'variation';
            return `${vName}:${l.minItems}-${l.maxItems}`;
          })
          .join(', ');
        parts.push(`varLimits(${lim})`);
      }
      return parts.join(' | ');
    })
    .join(' || ');
}

function offersValue(p: ProductCsvExportItem): string {
  return (p.offersFromThis ?? [])
    .map((o) => o.offeredItem?.name)
    .filter((n): n is string => Boolean(n))
    .join('; ');
}

function personalizeValue(p: ProductCsvExportItem): string {
  return (p.personalizeGroups ?? [])
    .map((g) => {
      const opts = (g.options ?? []).map((o) => o.name).join(', ');
      return `${g.parentName} (max ${g.maxItems}): ${opts}`;
    })
    .join(' || ');
}

function variationRecipeLabel(
  variation: NonNullable<ProductCsvExportItem['ingredientRecipes'][number]['variation']>
): string {
  const label = (variation.title || variation.name || '').trim();
  const catalog = variation.restaurantVariation
    ? variation.restaurantVariation.shortLabel || variation.restaurantVariation.name
    : '';
  if (catalog && catalog.trim() && catalog.trim().toLowerCase() !== label.toLowerCase()) {
    return `${label} [${catalog.trim()}]`;
  }
  return label;
}

/**
 * Simple: `Beef patty:1; Burger bun:1`
 * Per variation: `Small | Cola syrup:30 || Large | Cola syrup:50`
 */
function ingredientsValue(p: ProductCsvExportItem): string {
  const recipes = (p.ingredientRecipes ?? []).filter(
    (r) => r.ingredient?.name?.trim() && r.quantity > 0
  );
  if (recipes.length === 0) return '';

  const lineText = (rows: typeof recipes) =>
    rows
      .map((r) => `${r.ingredient!.name.trim()}:${r.quantity}`)
      .join('; ');

  const simple = recipes.filter((r) => !r.menuItemVariationId);
  const byVariation = new Map<string, typeof recipes>();
  for (const r of recipes) {
    if (!r.menuItemVariationId) continue;
    const key = r.menuItemVariationId;
    const list = byVariation.get(key) ?? [];
    list.push(r);
    byVariation.set(key, list);
  }

  const parts: string[] = [];
  if (simple.length > 0) parts.push(lineText(simple));
  for (const rows of byVariation.values()) {
    const label = rows[0]?.variation
      ? variationRecipeLabel(rows[0].variation)
      : 'Variation';
    parts.push(`${label} | ${lineText(rows)}`);
  }
  return parts.join(' || ');
}

/**
 * Single CSV: one row per product, all non-image field values, no IDs.
 */
export function buildProductsCsv(products: ProductCsvExportItem[]): string {
  const headers = [
    'name',
    'description',
    'price',
    'salePrice',
    'categories',
    'variations',
    'recommendations',
    'offers',
    'personalize',
    'ingredients',
  ];

  const rows = products.map((p) => [
    p.name ?? '',
    p.description ?? '',
    p.price ?? 0,
    p.salePrice ?? '',
    categoryNames(p),
    variationsValue(p),
    recommendationsValue(p),
    offersValue(p),
    personalizeValue(p),
    ingredientsValue(p),
  ]);

  return rowsToCsv(headers, rows);
}
