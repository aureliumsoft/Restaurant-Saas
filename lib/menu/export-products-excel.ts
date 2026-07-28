import ExcelJS from 'exceljs';

/** Truncate huge base64 data URLs so Excel stays usable. */
export function exportImageValue(
  imageUrl: string | null | undefined,
  imageKey?: string | null
): { imageUrl: string; imageKey: string; hasImage: string } {
  const key = imageKey?.trim() || '';
  const url = imageUrl?.trim() || '';
  if (!url && !key) {
    return { imageUrl: '', imageKey: '', hasImage: 'no' };
  }
  if (url.startsWith('data:')) {
    return {
      imageUrl: `[embedded base64, ${url.length} chars]`,
      imageKey: key,
      hasImage: 'yes',
    };
  }
  return {
    imageUrl: url,
    imageKey: key,
    hasImage: url || key ? 'yes' : 'no',
  };
}

function sheetFromRows(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row.map((cell) => (cell == null ? '' : cell)));
  }
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = Math.min(len, 60);
    });
    col.width = max + 2;
  });
  return sheet;
}

export type ProductExportItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageKey: string | null;
  price: number;
  salePrice: number | null;
  categoryId: string;
  restaurantId: string;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string };
  categoryLinks: Array<{
    categoryId: string;
    sortOrder: number;
    createdAt: Date;
    category: { id: string; name: string };
  }>;
  variations: Array<{
    id: string;
    menuItemId: string;
    name: string;
    title: string;
    imageUrl: string | null;
    imageKey: string | null;
    swatchHex: string | null;
    sortOrder: number;
    priceDelta: number;
    restaurantVariationId: string | null;
    createdAt: Date;
    updatedAt: Date;
    restaurantVariation: {
      id: string;
      name: string;
      shortLabel: string | null;
    } | null;
  }>;
  attributeGroups: Array<{
    id: string;
    menuItemId: string;
    name: string;
    sortOrder: number;
    selectionType: string;
    required: boolean;
    sourceType: string;
    multipleMode: string | null;
    freeQuantity: number | null;
    minItems: number | null;
    maxItems: number | null;
    linkedCategoryId: string | null;
    linkedProductId: string | null;
    defaultLinkedMenuItemId: string | null;
    defaultLinkedRestaurantVariationId: string | null;
    includeDefaultLinkedVariationPrice: boolean;
    productCategoryIds: string[];
    useVariationPricing: boolean;
    createdAt: Date;
    updatedAt: Date;
    linkedCategory: { id: string; name: string } | null;
    linkedProduct: { id: string; name: string } | null;
    defaultLinkedMenuItem: { id: string; name: string } | null;
    defaultLinkedRestaurantVariation: {
      id: string;
      name: string;
      shortLabel: string | null;
    } | null;
    variationLimits: Array<{
      id: string;
      groupId: string;
      variationId: string;
      minItems: number;
      maxItems: number;
      createdAt: Date;
      updatedAt: Date;
      variation: { id: string; name: string; title: string };
    }>;
  }>;
  offersFromThis: Array<{
    id: string;
    baseItemId: string;
    offeredItemId: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    offeredItem: { id: string; name: string };
  }>;
  personalizeGroups: Array<{
    id: string;
    menuItemId: string;
    parentName: string;
    maxItems: number;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    options: Array<{
      id: string;
      groupId: string;
      name: string;
      imageUrl: string | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
};

export async function buildProductsExcelBuffer(
  products: ProductExportItem[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Foodluk';
  workbook.created = new Date();

  const productRows = products.map((p) => {
    const img = exportImageValue(p.imageUrl, p.imageKey);
    const allCategories = [
      p.category.name,
      ...p.categoryLinks
        .map((l) => l.category.name)
        .filter((n) => n !== p.category.name),
    ];
    return [
      p.id,
      p.name,
      p.description ?? '',
      p.price,
      p.salePrice ?? '',
      p.categoryId,
      p.category.name,
      p.categoryLinks.map((l) => l.categoryId).join(', '),
      allCategories.join(', '),
      img.hasImage,
      img.imageKey,
      img.imageUrl,
      p.restaurantId,
      p.createdAt.toISOString(),
      p.updatedAt.toISOString(),
    ];
  });

  sheetFromRows(
    workbook,
    'Products',
    [
      'id',
      'name',
      'description',
      'price',
      'salePrice',
      'primaryCategoryId',
      'primaryCategoryName',
      'allCategoryIds',
      'allCategoryNames',
      'hasPhoto',
      'imageKey',
      'imageUrl',
      'restaurantId',
      'createdAt',
      'updatedAt',
    ],
    productRows
  );

  const categoryLinkRows: Array<Array<string | number>> = [];
  for (const p of products) {
    for (const link of p.categoryLinks) {
      categoryLinkRows.push([
        p.id,
        p.name,
        link.categoryId,
        link.category.name,
        link.sortOrder,
        link.createdAt.toISOString(),
      ]);
    }
  }
  sheetFromRows(
    workbook,
    'Category links',
    [
      'productId',
      'productName',
      'categoryId',
      'categoryName',
      'sortOrder',
      'createdAt',
    ],
    categoryLinkRows
  );

  const variationRows: Array<Array<string | number>> = [];
  for (const p of products) {
    for (const v of p.variations) {
      const img = exportImageValue(v.imageUrl, v.imageKey);
      variationRows.push([
        v.id,
        v.menuItemId,
        p.name,
        v.name,
        v.title,
        v.priceDelta,
        v.sortOrder,
        v.swatchHex ?? '',
        v.restaurantVariationId ?? '',
        v.restaurantVariation?.name ?? '',
        v.restaurantVariation?.shortLabel ?? '',
        img.hasImage,
        img.imageKey,
        img.imageUrl,
        v.createdAt.toISOString(),
        v.updatedAt.toISOString(),
      ]);
    }
  }
  sheetFromRows(
    workbook,
    'Variations',
    [
      'id',
      'productId',
      'productName',
      'name',
      'title',
      'priceDelta',
      'sortOrder',
      'swatchHex',
      'restaurantVariationId',
      'restaurantVariationName',
      'restaurantVariationShortLabel',
      'hasPhoto',
      'imageKey',
      'imageUrl',
      'createdAt',
      'updatedAt',
    ],
    variationRows
  );

  const recRows: Array<Array<string | number | boolean>> = [];
  const limitRows: Array<Array<string | number>> = [];
  for (const p of products) {
    for (const g of p.attributeGroups) {
      recRows.push([
        g.id,
        g.menuItemId,
        p.name,
        g.name,
        g.sortOrder,
        g.selectionType,
        g.required,
        g.sourceType,
        g.multipleMode ?? '',
        g.freeQuantity ?? '',
        g.minItems ?? '',
        g.maxItems ?? '',
        g.linkedCategoryId ?? '',
        g.linkedCategory?.name ?? '',
        g.linkedProductId ?? '',
        g.linkedProduct?.name ?? '',
        g.defaultLinkedMenuItemId ?? '',
        g.defaultLinkedMenuItem?.name ?? '',
        g.defaultLinkedRestaurantVariationId ?? '',
        g.defaultLinkedRestaurantVariation?.name ?? '',
        g.defaultLinkedRestaurantVariation?.shortLabel ?? '',
        g.includeDefaultLinkedVariationPrice,
        g.productCategoryIds.join(', '),
        g.useVariationPricing,
        g.createdAt.toISOString(),
        g.updatedAt.toISOString(),
      ]);
      for (const lim of g.variationLimits) {
        limitRows.push([
          lim.id,
          lim.groupId,
          g.name,
          p.id,
          p.name,
          lim.variationId,
          lim.variation.name,
          lim.variation.title,
          lim.minItems,
          lim.maxItems,
          lim.createdAt.toISOString(),
          lim.updatedAt.toISOString(),
        ]);
      }
    }
  }
  sheetFromRows(
    workbook,
    'Recommendations',
    [
      'id',
      'productId',
      'productName',
      'groupName',
      'sortOrder',
      'selectionType',
      'required',
      'sourceType',
      'multipleMode',
      'freeQuantity',
      'minItems',
      'maxItems',
      'linkedCategoryId',
      'linkedCategoryName',
      'linkedProductId',
      'linkedProductName',
      'defaultLinkedMenuItemId',
      'defaultLinkedMenuItemName',
      'defaultLinkedRestaurantVariationId',
      'defaultLinkedRestaurantVariationName',
      'defaultLinkedRestaurantVariationShortLabel',
      'includeDefaultLinkedVariationPrice',
      'productCategoryIds',
      'useVariationPricing',
      'createdAt',
      'updatedAt',
    ],
    recRows
  );
  sheetFromRows(
    workbook,
    'Recommendation limits',
    [
      'id',
      'groupId',
      'groupName',
      'productId',
      'productName',
      'variationId',
      'variationName',
      'variationTitle',
      'minItems',
      'maxItems',
      'createdAt',
      'updatedAt',
    ],
    limitRows
  );

  const offerRows: Array<Array<string | number>> = [];
  for (const p of products) {
    for (const o of p.offersFromThis) {
      offerRows.push([
        o.id,
        o.baseItemId,
        p.name,
        o.offeredItemId,
        o.offeredItem.name,
        o.sortOrder,
        o.createdAt.toISOString(),
        o.updatedAt.toISOString(),
      ]);
    }
  }
  sheetFromRows(
    workbook,
    'Offers',
    [
      'id',
      'baseProductId',
      'baseProductName',
      'offeredProductId',
      'offeredProductName',
      'sortOrder',
      'createdAt',
      'updatedAt',
    ],
    offerRows
  );

  const personalizeGroupRows: Array<Array<string | number>> = [];
  const personalizeOptionRows: Array<Array<string | number>> = [];
  for (const p of products) {
    for (const g of p.personalizeGroups) {
      personalizeGroupRows.push([
        g.id,
        g.menuItemId,
        p.name,
        g.parentName,
        g.maxItems,
        g.sortOrder,
        g.createdAt.toISOString(),
        g.updatedAt.toISOString(),
      ]);
      for (const opt of g.options) {
        const img = exportImageValue(opt.imageUrl);
        personalizeOptionRows.push([
          opt.id,
          opt.groupId,
          g.parentName,
          p.id,
          p.name,
          opt.name,
          opt.sortOrder,
          img.hasImage,
          img.imageUrl,
          opt.createdAt.toISOString(),
          opt.updatedAt.toISOString(),
        ]);
      }
    }
  }
  sheetFromRows(
    workbook,
    'Personalize groups',
    [
      'id',
      'productId',
      'productName',
      'parentName',
      'maxItems',
      'sortOrder',
      'createdAt',
      'updatedAt',
    ],
    personalizeGroupRows
  );
  sheetFromRows(
    workbook,
    'Personalize options',
    [
      'id',
      'groupId',
      'groupName',
      'productId',
      'productName',
      'name',
      'sortOrder',
      'hasPhoto',
      'imageUrl',
      'createdAt',
      'updatedAt',
    ],
    personalizeOptionRows
  );

  const photoRows: Array<Array<string | number>> = [];
  for (const p of products) {
    const img = exportImageValue(p.imageUrl, p.imageKey);
    if (img.hasImage === 'yes') {
      photoRows.push([
        'product',
        p.id,
        p.name,
        '',
        '',
        img.imageKey,
        img.imageUrl,
        `/api/restaurant/menu/items/${p.id}/image`,
      ]);
    }
    for (const v of p.variations) {
      const vImg = exportImageValue(v.imageUrl, v.imageKey);
      if (vImg.hasImage === 'yes') {
        photoRows.push([
          'variation',
          p.id,
          p.name,
          v.id,
          v.title || v.name,
          vImg.imageKey,
          vImg.imageUrl,
          '',
        ]);
      }
    }
    for (const g of p.personalizeGroups) {
      for (const opt of g.options) {
        const oImg = exportImageValue(opt.imageUrl);
        if (oImg.hasImage === 'yes') {
          photoRows.push([
            'personalize_option',
            p.id,
            p.name,
            opt.id,
            opt.name,
            '',
            oImg.imageUrl,
            '',
          ]);
        }
      }
    }
  }
  sheetFromRows(
    workbook,
    'Photos',
    [
      'sourceType',
      'productId',
      'productName',
      'entityId',
      'entityName',
      'imageKey',
      'imageUrl',
      'lazyImageApiPath',
    ],
    photoRows
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
