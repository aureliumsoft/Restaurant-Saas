/**
 * Parse products CSV with optional column mapping (WordPress-style import).
 * One row per product — no IDs, no images.
 */

export type CsvImportVariation = {
  name: string;
  title: string;
  priceDelta: number;
  sortOrder: number;
  swatchHex: string | null;
  catalogName: string | null;
};

export type CsvImportRecommendation = {
  name: string;
  sortOrder: number;
  selectionType: 'SINGLE' | 'MULTIPLE';
  required: boolean;
  sourceType: 'CATEGORY' | 'PRODUCT';
  multipleMode: 'QUANTITY' | 'CHECKBOX' | 'BOOLEAN' | null;
  freeQuantity: number | null;
  minItems: number | null;
  maxItems: number | null;
  linkedCategoryName: string | null;
  linkedProductName: string | null;
  defaultLinkedMenuItemName: string | null;
  defaultLinkedRestaurantVariationName: string | null;
  includeDefaultLinkedVariationPrice: boolean;
  useVariationPricing: boolean;
};

export type CsvImportPersonalizeGroup = {
  parentName: string;
  maxItems: number;
  sortOrder: number;
  options: string[];
};

export type CsvImportIngredient = {
  ingredientName: string;
  quantity: number;
  variationLabel: string | null;
};

export type CsvImportProduct = {
  name: string;
  description: string | null;
  price: number;
  salePrice: number | null;
  categoryNames: string[];
  variations: CsvImportVariation[];
  recommendations: CsvImportRecommendation[];
  offerProductNames: string[];
  personalizeGroups: CsvImportPersonalizeGroup[];
  ingredients: CsvImportIngredient[];
};

export type ParsedProductsCsvImport = {
  products: CsvImportProduct[];
  errors: string[];
};

/** Fields the importer can write to MenuItem / related value columns. */
export const PRODUCT_IMPORT_FIELDS = [
  {
    key: 'name',
    label: 'Product name',
    table: 'MenuItem',
    required: true,
  },
  {
    key: 'description',
    label: 'Description',
    table: 'MenuItem',
    required: false,
  },
  {
    key: 'price',
    label: 'Price',
    table: 'MenuItem',
    required: false,
  },
  {
    key: 'salePrice',
    label: 'Sale price',
    table: 'MenuItem',
    required: false,
  },
  {
    key: 'categories',
    label: 'Categories',
    table: 'MenuCategory / MenuItemCategory',
    required: false,
  },
  {
    key: 'variations',
    label: 'Variations',
    table: 'MenuItemVariation',
    required: false,
  },
  {
    key: 'ingredients',
    label: 'Ingredients',
    table: 'MenuItemIngredient',
    required: false,
  },
  {
    key: 'recommendations',
    label: 'Recommendations',
    table: 'MenuItemAttributeGroup',
    required: false,
  },
  {
    key: 'offers',
    label: 'Offers',
    table: 'MenuItemOffer',
    required: false,
  },
  {
    key: 'personalize',
    label: 'Personalize',
    table: 'MenuItemPersonalizeGroup',
    required: false,
  },
] as const;

export type ProductImportFieldKey = (typeof PRODUCT_IMPORT_FIELDS)[number]['key'];

/** Maps each DB field key → CSV header name (empty string = do not import). */
export type ColumnMapping = Record<ProductImportFieldKey, string>;

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** RFC-style CSV parser (quotes, commas, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const input = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return rows.map((r) =>
    r.length >= width ? r : [...r, ...Array(width - r.length).fill('')]
  );
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const HEADER_ALIASES: Record<string, ProductImportFieldKey> = {
  name: 'name',
  productname: 'name',
  product: 'name',
  description: 'description',
  price: 'price',
  saleprice: 'salePrice',
  sale: 'salePrice',
  categories: 'categories',
  category: 'categories',
  primarycategoryname: 'categories',
  variations: 'variations',
  recommendations: 'recommendations',
  offers: 'offers',
  personalize: 'personalize',
  ingredients: 'ingredients',
  ingredient: 'ingredients',
  recipe: 'ingredients',
  recipes: 'ingredients',
  recipeingredients: 'ingredients',
  ingredientrecipes: 'ingredients',
  linkedingredients: 'ingredients',
  productingredients: 'ingredients',
};

export function emptyColumnMapping(): ColumnMapping {
  return {
    name: '',
    description: '',
    price: '',
    salePrice: '',
    categories: '',
    variations: '',
    recommendations: '',
    offers: '',
    personalize: '',
    ingredients: '',
  };
}

function guessFieldFromHeader(header: string): ProductImportFieldKey | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  const alias = HEADER_ALIASES[normalized];
  if (alias) return alias;
  if (normalized.includes('ingredient') || normalized.endsWith('recipes')) {
    return 'ingredients';
  }
  return null;
}

/** Auto-map CSV headers to product fields using aliases (WordPress-style guess). */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping = emptyColumnMapping();
  const usedHeaders = new Set<string>();
  for (const header of headers) {
    const alias = guessFieldFromHeader(header);
    if (!alias) continue;
    if (mapping[alias]) continue; // first match wins
    if (usedHeaders.has(header)) continue;
    mapping[alias] = header;
    usedHeaders.add(header);
  }
  return mapping;
}

export function parseCsvHeadersAndSample(
  csvText: string,
  sampleRows = 5
): { headers: string[]; dataRows: string[][]; totalDataRows: number } {
  const matrix = parseCsv(csvText);
  if (matrix.length === 0) {
    return { headers: [], dataRows: [], totalDataRows: 0 };
  }
  const headers = matrix[0]!.map((h) => h.trim());
  const dataRows = matrix.slice(1);
  return {
    headers,
    dataRows: dataRows.slice(0, sampleRows),
    totalDataRows: dataRows.length,
  };
}

function toNumber(value: string, fallback = 0): number {
  if (!value.trim()) return fallback;
  const n = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function splitSemi(value: string): string[] {
  return value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeUniqueNames(a: string[], b: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...a, ...b]) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Categories may be one cell (`A; B`) or one-per-row with the same product name. */
function splitCategoryNames(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  let parts: string[];
  if (trimmed.includes(';')) {
    parts = splitSemi(trimmed);
  } else if (trimmed.includes('|')) {
    parts = trimmed.split('|').map((s) => s.trim()).filter(Boolean);
  } else if (trimmed.includes(',')) {
    parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    parts = [trimmed];
  }
  return mergeUniqueNames(parts);
}

function mergeIngredients(
  a: CsvImportIngredient[],
  b: CsvImportIngredient[]
): CsvImportIngredient[] {
  const seen = new Set<string>();
  const out: CsvImportIngredient[] = [];
  for (const row of [...a, ...b]) {
    const key = `${(row.variationLabel ?? '').trim().toLowerCase()}::${row.ingredientName.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function mergeVariations(
  a: CsvImportVariation[],
  b: CsvImportVariation[]
): CsvImportVariation[] {
  const seen = new Set<string>();
  const out: CsvImportVariation[] = [];
  for (const row of [...a, ...b]) {
    const key = (row.title || row.name).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...row, sortOrder: out.length });
  }
  return out;
}

function mergeCsvProducts(
  base: CsvImportProduct,
  extra: CsvImportProduct
): CsvImportProduct {
  return {
    ...base,
    description: base.description || extra.description,
    price: base.price || extra.price,
    salePrice: base.salePrice ?? extra.salePrice,
    categoryNames: mergeUniqueNames(base.categoryNames, extra.categoryNames),
    variations: mergeVariations(base.variations, extra.variations),
    recommendations:
      base.recommendations.length > 0
        ? base.recommendations
        : extra.recommendations,
    offerProductNames: mergeUniqueNames(
      base.offerProductNames,
      extra.offerProductNames
    ),
    personalizeGroups:
      base.personalizeGroups.length > 0
        ? base.personalizeGroups
        : extra.personalizeGroups,
    ingredients: mergeIngredients(base.ingredients, extra.ingredients),
  };
}

function parseVariationsField(raw: string): CsvImportVariation[] {
  if (!raw.trim()) return [];
  return splitSemi(raw).map((segment, index) => {
    let rest = segment.trim();
    let swatchHex: string | null = null;
    const hexMatch = rest.match(/\s+(#[0-9a-fA-F]{3,8})\s*$/);
    if (hexMatch) {
      swatchHex = hexMatch[1]!;
      rest = rest.slice(0, hexMatch.index).trim();
    }
    let priceDelta = 0;
    const deltaMatch = rest.match(/\s+([+-]?\d+(?:\.\d+)?)\s*$/);
    if (deltaMatch) {
      priceDelta = Number(deltaMatch[1]);
      rest = rest.slice(0, deltaMatch.index).trim();
    }
    let catalogName: string | null = null;
    const catalogMatch = rest.match(/\s+\[([^\]]+)\]\s*$/);
    if (catalogMatch) {
      catalogName = catalogMatch[1]!.trim();
      rest = rest.slice(0, catalogMatch.index).trim();
    }
    const title = rest || `Variation ${index + 1}`;
    return {
      name: title,
      title,
      priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
      sortOrder: index,
      swatchHex,
      catalogName,
    };
  });
}

function parseRecommendationsField(raw: string): CsvImportRecommendation[] {
  if (!raw.trim()) return [];
  return raw
    .split('||')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment, index) => {
      const parts = segment.split('|').map((p) => p.trim()).filter(Boolean);
      let name = parts[0] || `Recommendation ${index + 1}`;
      let selectionType: 'SINGLE' | 'MULTIPLE' = 'SINGLE';
      let required = false;
      let sourceType: 'CATEGORY' | 'PRODUCT' = 'CATEGORY';
      let multipleMode: 'QUANTITY' | 'CHECKBOX' | 'BOOLEAN' | null = null;
      let freeQuantity: number | null = null;
      let minItems: number | null = null;
      let maxItems: number | null = null;
      let linkedCategoryName: string | null = null;
      let linkedProductName: string | null = null;
      let defaultLinkedMenuItemName: string | null = null;
      let defaultLinkedRestaurantVariationName: string | null = null;
      let includeDefaultLinkedVariationPrice = true;
      let useVariationPricing = false;

      for (const part of parts.slice(1)) {
        const upper = part.toUpperCase();
        if (upper === 'SINGLE' || upper === 'MULTIPLE') {
          selectionType = upper;
          continue;
        }
        if (upper === 'REQUIRED') {
          required = true;
          continue;
        }
        if (upper === 'OPTIONAL') {
          required = false;
          continue;
        }
        if (upper === 'CATEGORY' || upper === 'PRODUCT') {
          sourceType = upper;
          continue;
        }
        if (upper === 'QUANTITY' || upper === 'BOOLEAN' || upper === 'CHECKBOX') {
          multipleMode = upper === 'QUANTITY' ? 'QUANTITY' : 'CHECKBOX';
          continue;
        }
        if (upper === 'VARIATIONPRICING') {
          useVariationPricing = true;
          continue;
        }
        if (upper === 'INCLUDEDEFAULTVARPRICE') {
          includeDefaultLinkedVariationPrice = true;
          continue;
        }
        const lower = part.toLowerCase();
        if (lower.startsWith('category:')) {
          linkedCategoryName = part.slice('category:'.length).trim() || null;
          sourceType = 'CATEGORY';
          continue;
        }
        if (lower.startsWith('product:')) {
          linkedProductName = part.slice('product:'.length).trim() || null;
          sourceType = 'PRODUCT';
          continue;
        }
        if (lower.startsWith('default:')) {
          defaultLinkedMenuItemName = part.slice('default:'.length).trim() || null;
          continue;
        }
        if (lower.startsWith('defaultvar:')) {
          defaultLinkedRestaurantVariationName =
            part.slice('defaultvar:'.length).trim() || null;
          continue;
        }
        if (lower.startsWith('free:')) {
          freeQuantity = toNullableNumber(part.slice('free:'.length));
          continue;
        }
        if (lower.startsWith('limits:')) {
          const range = part.slice('limits:'.length).trim();
          const [a, b] = range.split('-');
          minItems = toNullableNumber(a ?? '');
          maxItems = toNullableNumber(b ?? '');
          continue;
        }
        if (parts.indexOf(part) === 0) name = part;
      }

      if (selectionType === 'MULTIPLE' && !multipleMode) {
        multipleMode = 'QUANTITY';
      }

      return {
        name,
        sortOrder: index,
        selectionType,
        required,
        sourceType,
        multipleMode,
        freeQuantity,
        minItems,
        maxItems,
        linkedCategoryName,
        linkedProductName,
        defaultLinkedMenuItemName,
        defaultLinkedRestaurantVariationName,
        includeDefaultLinkedVariationPrice,
        useVariationPricing,
      };
    });
}

function parsePersonalizeField(raw: string): CsvImportPersonalizeGroup[] {
  if (!raw.trim()) return [];
  return raw
    .split('||')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment, index) => {
      const m = segment.match(/^(.+?)\s*\(max\s+(\d+)\)\s*:\s*(.*)$/i);
      if (m) {
        const parentName = m[1]!.trim();
        const maxItems = Math.max(1, parseInt(m[2]!, 10) || 2);
        const options = m[3]!
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        return { parentName, maxItems, sortOrder: index, options };
      }
      return {
        parentName: segment,
        maxItems: 2,
        sortOrder: index,
        options: [],
      };
    });
}

function parseIngredientQtyPairs(raw: string): Array<{ name: string; quantity: number }> {
  return splitSemi(raw)
    .map((segment) => {
      const m = segment
        .trim()
        .match(/^(.*?)(?:\s*[:=x×]\s*)([0-9]+(?:\.[0-9]+)?)\s*$/i);
      if (!m) return null;
      const name = m[1]!.trim();
      const quantity = Number(m[2]);
      if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;
      return { name, quantity };
    })
    .filter((row): row is { name: string; quantity: number } => Boolean(row));
}

export function formatIngredientsPreview(rows: CsvImportIngredient[]): string {
  if (rows.length === 0) return '';
  return rows
    .map((i) =>
      i.variationLabel
        ? `${i.variationLabel}: ${i.ingredientName}×${i.quantity}`
        : `${i.ingredientName}×${i.quantity}`
    )
    .join('; ');
}

function stripVariationCatalog(label: string): { label: string; catalog: string | null } {
  const m = label.match(/^(.*)\s+\[([^\]]+)\]\s*$/);
  if (m) {
    return { label: m[1]!.trim(), catalog: m[2]!.trim() || null };
  }
  return { label: label.trim(), catalog: null };
}

function parseIngredientsField(raw: string): CsvImportIngredient[] {
  if (!raw.trim()) return [];
  const out: CsvImportIngredient[] = [];
  for (const group of raw
    .split('||')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const pipe = group.indexOf('|');
    let variationLabel: string | null = null;
    let rest = group;
    if (pipe >= 0) {
      const left = group.slice(0, pipe).trim();
      const looksLikeQtyPair = /:\s*[0-9]+(?:\.[0-9]+)?\s*$/.test(left);
      if (left && !looksLikeQtyPair) {
        const stripped = stripVariationCatalog(left);
        variationLabel = stripped.label || stripped.catalog || left;
        rest = group.slice(pipe + 1).trim();
      }
    }
    for (const pair of parseIngredientQtyPairs(rest)) {
      out.push({
        ingredientName: pair.name,
        quantity: pair.quantity,
        variationLabel,
      });
    }
  }
  return out;
}

function resolveColIndex(
  headers: string[],
  mappedHeader: string
): number | null {
  if (!mappedHeader) return null;
  const colRef = mappedHeader.match(/^__col_(\d+)$/);
  if (colRef) {
    const idx = Number(colRef[1]);
    return Number.isFinite(idx) && idx >= 0 && idx < headers.length
      ? idx
      : null;
  }
  const exact = headers.findIndex((h) => h === mappedHeader);
  if (exact >= 0) return exact;
  const norm = normalizeHeader(mappedHeader);
  const loose = headers.findIndex((h) => normalizeHeader(h) === norm);
  return loose >= 0 ? loose : null;
}

export type ParseProductsCsvOptions = {
  /** field key → CSV header name */
  columnMapping?: ColumnMapping;
};

/**
 * Parse products from CSV text.
 * If columnMapping is omitted, headers are auto-mapped with aliases.
 */
export function parseProductsCsvImport(
  csvText: string,
  options?: ParseProductsCsvOptions
): ParsedProductsCsvImport {
  const errors: string[] = [];
  const matrix = parseCsv(csvText);
  if (matrix.length === 0) {
    return { products: [], errors: ['CSV file is empty'] };
  }

  const headers = matrix[0]!.map((h) => h.trim());
  const mapping =
    options?.columnMapping ?? guessColumnMapping(headers);

  const colIndex: Partial<Record<ProductImportFieldKey, number>> = {};
  for (const field of PRODUCT_IMPORT_FIELDS) {
    const header = mapping[field.key];
    const idx = resolveColIndex(headers, header);
    if (idx != null) colIndex[field.key] = idx;
  }

  if (colIndex.name == null) {
    return {
      products: [],
      errors: [
        'Product name must be mapped to a file column before import.',
      ],
    };
  }

  const products: CsvImportProduct[] = [];
  const indexByName = new Map<string, number>();

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r]!;
    const get = (key: ProductImportFieldKey) => {
      const i = colIndex[key];
      if (i == null) return '';
      return (line[i] ?? '').trim();
    };

    const name = get('name');
    if (!name) {
      errors.push(`Row ${r + 1}: missing product name (skipped)`);
      continue;
    }

    const priceRaw = get('price');
    const price = toNumber(priceRaw, 0);
    if (priceRaw && !Number.isFinite(Number(priceRaw.replace(/,/g, '')))) {
      errors.push(`Row ${r + 1}: invalid price for "${name}" (using 0)`);
    }

    const categoryNames = splitCategoryNames(get('categories'));
    if (categoryNames.length === 0 && colIndex.categories != null) {
      errors.push(
        `Row ${r + 1}: product "${name}" has empty categories — will use Uncategorized`
      );
    }

    const next: CsvImportProduct = {
      name,
      description: get('description') || null,
      price,
      salePrice: toNullableNumber(get('salePrice')),
      categoryNames,
      variations: parseVariationsField(get('variations')),
      recommendations: parseRecommendationsField(get('recommendations')),
      offerProductNames: splitSemi(get('offers')),
      personalizeGroups: parsePersonalizeField(get('personalize')),
      ingredients: parseIngredientsField(get('ingredients')),
    };

    const key = name.toLowerCase();
    const existingIndex = indexByName.get(key);
    if (existingIndex != null) {
      products[existingIndex] = mergeCsvProducts(
        products[existingIndex]!,
        next
      );
      continue;
    }
    indexByName.set(key, products.length);
    products.push(next);
  }

  return { products, errors };
}
