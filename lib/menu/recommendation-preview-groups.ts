import {
  categoryUsesVariationLimits,
  DEFAULT_CATEGORY_MIN_MAX,
  nextRecommendationSortOrderBase,
  resolveCategoryFreeQuantity,
  resolveProductFreeQuantity,
} from '@/lib/menu/recommendation-category-limits';
import {
  configurationGroupHasItemsForParentVariation,
  filterConfigurationItemsForDefaultLinkedVariation,
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

/** Multiple-selection sections sort before single-selection (matches typical setup flow). */
export const RECOMMENDATION_FORM_VARIANTS: RecommendationFormVariant[] = [
  'category-multiple',
  'product-multiple',
  'category-single',
  'product-single',
];

export function recommendationDraftKey(
  variant: RecommendationFormVariant,
  entityId: string
): string {
  return `${variant}-${entityId}`;
}

/** Assign continuous sort orders across saved groups and all pending drafts. */
export function buildRecommendationSortPlan(
  savedGroups: AttrGroupRow[],
  drafts: Partial<Record<RecommendationFormVariant, RecommendationRuleDraft>>
): Map<string, number> {
  const plan = new Map<string, number>();
  let cursor = nextRecommendationSortOrderBase(savedGroups);

  for (const variant of RECOMMENDATION_FORM_VARIANTS) {
    const draft = drafts[variant];
    if (!draft || !draftHasContent(variant, draft)) continue;

    if (variant === 'category-single' || variant === 'category-multiple') {
      for (const catId of draft.ruleCategoryIds) {
        plan.set(recommendationDraftKey(variant, catId), cursor++);
      }
      continue;
    }

    if (variant === 'product-single' && draft.linkedProductId) {
      plan.set(
        recommendationDraftKey(variant, draft.linkedProductId),
        cursor++
      );
      continue;
    }

    if (variant === 'product-multiple') {
      for (const productId of draft.linkedProductIds) {
        plan.set(recommendationDraftKey(variant, productId), cursor++);
      }
    }
  }

  return plan;
}

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
  savedGroups: AttrGroupRow[] = []
): PreviewAttrGroup[] {
  const sortPlan = buildRecommendationSortPlan(savedGroups, drafts);
  const out: PreviewAttrGroup[] = [];

  const pushCategoryDrafts = (
    variant: 'category-single' | 'category-multiple',
    draft: RecommendationRuleDraft
  ) => {
    if (!draftHasContent(variant, draft)) return;
    for (const catId of draft.ruleCategoryIds) {
      const cat = localCategories.find((c) => c.id === catId);
      if (!cat) continue;
      const defaultItem = draft.categoryDefaults[catId]
        ? allProducts.find((i) => i.id === draft.categoryDefaults[catId]) ??
          cat.items.find((i) => i.id === draft.categoryDefaults[catId])
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
            ? resolveCategoryFreeQuantity(draft.categoryFreeQuantity, catId)
            : null,
        required: draft.required,
        minItems: useCatVariationLimits ? null : catMinMax.minItems,
        maxItems: useCatVariationLimits ? null : catMinMax.maxItems,
        sortOrder: sortPlan.get(recommendationDraftKey(variant, catId)) ?? 0,
        linkedCategory: { id: cat.id, name: cat.name },
        defaultLinkedMenuItemId: draft.categoryDefaults[catId] ?? null,
        defaultLinkedRestaurantVariationId:
          draft.categoryDefaultVariations[catId] ?? null,
        includeDefaultLinkedVariationPrice:
          draft.categoryDefaultVariations[catId] != null
            ? (draft.categoryIncludeDefaultVariationPrice[catId] ?? true)
            : true,
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
        categoryDiscountPercent: draft.categoryDiscountPercent[catId] ?? null,
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
    const catNames = localCategories
      .filter((c) => draft.productCategoryIds.includes(c.id))
      .map((c) => c.name);
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
          ? resolveProductFreeQuantity(draft.productFreeQuantity, productId)
          : null,
      required: draft.required,
      minItems: productMinMax.minItems,
      maxItems: productMinMax.maxItems,
      sortOrder:
        sortPlan.get(recommendationDraftKey(variant, productId)) ?? 0,
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

  for (const variant of RECOMMENDATION_FORM_VARIANTS) {
    const draft = drafts[variant];
    if (!draft) continue;
    if (variant === 'category-single' || variant === 'category-multiple') {
      pushCategoryDrafts(variant, draft);
      continue;
    }
    if (variant === 'product-single' && draft.linkedProductId) {
      pushProductDraft(variant, draft, draft.linkedProductId);
      continue;
    }
    if (variant === 'product-multiple') {
      for (const pid of draft.linkedProductIds) {
        pushProductDraft(variant, draft, pid);
      }
    }
  }

  return out;
}

/** Merge loaded products into category rows for configuration preview. */
export function buildPreviewCategoriesWithProducts(
  categories: MenuCategoryRow[],
  allProducts: Array<
    MenuItemRow & { categoryIds?: string[]; categoryName?: string }
  >
): MenuCategoryRow[] {
  const productsByCategory = new Map<string, MenuItemRow[]>();

  for (const product of allProducts) {
    const categoryIds =
      product.categoryIds && product.categoryIds.length > 0
        ? product.categoryIds
        : [product.categoryId];
    for (const categoryId of categoryIds) {
      const list = productsByCategory.get(categoryId) ?? [];
      if (!list.some((item) => item.id === product.id)) {
        list.push(product);
      }
      productsByCategory.set(categoryId, list);
    }
  }

  return categories.map((category) => {
    const loaded = productsByCategory.get(category.id);
    return loaded && loaded.length > 0
      ? { ...category, items: loaded }
      : category;
  });
}

export function linkedItemsForPreviewGroup(
  group: PreviewAttrGroup,
  baseProduct: MenuItemRow,
  categories: MenuCategoryRow[],
  allProducts: Array<
    MenuItemRow & { categoryIds?: string[]; categoryName?: string }
  > = []
): MenuItemRow[] {
  const categoriesWithProducts = buildPreviewCategoriesWithProducts(
    categories,
    allProducts
  );

  const enriched = enrichAttributeGroupSource(
    {
      sourceType: group.sourceType ?? 'CATEGORY',
      productCategoryIds: group.productCategoryIds,
      linkedCategory: group.linkedCategory
        ? {
            ...group.linkedCategory,
            items:
              categoriesWithProducts.find(
                (c) => c.id === group.linkedCategory?.id
              )?.items ?? [],
          }
        : null,
      linkedProduct: group.linkedProduct
        ? categoriesWithProducts
            .flatMap((c) => c.items)
            .find((i) => i.id === group.linkedProduct?.id) ??
          allProducts.find((p) => p.id === group.linkedProduct?.id) ?? {
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
    categoriesWithProducts.map((c) => ({
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
  const defaultLinkedRestaurantVariationId =
    group.defaultLinkedRestaurantVariationId ?? null;

  if (group.sourceType === 'PRODUCT') {
    const item = items[0];
    if (!item) return false;
    return isConfigurationItemAvailableForParentVariation(
      previewItemConfigLike(item),
      parentVariation,
      useVariationPricing
    );
  }

  if (defaultLinkedRestaurantVariationId && !useVariationPricing) {
    return (
      filterConfigurationItemsForDefaultLinkedVariation(
        items.map(previewItemConfigLike),
        defaultLinkedRestaurantVariationId
      ).length > 0
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
  const defaultLinkedRestaurantVariationId =
    group.defaultLinkedRestaurantVariationId ?? null;

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

  if (defaultLinkedRestaurantVariationId && !useVariationPricing) {
    return filterConfigurationItemsForDefaultLinkedVariation(
      items,
      defaultLinkedRestaurantVariationId
    ) as MenuItemRow[];
  }

  return filterConfigurationItemsForParentVariation(
    items,
    parentVariation,
    useVariationPricing
  ) as MenuItemRow[];
}
