import {
  categoryUsesVariationLimits,
  DEFAULT_CATEGORY_MIN_MAX,
  DEFAULT_FREE_QUANTITY,
} from '@/lib/menu/recommendation-category-limits';
import {
  configurationGroupHasItemsForParentVariation,
  filterConfigurationItemsForParentVariation,
  isConfigurationItemAvailableForParentVariation,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import { enrichAttributeGroupSource } from '@/lib/menu/product-recommendation-pool';
import { mapAttributeGroupItems } from '@/lib/menu/map-attribute-group-items';

import type { RecommendationRuleDraft } from '@/components/dashboard/menu-manager/recommendation-rule-form';
import type {
  AttrGroupRow,
  MenuCategoryRow,
  MenuItemRow,
} from '@/components/dashboard/menu-manager/types';

export type RecommendationFormVariant =
  | 'category-single'
  | 'category-multiple'
  | 'product-single'
  | 'product-multiple';

export const RECOMMENDATION_FORM_VARIANTS: RecommendationFormVariant[] = [
  'category-single',
  'category-multiple',
  'product-single',
  'product-multiple',
];

export const RECOMMENDATION_SECTION_LABELS: Record<
  RecommendationFormVariant,
  string
> = {
  'category-single': 'Category · single selection',
  'category-multiple': 'Category · multiple selection',
  'product-single': 'Product · single selection',
  'product-multiple': 'Product · multiple selection',
};

export type PreviewAttrGroup = AttrGroupRow & {
  isDraft?: boolean;
  draftKey?: string;
};

function categoryGroupName(
  catName: string,
  selectionType: 'SINGLE' | 'MULTIPLE'
): string {
  return selectionType === 'SINGLE'
    ? `Choose ${catName}`
    : `Choose from ${catName}`;
}

function productGroupName(
  product: MenuItemRow & { categoryName?: string },
  catNames: string[],
  selectionType: 'SINGLE' | 'MULTIPLE'
): string {
  if (catNames.length > 1) {
    return `Choose add-ons (${catNames.join(', ')})`;
  }
  const cat = catNames[0] ?? product.categoryName ?? 'products';
  return selectionType === 'SINGLE'
    ? `Choose ${product.name}`
    : `Choose from ${cat}`;
}

export function variantFromDraft(
  draft: RecommendationRuleDraft
): RecommendationFormVariant {
  if (draft.sourceType === 'CATEGORY') {
    return draft.selectionType === 'SINGLE'
      ? 'category-single'
      : 'category-multiple';
  }
  return draft.selectionType === 'SINGLE' ? 'product-single' : 'product-multiple';
}

export function draftHasContent(
  variant: RecommendationFormVariant,
  draft: RecommendationRuleDraft
): boolean {
  if (variant === 'category-single' || variant === 'category-multiple') {
    return draft.ruleCategoryIds.length > 0;
  }
  if (variant === 'product-single') {
    return Boolean(draft.linkedProductId);
  }
  return draft.linkedProductIds.length > 0;
}

/** Build virtual attribute groups from unsaved form drafts for live preview. */
export function buildDraftPreviewGroups(
  drafts: Partial<Record<RecommendationFormVariant, RecommendationRuleDraft>>,
  localCategories: MenuCategoryRow[],
  allProducts: (MenuItemRow & { categoryName: string })[],
  baseProduct: MenuItemRow,
  sortOrderBase = 0
): PreviewAttrGroup[] {
  const out: PreviewAttrGroup[] = [];
  let sortCursor = sortOrderBase;

  const pushCategoryDrafts = (
    variant: 'category-single' | 'category-multiple',
    draft: RecommendationRuleDraft
  ) => {
    if (!draftHasContent(variant, draft)) return;
    for (const catId of draft.ruleCategoryIds) {
      const cat = localCategories.find((c) => c.id === catId);
      if (!cat) continue;
      const defaultItem = draft.categoryDefaults[catId]
        ? cat.items.find((i) => i.id === draft.categoryDefaults[catId])
        : null;
      const catMinMax =
        draft.categoryMinMax[catId] ?? { ...DEFAULT_CATEGORY_MIN_MAX };
      const catVariationLimits = draft.categoryVariationLimits[catId];
      const useCatVariationLimits = categoryUsesVariationLimits(
        (baseProduct.variations?.length ?? 0),
        catVariationLimits
      );

      out.push({
        id: `draft-${variant}-${catId}`,
        draftKey: `${variant}-${catId}`,
        isDraft: true,
        name: categoryGroupName(cat.name, draft.selectionType),
        selectionType: draft.selectionType,
        sourceType: 'CATEGORY',
        multipleMode: draft.multipleMode,
        freeQuantity:
          draft.multipleMode === 'QUANTITY'
            ? (draft.categoryFreeQuantity[catId] ?? DEFAULT_FREE_QUANTITY)
            : null,
        required: draft.required,
        minItems: useCatVariationLimits ? null : catMinMax.minItems,
        maxItems: useCatVariationLimits ? null : catMinMax.maxItems,
        sortOrder: sortCursor++,
        linkedCategory: { id: cat.id, name: cat.name },
        defaultLinkedMenuItemId: draft.categoryDefaults[catId] ?? null,
        defaultLinkedMenuItem: defaultItem
          ? {
              id: defaultItem.id,
              name: defaultItem.name,
              price: defaultItem.price,
              salePrice: defaultItem.salePrice,
            }
          : null,
        variationLimits: useCatVariationLimits ? catVariationLimits : undefined,
        useVariationPricing: draft.categoryVariationPricing[catId] ?? false,
      });
    }
  };

  const pushProductDraft = (
    variant: RecommendationFormVariant,
    draft: RecommendationRuleDraft,
    productId: string
  ) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const catNames = draft.productCategoryIds
      .map((id) => localCategories.find((c) => c.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    const productMinMax =
      draft.productMinMax[productId] ?? { ...DEFAULT_CATEGORY_MIN_MAX };
    out.push({
      id: `draft-${variant}-${productId}`,
      draftKey: `${variant}-${productId}`,
      isDraft: true,
      name: productGroupName(product, catNames, draft.selectionType),
      selectionType: draft.selectionType,
      sourceType: 'PRODUCT',
      multipleMode: draft.multipleMode,
      freeQuantity:
        draft.multipleMode === 'QUANTITY'
          ? (draft.productFreeQuantity[productId] ?? DEFAULT_FREE_QUANTITY)
          : null,
      required: draft.required,
      minItems: productMinMax.minItems,
      maxItems: productMinMax.maxItems,
      sortOrder: sortCursor++,
      linkedProduct: {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price,
        salePrice: product.salePrice,
      },
      productCategoryIds: draft.productCategoryIds,
      useVariationPricing: false,
    });
  };

  const catSingle = drafts['category-single'];
  if (catSingle) pushCategoryDrafts('category-single', catSingle);

  const catMulti = drafts['category-multiple'];
  if (catMulti) pushCategoryDrafts('category-multiple', catMulti);

  const prodSingle = drafts['product-single'];
  if (prodSingle?.linkedProductId) {
    pushProductDraft('product-single', prodSingle, prodSingle.linkedProductId);
  }

  const prodMulti = drafts['product-multiple'];
  if (prodMulti) {
    for (const pid of prodMulti.linkedProductIds) {
      pushProductDraft('product-multiple', prodMulti, pid);
    }
  }

  return out;
}

export function linkedItemsForPreviewGroup(
  group: PreviewAttrGroup,
  baseProduct: MenuItemRow,
  categories: MenuCategoryRow[]
): MenuItemRow[] {
  const enriched = enrichAttributeGroupSource(
    {
      sourceType: group.sourceType ?? 'CATEGORY',
      productCategoryIds: group.productCategoryIds,
      linkedCategory: group.linkedCategory
        ? {
            ...group.linkedCategory,
            items:
              categories.find((c) => c.id === group.linkedCategory?.id)?.items ??
              [],
          }
        : null,
      linkedProduct: group.linkedProduct
        ? categories
            .flatMap((c) => c.items)
            .find((i) => i.id === group.linkedProduct?.id) ?? {
            id: group.linkedProduct.id,
            name: group.linkedProduct.name,
            description: null,
            imageUrl: group.linkedProduct.imageUrl,
            price: group.linkedProduct.price,
            salePrice: group.linkedProduct.salePrice,
            categoryId: baseProduct.categoryId,
            attributeGroups: [],
          }
        : null,
    },
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items,
    })),
    baseProduct.id
  );

  return mapAttributeGroupItems(enriched, baseProduct.id) as MenuItemRow[];
}

function previewItemConfigLike(item: MenuItemRow) {
  return {
    price: item.price,
    salePrice: item.salePrice,
    variations: item.variations,
  };
}

export function isPreviewGroupVisibleForParentVariation(
  group: PreviewAttrGroup,
  items: MenuItemRow[],
  parentVariation: ParentVariationContext | null | undefined
): boolean {
  const useVariationPricing = group.useVariationPricing ?? false;
  if (group.sourceType === 'PRODUCT') {
    const item = items[0];
    if (!item) return false;
    return isConfigurationItemAvailableForParentVariation(
      previewItemConfigLike(item),
      parentVariation,
      useVariationPricing
    );
  }
  return configurationGroupHasItemsForParentVariation(
    {
      items: items.map(previewItemConfigLike),
      useVariationPricing,
    },
    parentVariation
  );
}

export function visibleItemsForPreviewGroup(
  group: PreviewAttrGroup,
  items: MenuItemRow[],
  parentVariation: ParentVariationContext | null | undefined
): MenuItemRow[] {
  const useVariationPricing = group.useVariationPricing ?? false;
  if (group.sourceType === 'PRODUCT') {
    const item = items[0];
    if (!item) return [];
    return isConfigurationItemAvailableForParentVariation(
      previewItemConfigLike(item),
      parentVariation,
      useVariationPricing
    )
      ? items
      : [];
  }
  return filterConfigurationItemsForParentVariation(
    items,
    parentVariation,
    useVariationPricing
  ) as MenuItemRow[];
}
