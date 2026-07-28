import ExcelJS from 'exceljs';
import {
  AttributeSelectionType,
  RecommendationMultipleMode,
  RecommendationSourceType,
} from '@prisma/client';

type RawRow = Record<string, string>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMBEDDED_BASE64_MARKER = '[embedded base64,';

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value.trim()));
}

function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value && 'text' in (value as Record<string, unknown>)) {
    return String((value as { text?: string }).text ?? '').trim();
  }
  return String(value).trim();
}

function toNumber(value: string, fallback = 0): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBool(value: string, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

function normalizeImageValue(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.toLowerCase() === 'null') return null;
  if (v.startsWith(EMBEDDED_BASE64_MARKER)) return null;
  return v;
}

function readSheetRows(workbook: ExcelJS.Workbook, name: string): RawRow[] {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, index) => {
    headers[index - 1] = toText(cell.value);
  });
  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const out: RawRow = {};
    let hasAnyValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const value = toText(row.getCell(idx + 1).value);
      if (value) hasAnyValue = true;
      out[header] = value;
    });
    if (hasAnyValue) rows.push(out);
  });
  return rows;
}

export type ParsedProductsImport = {
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    salePrice: number | null;
    primaryCategoryId: string | null;
    primaryCategoryName: string | null;
    imageKey: string | null;
    imageUrl: string | null;
  }>;
  categoryLinks: Array<{
    productId: string;
    categoryId: string | null;
    categoryName: string | null;
    sortOrder: number;
  }>;
  variations: Array<{
    id: string;
    productId: string;
    name: string;
    title: string;
    priceDelta: number;
    sortOrder: number;
    swatchHex: string | null;
    restaurantVariationId: string | null;
    imageKey: string | null;
    imageUrl: string | null;
  }>;
  recommendations: Array<{
    id: string;
    productId: string;
    groupName: string;
    sortOrder: number;
    selectionType: AttributeSelectionType;
    required: boolean;
    sourceType: RecommendationSourceType;
    multipleMode: RecommendationMultipleMode | null;
    freeQuantity: number | null;
    minItems: number | null;
    maxItems: number | null;
    linkedCategoryId: string | null;
    linkedCategoryName: string | null;
    linkedProductId: string | null;
    defaultLinkedMenuItemId: string | null;
    defaultLinkedRestaurantVariationId: string | null;
    includeDefaultLinkedVariationPrice: boolean;
    productCategoryIds: string[];
    useVariationPricing: boolean;
  }>;
  recommendationLimits: Array<{
    id: string;
    groupId: string;
    variationId: string;
    minItems: number;
    maxItems: number;
  }>;
  offers: Array<{
    id: string;
    baseProductId: string;
    offeredProductId: string;
    sortOrder: number;
  }>;
  personalizeGroups: Array<{
    id: string;
    productId: string;
    parentName: string;
    maxItems: number;
    sortOrder: number;
  }>;
  personalizeOptions: Array<{
    id: string;
    groupId: string;
    name: string;
    sortOrder: number;
    imageUrl: string | null;
  }>;
  photos: Array<{
    sourceType: string;
    productId: string;
    entityId: string;
    imageKey: string | null;
    imageUrl: string | null;
  }>;
  errors: string[];
};

export async function parseProductsExcelImport(
  fileBuffer: Buffer
): Promise<ParsedProductsImport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const productsRows = readSheetRows(workbook, 'Products');
  const categoryRows = readSheetRows(workbook, 'Category links');
  const variationRows = readSheetRows(workbook, 'Variations');
  const recommendationRows = readSheetRows(workbook, 'Recommendations');
  const recommendationLimitRows = readSheetRows(workbook, 'Recommendation limits');
  const offerRows = readSheetRows(workbook, 'Offers');
  const personalizeGroupRows = readSheetRows(workbook, 'Personalize groups');
  const personalizeOptionRows = readSheetRows(workbook, 'Personalize options');
  const photoRows = readSheetRows(workbook, 'Photos');

  const errors: string[] = [];

  const products = productsRows
    .map((row, idx) => {
      const id = row.id?.trim() ?? '';
      const name = row.name?.trim() ?? '';
      const primaryCategoryIdRaw = row.primaryCategoryId?.trim() ?? '';
      const primaryCategoryName = row.primaryCategoryName?.trim() ?? '';
      if (!isUuid(id)) {
        errors.push(`Products row ${idx + 2}: invalid id`);
        return null;
      }
      if (!name) {
        errors.push(`Products row ${idx + 2}: name is required`);
        return null;
      }
      if (!isUuid(primaryCategoryIdRaw) && !primaryCategoryName) {
        errors.push(
          `Products row ${idx + 2}: primaryCategoryId or primaryCategoryName is required`
        );
        return null;
      }
      return {
        id,
        name,
        description: row.description?.trim() || null,
        price: toNumber(row.price ?? '', 0),
        salePrice: toNullableNumber(row.salePrice ?? ''),
        primaryCategoryId: isUuid(primaryCategoryIdRaw)
          ? primaryCategoryIdRaw
          : null,
        primaryCategoryName: primaryCategoryName || null,
        imageKey: row.imageKey?.trim() || null,
        imageUrl: normalizeImageValue(row.imageUrl ?? ''),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const categoryLinks = categoryRows
    .map((row) => ({
      productId: row.productId?.trim() ?? '',
      categoryId: isUuid(row.categoryId?.trim()) ? row.categoryId.trim() : null,
      categoryName: row.categoryName?.trim() || null,
      sortOrder: toNumber(row.sortOrder ?? '', 0),
    }))
    .filter(
      (row) => isUuid(row.productId) && (Boolean(row.categoryId) || Boolean(row.categoryName))
    );

  const variations = variationRows
    .map((row, idx) => {
      const id = row.id?.trim() ?? '';
      const productId = row.productId?.trim() ?? '';
      const name = row.name?.trim() ?? '';
      if (!isUuid(id) || !isUuid(productId) || !name) {
        errors.push(`Variations row ${idx + 2}: invalid id/productId/name`);
        return null;
      }
      return {
        id,
        productId,
        name,
        title: row.title?.trim() || name,
        priceDelta: toNumber(row.priceDelta ?? '', 0),
        sortOrder: toNumber(row.sortOrder ?? '', 0),
        swatchHex: row.swatchHex?.trim() || null,
        restaurantVariationId: isUuid(row.restaurantVariationId)
          ? row.restaurantVariationId.trim()
          : null,
        imageKey: row.imageKey?.trim() || null,
        imageUrl: normalizeImageValue(row.imageUrl ?? ''),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const recommendations = recommendationRows
    .map((row, idx) => {
      const id = row.id?.trim() ?? '';
      const productId = row.productId?.trim() ?? '';
      const groupName = row.groupName?.trim() ?? '';
      if (!isUuid(id) || !isUuid(productId) || !groupName) {
        errors.push(`Recommendations row ${idx + 2}: invalid id/productId/groupName`);
        return null;
      }
      const selectionType =
        row.selectionType === AttributeSelectionType.MULTIPLE
          ? AttributeSelectionType.MULTIPLE
          : AttributeSelectionType.SINGLE;
      const sourceType =
        row.sourceType === RecommendationSourceType.PRODUCT
          ? RecommendationSourceType.PRODUCT
          : RecommendationSourceType.CATEGORY;
      const multipleMode =
        row.multipleMode === RecommendationMultipleMode.QUANTITY
          ? RecommendationMultipleMode.QUANTITY
          : row.multipleMode === RecommendationMultipleMode.CHECKBOX
            ? RecommendationMultipleMode.CHECKBOX
            : null;
      return {
        id,
        productId,
        groupName,
        sortOrder: toNumber(row.sortOrder ?? '', 0),
        selectionType,
        required: toBool(row.required ?? '', false),
        sourceType,
        multipleMode,
        freeQuantity: toNullableNumber(row.freeQuantity ?? ''),
        minItems: toNullableNumber(row.minItems ?? ''),
        maxItems: toNullableNumber(row.maxItems ?? ''),
        linkedCategoryId: isUuid(row.linkedCategoryId)
          ? row.linkedCategoryId.trim()
          : null,
        linkedCategoryName: row.linkedCategoryName?.trim() || null,
        linkedProductId: isUuid(row.linkedProductId)
          ? row.linkedProductId.trim()
          : null,
        defaultLinkedMenuItemId: isUuid(row.defaultLinkedMenuItemId)
          ? row.defaultLinkedMenuItemId.trim()
          : null,
        defaultLinkedRestaurantVariationId: isUuid(
          row.defaultLinkedRestaurantVariationId
        )
          ? row.defaultLinkedRestaurantVariationId.trim()
          : null,
        includeDefaultLinkedVariationPrice: toBool(
          row.includeDefaultLinkedVariationPrice ?? '',
          true
        ),
        productCategoryIds: (row.productCategoryIds ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter((v) => isUuid(v)),
        useVariationPricing: toBool(row.useVariationPricing ?? '', false),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const recommendationLimits = recommendationLimitRows
    .map((row, idx) => {
      const id = row.id?.trim() ?? '';
      const groupId = row.groupId?.trim() ?? '';
      const variationId = row.variationId?.trim() ?? '';
      if (!isUuid(id) || !isUuid(groupId) || !isUuid(variationId)) {
        errors.push(
          `Recommendation limits row ${idx + 2}: invalid id/groupId/variationId`
        );
        return null;
      }
      return {
        id,
        groupId,
        variationId,
        minItems: Math.max(0, Math.floor(toNumber(row.minItems ?? '', 0))),
        maxItems: Math.max(0, Math.floor(toNumber(row.maxItems ?? '', 0))),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const offers = offerRows
    .map((row, idx) => {
      const id = row.id?.trim() ?? '';
      const baseProductId = row.baseProductId?.trim() ?? '';
      const offeredProductId = row.offeredProductId?.trim() ?? '';
      if (!isUuid(id) || !isUuid(baseProductId) || !isUuid(offeredProductId)) {
        errors.push(`Offers row ${idx + 2}: invalid id/baseProductId/offeredProductId`);
        return null;
      }
      return {
        id,
        baseProductId,
        offeredProductId,
        sortOrder: toNumber(row.sortOrder ?? '', 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const personalizeGroups = personalizeGroupRows
    .map((row, idx) => {
      const id = row.id?.trim() ?? '';
      const productId = row.productId?.trim() ?? '';
      const parentName = row.parentName?.trim() ?? '';
      if (!isUuid(id) || !isUuid(productId) || !parentName) {
        errors.push(`Personalize groups row ${idx + 2}: invalid id/productId/parentName`);
        return null;
      }
      return {
        id,
        productId,
        parentName,
        maxItems: Math.max(0, Math.floor(toNumber(row.maxItems ?? '', 0))),
        sortOrder: toNumber(row.sortOrder ?? '', 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const personalizeOptions = personalizeOptionRows
    .map((row, idx) => {
      const id = row.id?.trim() ?? '';
      const groupId = row.groupId?.trim() ?? '';
      const name = row.name?.trim() ?? '';
      if (!isUuid(id) || !isUuid(groupId) || !name) {
        errors.push(`Personalize options row ${idx + 2}: invalid id/groupId/name`);
        return null;
      }
      return {
        id,
        groupId,
        name,
        sortOrder: toNumber(row.sortOrder ?? '', 0),
        imageUrl: normalizeImageValue(row.imageUrl ?? ''),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const photos = photoRows
    .map((row) => ({
      sourceType: row.sourceType?.trim().toLowerCase() ?? '',
      productId: row.productId?.trim() ?? '',
      entityId: row.entityId?.trim() || row.productId?.trim() || '',
      imageKey: row.imageKey?.trim() || null,
      imageUrl: normalizeImageValue(row.imageUrl ?? ''),
    }))
    .filter((row) => row.sourceType && isUuid(row.productId) && isUuid(row.entityId));

  return {
    products,
    categoryLinks,
    variations,
    recommendations,
    recommendationLimits,
    offers,
    personalizeGroups,
    personalizeOptions,
    photos,
    errors,
  };
}
