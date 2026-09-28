import type {
  RecommendationRuleDraft,
  RecommendationProductOverrideDraft,
  VariationLimitDraft,
} from '@/components/dashboard/menu-manager/recommendation-rule-form';
import type { AttrGroupRow } from '@/components/dashboard/menu-manager/types';
import type { RecommendationFormVariant } from '@/lib/menu/recommendation-preview-groups';
import {
  DEFAULT_CATEGORY_MIN_MAX,
  DEFAULT_FREE_QUANTITY,
  defaultVariationLimitsForVariations,
  type CategoryMinMaxDraft,
} from '@/lib/menu/recommendation-category-limits';

export type WizardChoiceKind =
  | 'cat-many'
  | 'cat-one'
  | 'prod-many'
  | 'prod-one'
  | 'prefs';

export function isCategoryKind(kind: WizardChoiceKind) {
  return kind === 'cat-many' || kind === 'cat-one';
}

export function isProductKind(kind: WizardChoiceKind) {
  return kind === 'prod-many' || kind === 'prod-one';
}

export function isOneKind(kind: WizardChoiceKind) {
  return kind === 'cat-one' || kind === 'prod-one';
}

export function isManyKind(kind: WizardChoiceKind) {
  return kind === 'cat-many' || kind === 'prod-many';
}

export function wizardKindToVariant(
  kind: Exclude<WizardChoiceKind, 'prefs'>
): RecommendationFormVariant {
  switch (kind) {
    case 'cat-one':
      return 'category-single';
    case 'cat-many':
      return 'category-multiple';
    case 'prod-one':
      return 'product-single';
    case 'prod-many':
      return 'product-multiple';
  }
}

export function variantToWizardKind(
  variant: RecommendationFormVariant
): Exclude<WizardChoiceKind, 'prefs'> {
  switch (variant) {
    case 'category-single':
      return 'cat-one';
    case 'category-multiple':
      return 'cat-many';
    case 'product-single':
      return 'prod-one';
    case 'product-multiple':
      return 'prod-many';
  }
}

export function emptyRuleDraft(
  sourceType: 'CATEGORY' | 'PRODUCT',
  selectionType: 'SINGLE' | 'MULTIPLE'
): RecommendationRuleDraft {
  return {
    sourceType,
    selectionType,
    multipleMode: 'CHECKBOX',
    required: selectionType === 'SINGLE',
    ruleCategoryIds: [],
    categoryDefaults: {},
    categoryDefaultVariations: {},
    categoryIncludeDefaultVariationPrice: {},
    productCategoryIds: [],
    linkedProductId: '',
    linkedProductIds: [],
    categoryFreeQuantity: {},
    categoryMinMax: {},
    categoryVariationLimits: {},
    productFreeQuantity: {},
    productMinMax: {},
    categoryVariationPricing: {},
    categoryDiscountPercent: {},
    categoryExtraCostPercent: {},
    categoryProductOverrides: {},
  };
}

/** Map a saved attribute group into a classic/advanced editor draft (1:1). */
export function attrGroupToRuleDraft(group: AttrGroupRow): RecommendationRuleDraft {
  const sourceType = group.sourceType ?? 'CATEGORY';
  const selectionType = group.selectionType;
  const draft = emptyRuleDraft(sourceType, selectionType);
  draft.required = group.required;
  draft.multipleMode =
    group.multipleMode === 'QUANTITY' ? 'QUANTITY' : 'CHECKBOX';

  if (sourceType === 'CATEGORY' && group.linkedCategory?.id) {
    const catId = group.linkedCategory.id;
    draft.ruleCategoryIds = [catId];
    if (group.defaultLinkedMenuItemId) {
      draft.categoryDefaults[catId] = group.defaultLinkedMenuItemId;
    } else if (group.defaultLinkedMenuItem?.id) {
      draft.categoryDefaults[catId] = group.defaultLinkedMenuItem.id;
    }
    const variationId =
      group.defaultLinkedRestaurantVariationId ??
      group.defaultLinkedRestaurantVariation?.id ??
      null;
    if (variationId) {
      draft.categoryDefaultVariations[catId] = variationId;
      draft.categoryIncludeDefaultVariationPrice[catId] =
        group.includeDefaultLinkedVariationPrice ?? true;
    }
    if (group.useVariationPricing) {
      draft.categoryVariationPricing[catId] = true;
    }
    if (group.categoryDiscountPercent != null) {
      draft.categoryDiscountPercent[catId] = group.categoryDiscountPercent;
    }
    if (group.categoryExtraCostPercent != null) {
      draft.categoryExtraCostPercent[catId] = group.categoryExtraCostPercent;
    }
    if (group.productOverrides && Object.keys(group.productOverrides).length > 0) {
      draft.categoryProductOverrides[catId] = Object.fromEntries(
        Object.entries(group.productOverrides).map(([productId, override]) => [
          productId,
          {
            excluded: Boolean(override.excluded),
            free: Boolean(override.free),
          },
        ])
      );
    }
    if (selectionType === 'MULTIPLE') {
      if (draft.multipleMode === 'QUANTITY') {
        draft.categoryFreeQuantity[catId] =
          group.freeQuantity === undefined ? 0 : group.freeQuantity;
      }
      if (group.variationLimits && group.variationLimits.length > 0) {
        draft.categoryVariationLimits[catId] = group.variationLimits.map(
          (row) => ({
            variationId: row.variationId,
            minItems: row.minItems,
            maxItems: row.maxItems,
          })
        );
      } else {
        draft.categoryMinMax[catId] = {
          minItems: group.minItems ?? DEFAULT_CATEGORY_MIN_MAX.minItems,
          maxItems: group.maxItems ?? DEFAULT_CATEGORY_MIN_MAX.maxItems,
        };
      }
    }
  } else if (sourceType === 'PRODUCT' && group.linkedProduct?.id) {
    const productId = group.linkedProduct.id;
    draft.linkedProductId = productId;
    draft.linkedProductIds = [productId];
    draft.productCategoryIds = [...(group.productCategoryIds ?? [])];
    if (selectionType === 'MULTIPLE') {
      draft.productMinMax[productId] = {
        minItems: group.minItems ?? DEFAULT_CATEGORY_MIN_MAX.minItems,
        maxItems: group.maxItems ?? DEFAULT_CATEGORY_MIN_MAX.maxItems,
      };
      if (draft.multipleMode === 'QUANTITY') {
        draft.productFreeQuantity[productId] =
          group.freeQuantity === undefined ? 0 : group.freeQuantity;
      }
    }
  }

  return draft;
}

/** Seed advanced wizard local settings from a rule draft. */
export function seedWizardStateFromDraft(draft: RecommendationRuleDraft): {
  kind: Exclude<WizardChoiceKind, 'prefs'>;
  required: boolean;
  multipleMode: 'CHECKBOX' | 'QUANTITY';
  selectedCategoryIds: string[];
  productCategoryIds: string[];
  linkedProductIds: string[];
  categorySettings: Record<string, CategoryWizardSettings>;
  productSettings: Record<string, ProductWizardSettings>;
} {
  const kind = variantToWizardKind(
    draft.sourceType === 'CATEGORY'
      ? draft.selectionType === 'SINGLE'
        ? 'category-single'
        : 'category-multiple'
      : draft.selectionType === 'SINGLE'
        ? 'product-single'
        : 'product-multiple'
  );
  const categorySettings: Record<string, CategoryWizardSettings> = {};
  const productSettings: Record<string, ProductWizardSettings> = {};

  if (draft.sourceType === 'CATEGORY') {
    for (const catId of draft.ruleCategoryIds) {
      const minMax =
        draft.categoryMinMax[catId] ?? { ...DEFAULT_CATEGORY_MIN_MAX };
      const perSize = draft.categoryVariationLimits[catId] ?? [];
      categorySettings[catId] = {
        ...defaultCategorySettings(minMax.minItems, minMax.maxItems),
        discountPercent: draft.categoryDiscountPercent[catId] ?? null,
        extraCostPercent: draft.categoryExtraCostPercent[catId] ?? null,
        recommendedVariationId: draft.categoryDefaultVariations[catId] ?? '',
        includeRecommendedVariationPrice:
          draft.categoryIncludeDefaultVariationPrice[catId] ?? true,
        defaultItemId: draft.categoryDefaults[catId] ?? '',
        useVariationPricing: Boolean(draft.categoryVariationPricing[catId]),
        freeQuantity:
          catId in draft.categoryFreeQuantity
            ? draft.categoryFreeQuantity[catId]
            : undefined,
        usePerSizeLimits: perSize.length > 0,
        perSizeLimits: perSize.map((row) => ({ ...row })),
        productOverrides: Object.fromEntries(
          Object.entries(draft.categoryProductOverrides[catId] ?? {}).map(
            ([productId, override]) => [productId, { ...override }]
          )
        ),
      };
    }
  } else {
    const productIds =
      draft.linkedProductIds.length > 0
        ? draft.linkedProductIds
        : draft.linkedProductId
          ? [draft.linkedProductId]
          : [];
    for (const productId of productIds) {
      const minMax =
        draft.productMinMax[productId] ?? { ...DEFAULT_CATEGORY_MIN_MAX };
      productSettings[productId] = {
        ...defaultProductSettings(minMax.minItems, minMax.maxItems),
        freeQuantity:
          productId in draft.productFreeQuantity
            ? draft.productFreeQuantity[productId]
            : undefined,
      };
    }
  }

  return {
    kind,
    required: draft.required,
    multipleMode: draft.multipleMode,
    selectedCategoryIds: [...draft.ruleCategoryIds],
    productCategoryIds: [...draft.productCategoryIds],
    linkedProductIds:
      draft.linkedProductIds.length > 0
        ? [...draft.linkedProductIds]
        : draft.linkedProductId
          ? [draft.linkedProductId]
          : [],
    categorySettings,
    productSettings,
  };
}

/** Per selected category — mirrors classic editor granularity. */
export type CategoryWizardSettings = {
  minItems: number;
  maxItems: number;
  discountPercent: number | null;
  extraCostPercent: number | null;
  recommendedVariationId: string;
  includeRecommendedVariationPrice: boolean;
  defaultItemId: string;
  useVariationPricing: boolean;
  /** number = free units; null = explicitly no free; undefined = unset */
  freeQuantity: number | null | undefined;
  usePerSizeLimits: boolean;
  perSizeLimits: VariationLimitDraft[];
  productOverrides: Record<string, RecommendationProductOverrideDraft>;
};

export type ProductWizardSettings = {
  minItems: number;
  maxItems: number;
  freeQuantity: number | null | undefined;
};

export function defaultCategorySettings(
  minItems = 0,
  maxItems = 5
): CategoryWizardSettings {
  return {
    minItems,
    maxItems,
    discountPercent: null,
    extraCostPercent: null,
    recommendedVariationId: '',
    includeRecommendedVariationPrice: true,
    defaultItemId: '',
    useVariationPricing: false,
    freeQuantity: undefined,
    usePerSizeLimits: false,
    perSizeLimits: [],
    productOverrides: {},
  };
}

export function defaultProductSettings(
  minItems = 0,
  maxItems = 3
): ProductWizardSettings {
  return {
    minItems,
    maxItems,
    freeQuantity: undefined,
  };
}

export type WizardRuleDraftInput = {
  kind: Exclude<WizardChoiceKind, 'prefs'>;
  required: boolean;
  multipleMode: 'CHECKBOX' | 'QUANTITY';
  selectedCategoryIds: string[];
  productCategoryIds: string[];
  linkedProductIds: string[];
  categorySettings: Record<string, CategoryWizardSettings>;
  productSettings: Record<string, ProductWizardSettings>;
  baseVariations: Array<{ id: string }>;
};

export function buildWizardRuleDraft(
  input: WizardRuleDraftInput
): RecommendationRuleDraft {
  const selectionType: 'SINGLE' | 'MULTIPLE' = isOneKind(input.kind)
    ? 'SINGLE'
    : 'MULTIPLE';
  const sourceType: 'CATEGORY' | 'PRODUCT' = isCategoryKind(input.kind)
    ? 'CATEGORY'
    : 'PRODUCT';

  const draft = emptyRuleDraft(sourceType, selectionType);
  draft.required = isOneKind(input.kind) ? true : input.required;
  draft.multipleMode = isOneKind(input.kind) ? 'CHECKBOX' : input.multipleMode;

  if (sourceType === 'CATEGORY') {
    draft.ruleCategoryIds = [...input.selectedCategoryIds];
    for (const catId of input.selectedCategoryIds) {
      const settings =
        input.categorySettings[catId] ?? defaultCategorySettings();

      if (Object.keys(settings.productOverrides).length > 0) {
        draft.categoryProductOverrides[catId] = Object.fromEntries(
          Object.entries(settings.productOverrides).map(
            ([productId, override]) => [productId, { ...override }]
          )
        );
      }
      if (settings.discountPercent != null) {
        draft.categoryDiscountPercent[catId] = settings.discountPercent;
      }
      if (settings.extraCostPercent != null) {
        draft.categoryExtraCostPercent[catId] = settings.extraCostPercent;
      }
      if (settings.recommendedVariationId) {
        draft.categoryDefaultVariations[catId] =
          settings.recommendedVariationId;
        draft.categoryIncludeDefaultVariationPrice[catId] =
          settings.includeRecommendedVariationPrice;
      }
      if (settings.defaultItemId) {
        draft.categoryDefaults[catId] = settings.defaultItemId;
      }
      if (
        settings.useVariationPricing &&
        !settings.recommendedVariationId
      ) {
        draft.categoryVariationPricing[catId] = true;
      }

      if (selectionType === 'MULTIPLE') {
        if (draft.multipleMode === 'QUANTITY') {
          if (settings.freeQuantity === null) {
            draft.categoryFreeQuantity[catId] = null;
          } else if (
            typeof settings.freeQuantity === 'number' &&
            settings.freeQuantity > 0
          ) {
            draft.categoryFreeQuantity[catId] = Math.max(
              DEFAULT_FREE_QUANTITY,
              settings.freeQuantity
            );
          }
        }

        if (
          settings.usePerSizeLimits &&
          input.baseVariations.length > 0 &&
          settings.perSizeLimits.length > 0
        ) {
          draft.categoryVariationLimits[catId] = settings.perSizeLimits.map(
            (row) => ({ ...row })
          );
        } else {
          draft.categoryMinMax[catId] = {
            minItems: Math.max(0, settings.minItems),
            maxItems: Math.max(
              1,
              Math.max(settings.minItems, settings.maxItems)
            ),
          };
        }
      }
    }
  } else {
    draft.productCategoryIds = [...input.productCategoryIds];
    if (selectionType === 'SINGLE') {
      draft.linkedProductId = input.linkedProductIds[0] ?? '';
      draft.linkedProductIds = draft.linkedProductId
        ? [draft.linkedProductId]
        : [];
    } else {
      draft.linkedProductIds = [...input.linkedProductIds];
      draft.linkedProductId = input.linkedProductIds[0] ?? '';
      for (const productId of input.linkedProductIds) {
        const settings =
          input.productSettings[productId] ?? defaultProductSettings();
        draft.productMinMax[productId] = {
          minItems: Math.max(0, settings.minItems),
          maxItems: Math.max(
            1,
            Math.max(settings.minItems, settings.maxItems)
          ),
        };
        if (draft.multipleMode === 'QUANTITY') {
          if (settings.freeQuantity === null) {
            draft.productFreeQuantity[productId] = null;
          } else if (
            typeof settings.freeQuantity === 'number' &&
            settings.freeQuantity > 0
          ) {
            draft.productFreeQuantity[productId] = Math.max(
              DEFAULT_FREE_QUANTITY,
              settings.freeQuantity
            );
          }
        }
      }
    }
  }

  return draft;
}

export function seedPerSizeLimits(
  baseVariations: Array<{ id: string }>,
  minItems: number,
  maxItems: number
): VariationLimitDraft[] {
  if (baseVariations.length === 0) return [];
  return defaultVariationLimitsForVariations(baseVariations).map((row) => ({
    ...row,
    minItems: Math.max(0, minItems),
    maxItems: Math.max(1, Math.max(minItems, maxItems)),
  }));
}

export { DEFAULT_CATEGORY_MIN_MAX, DEFAULT_FREE_QUANTITY };
