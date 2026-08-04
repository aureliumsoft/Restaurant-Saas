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
  createdAt: Date;
  updatedAt: Date;
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
    'createdAt',
    'updatedAt',
  ];

  const rows = products.map((p) => {
    const created =
      p.createdAt instanceof Date
        ? p.createdAt.toISOString()
        : String(p.createdAt ?? '');
    const updated =
      p.updatedAt instanceof Date
        ? p.updatedAt.toISOString()
        : String(p.updatedAt ?? '');

    return [
      p.name ?? '',
      p.description ?? '',
      p.price ?? 0,
      p.salePrice ?? '',
      categoryNames(p),
      variationsValue(p),
      recommendationsValue(p),
      offersValue(p),
      personalizeValue(p),
      created,
      updated,
    ];
  });

  return rowsToCsv(headers, rows);
}
