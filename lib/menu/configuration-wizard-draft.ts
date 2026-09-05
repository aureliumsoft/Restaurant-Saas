import type {
  RecommendationRuleDraft,
  VariationLimitDraft,
} from '@/components/dashboard/menu-manager/recommendation-rule-form';
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
  };
}

/** Per selected category — mirrors classic editor granularity. */
export type CategoryWizardSettings = {
  minItems: number;
  maxItems: number;
  discountPercent: number | null;
  recommendedVariationId: string;
  includeRecommendedVariationPrice: boolean;
  defaultItemId: string;
  useVariationPricing: boolean;
  /** number = free units; null = explicitly no free; undefined = unset */
  freeQuantity: number | null | undefined;
  usePerSizeLimits: boolean;
  perSizeLimits: VariationLimitDraft[];
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
    recommendedVariationId: '',
    includeRecommendedVariationPrice: true,
    defaultItemId: '',
    useVariationPricing: false,
    freeQuantity: undefined,
    usePerSizeLimits: false,
    perSizeLimits: [],
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

      if (settings.discountPercent != null) {
        draft.categoryDiscountPercent[catId] = settings.discountPercent;
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
