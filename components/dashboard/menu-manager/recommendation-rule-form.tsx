'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  isCategoryEligibleForRecommendations,
  isMenuCategoryShownInFront,
} from '@/lib/menu/category-visibility';
import { menuItemCategoryIds } from '@/lib/menu/menu-item-category-ids';
import { Badge } from '@/components/ui/badge';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { getRestaurantCurrencySymbol } from '@/lib/restaurant-regional';

import {
  DEFAULT_CATEGORY_MIN_MAX,
  DEFAULT_FREE_QUANTITY,
  defaultVariationLimitsForVariations,
  type CategoryMinMaxDraft,
  variationLabel,
} from '@/lib/menu/recommendation-category-limits';
import type { RecommendationFormVariant } from '@/lib/menu/recommendation-preview-groups';
import { buildRestaurantDefaultVariationOptions } from '@/lib/menu/recommendation-default-variation-options';
import {
  reservedRecommendationCategoryIds,
  reservedRecommendationProductIds,
} from '@/lib/menu/recommendation-reserved-ids';
import { useRestaurantVariationTemplates } from '@/components/dashboard/menu-manager/product-form-fields';

import type { MenuCategoryRow, MenuItemRow } from './types';

export type VariationLimitDraft = {
  variationId: string;
  minItems: number;
  maxItems: number;
};

export type RecommendationRuleDraft = {
  sourceType: 'CATEGORY' | 'PRODUCT';
  selectionType: 'SINGLE' | 'MULTIPLE';
  multipleMode: 'CHECKBOX' | 'QUANTITY';
  required: boolean;
  ruleCategoryIds: string[];
  /** categoryId → default menu item id */
  categoryDefaults: Record<string, string>;
  /** categoryId → restaurant variation template id (e.g. Medium) */
  categoryDefaultVariations: Record<string, string>;
  /** categoryId → show recommended variation price on customer side (default true) */
  categoryIncludeDefaultVariationPrice: Record<string, boolean>;
  productCategoryIds: string[];
  linkedProductId: string;
  linkedProductIds: string[];
  /** categoryId → free quantity (QUANTITY mode); null = no free items */
  categoryFreeQuantity: Record<string, number | null>;
  /** categoryId → min/max when base product has no variations */
  categoryMinMax: Record<string, CategoryMinMaxDraft>;
  /** categoryId → min/max per base-product variation */
  categoryVariationLimits: Record<string, VariationLimitDraft[]>;
  /** linkedProductId → free quantity (QUANTITY mode); null = no free items */
  productFreeQuantity: Record<string, number | null>;
  /** linkedProductId → min/max */
  productMinMax: Record<string, CategoryMinMaxDraft>;
  /** categoryId → price add-ons by product variation */
  categoryVariationPricing: Record<string, boolean>;
};

type Props = {
  variant: RecommendationFormVariant;
  selected: MenuItemRow & { categoryName: string };
  localCategories: MenuCategoryRow[];
  allProducts: (MenuItemRow & { categoryName: string })[];
  saving: boolean;
  saveLabel?: string;
  onSave: (draft: RecommendationRuleDraft) => void;
  onDraftChange?: (draft: RecommendationRuleDraft) => void;
  /** Bumps when the form should reset (after save, discard, or product change). */
  resetKey?: string | number;
  /** Unsaved drafts from other sections — used to hide already-picked categories/products. */
  draftByVariant?: Partial<
    Record<RecommendationFormVariant, RecommendationRuleDraft>
  >;
};

function variantDefaults(variant: RecommendationFormVariant): {
  sourceType: 'CATEGORY' | 'PRODUCT';
  selectionType: 'SINGLE' | 'MULTIPLE';
} {
  switch (variant) {
    case 'category-single':
      return { sourceType: 'CATEGORY', selectionType: 'SINGLE' };
    case 'category-multiple':
      return { sourceType: 'CATEGORY', selectionType: 'MULTIPLE' };
    case 'product-single':
      return { sourceType: 'PRODUCT', selectionType: 'SINGLE' };
    case 'product-multiple':
      return { sourceType: 'PRODUCT', selectionType: 'MULTIPLE' };
  }
}

export function RecommendationRuleForm({
  variant,
  selected,
  localCategories,
  allProducts,
  saving,
  saveLabel = 'Save section',
  onSave,
  onDraftChange,
  resetKey = 0,
  draftByVariant = {},
}: Props) {
  const { formatMoney, regional } = useOwnerRestaurantRegional();
  const currencySymbol = getRestaurantCurrencySymbol(regional.currencyCode);
  const locked = variantDefaults(variant);
  const [sourceType] = useState<'CATEGORY' | 'PRODUCT'>(locked.sourceType);
  const [selectionType] = useState<'SINGLE' | 'MULTIPLE'>(locked.selectionType);
  const [multipleMode, setMultipleMode] = useState<'CHECKBOX' | 'QUANTITY'>('CHECKBOX');
  const [required, setRequired] = useState(true);
  const [ruleCategoryIds, setRuleCategoryIds] = useState<string[]>([]);
  const [categoryDefaults, setCategoryDefaults] = useState<
    Record<string, string>
  >({});
  const [categoryDefaultVariations, setCategoryDefaultVariations] = useState<
    Record<string, string>
  >({});
  const [
    categoryIncludeDefaultVariationPrice,
    setCategoryIncludeDefaultVariationPrice,
  ] = useState<Record<string, boolean>>({});
  const [productCategoryIds, setProductCategoryIds] = useState<string[]>([]);
  const [linkedProductId, setLinkedProductId] = useState('');
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [categoryFreeQuantity, setCategoryFreeQuantity] = useState<
    Record<string, number | null>
  >({});
  const [categoryMinMax, setCategoryMinMax] = useState<
    Record<string, CategoryMinMaxDraft>
  >({});
  const [categoryVariationLimits, setCategoryVariationLimits] = useState<
    Record<string, VariationLimitDraft[]>
  >({});
  const [productFreeQuantity, setProductFreeQuantity] = useState<
    Record<string, number | null>
  >({});
  const [productMinMax, setProductMinMax] = useState<
    Record<string, CategoryMinMaxDraft>
  >({});
  const [categoryVariationPricing, setCategoryVariationPricing] = useState<
    Record<string, boolean>
  >({});
  const [categoryProductsById, setCategoryProductsById] = useState<
    Record<string, MenuItemRow[]>
  >({});
  const [categoryProductsLoadingById, setCategoryProductsLoadingById] = useState<
    Record<string, boolean>
  >({});

  const { variationTemplates, loading: variationTemplatesLoading } =
    useRestaurantVariationTemplates();
  const defaultVariationOptions = useMemo(
    () => buildRestaurantDefaultVariationOptions(variationTemplates),
    [variationTemplates]
  );
  const baseVariations = selected.variations ?? [];

  const selectedCategoryIds = useMemo(
    () => menuItemCategoryIds(selected),
    [selected]
  );

  /** Non-empty categories for category-type rules (exclude base product's categories). */
  const recommendationCategories = useMemo(
    () =>
      localCategories.filter(
        (c) =>
          isCategoryEligibleForRecommendations(c) &&
          !selectedCategoryIds.includes(c.id)
      ),
    [localCategories, selectedCategoryIds]
  );

  /** All non-empty categories for single-product picker (same + other categories). */
  const productPickerCategories = useMemo(
    () => localCategories.filter(isCategoryEligibleForRecommendations),
    [localCategories]
  );

  const reservedCategoryIds = useMemo(
    () =>
      reservedRecommendationCategoryIds(selected, draftByVariant, variant),
    [selected, draftByVariant, variant]
  );

  const reservedProductIds = useMemo(
    () => reservedRecommendationProductIds(selected, draftByVariant, variant),
    [selected, draftByVariant, variant]
  );

  const assignableCategories = recommendationCategories.filter(
    (c) => !reservedCategoryIds.has(c.id)
  );

  const assignableProducts = allProducts.filter(
    (p) => !reservedProductIds.has(p.id)
  );

  useEffect(() => {
    setRuleCategoryIds((prev) => {
      const next = prev.filter((id) => !reservedCategoryIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [reservedCategoryIds]);

  useEffect(() => {
    setLinkedProductId((prev) =>
      prev && reservedProductIds.has(prev) ? '' : prev
    );
    setLinkedProductIds((prev) => {
      const next = prev.filter((id) => !reservedProductIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [reservedProductIds]);

  const productsFromSelectedCategories = useMemo(() => {
    if (productCategoryIds.length === 0) return [];
    const allow = new Set(productCategoryIds);
    return assignableProducts.filter((p) => allow.has(p.categoryId));
  }, [assignableProducts, productCategoryIds]);

  const toggleInArray = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const toggleProductCategory = (id: string) => {
    setProductCategoryIds((prev) => {
      const next = toggleInArray(prev, id);
      setLinkedProductId((pid) => {
        if (!pid) return pid;
        const p = assignableProducts.find((x) => x.id === pid);
        if (p && !next.includes(p.categoryId)) return '';
        return pid;
      });
      return next;
    });
  };

  const useVariationLimits =
    selectionType === 'MULTIPLE' &&
    sourceType === 'CATEGORY' &&
    (selected.variations?.length ?? 0) > 0;

  const initCategoryLimitDefaults = (categoryId: string) => {
    setCategoryFreeQuantity((prev) => ({
      ...prev,
      [categoryId]: prev[categoryId] ?? null,
    }));
    setCategoryMinMax((prev) => ({
      ...prev,
      [categoryId]: prev[categoryId] ?? { ...DEFAULT_CATEGORY_MIN_MAX },
    }));
    if (baseVariations.length > 0) {
      setCategoryVariationLimits((prev) => ({
        ...prev,
        [categoryId]:
          prev[categoryId] ??
          defaultVariationLimitsForVariations(baseVariations),
      }));
    }
  };

  const clearCategoryLimitDefaults = (categoryId: string) => {
    setCategoryFreeQuantity((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    setCategoryMinMax((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    setCategoryVariationLimits((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  };

  const initProductLimitDefaults = (productId: string) => {
    setProductFreeQuantity((prev) => ({
      ...prev,
      [productId]: prev[productId] ?? null,
    }));
    setProductMinMax((prev) => ({
      ...prev,
      [productId]: prev[productId] ?? { ...DEFAULT_CATEGORY_MIN_MAX },
    }));
  };

  const clearProductLimitDefaults = (productId: string) => {
    setProductFreeQuantity((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setProductMinMax((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const toggleCategory = (id: string) => {
    setRuleCategoryIds((prev) => {
      if (prev.includes(id)) {
        setCategoryDefaults((defaults) => {
          const next = { ...defaults };
          delete next[id];
          return next;
        });
        setCategoryDefaultVariations((prevVariations) => {
          const next = { ...prevVariations };
          delete next[id];
          return next;
        });
        setCategoryIncludeDefaultVariationPrice((prevPricing) => {
          const next = { ...prevPricing };
          delete next[id];
          return next;
        });
        setCategoryVariationPricing((prevPricing) => {
          const next = { ...prevPricing };
          delete next[id];
          return next;
        });
        clearCategoryLimitDefaults(id);
        return prev.filter((x) => x !== id);
      }
      initCategoryLimitDefaults(id);
      return [...prev, id];
    });
  };

  const setCategoryDefault = (categoryId: string, menuItemId: string) => {
    setCategoryDefaults((prev) => ({ ...prev, [categoryId]: menuItemId }));
  };

  const clearCategoryDefault = (categoryId: string) => {
    setCategoryDefaults((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  };

  const setCategoryDefaultVariation = (
    categoryId: string,
    restaurantVariationId: string
  ) => {
    setCategoryDefaultVariations((prev) => ({
      ...prev,
      [categoryId]: restaurantVariationId,
    }));
    setCategoryIncludeDefaultVariationPrice((prev) => ({
      ...prev,
      [categoryId]: prev[categoryId] ?? true,
    }));
    setCategoryVariationPricing((prev) => ({
      ...prev,
      [categoryId]: false,
    }));
  };

  const clearCategoryDefaultVariation = (categoryId: string) => {
    setCategoryDefaultVariations((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    setCategoryIncludeDefaultVariationPrice((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  };

  const setCategoryIncludeDefaultVariationPriceEnabled = (
    categoryId: string,
    enabled: boolean
  ) => {
    setCategoryIncludeDefaultVariationPrice((prev) => ({
      ...prev,
      [categoryId]: enabled,
    }));
  };

  const setCategoryVariationPricingEnabled = (
    categoryId: string,
    enabled: boolean
  ) => {
    setCategoryVariationPricing((prev) => ({
      ...prev,
      [categoryId]: enabled,
    }));
    if (enabled) {
      setCategoryDefaultVariations((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
  };

  const selectedCategories = useMemo(
    () =>
      ruleCategoryIds
        .map((id) => {
          const category = localCategories.find((c) => c.id === id);
          if (!category) return null;
          const loadedItems = categoryProductsById[id];
          return {
            ...category,
            items: loadedItems ?? category.items,
          };
        })
        .filter((c): c is MenuCategoryRow => c != null),
    [localCategories, ruleCategoryIds, categoryProductsById]
  );

  const currentDraft = useMemo(
    (): RecommendationRuleDraft => ({
      sourceType,
      selectionType,
      multipleMode,
      required,
      ruleCategoryIds,
      categoryDefaults,
      categoryDefaultVariations,
      categoryIncludeDefaultVariationPrice,
      productCategoryIds,
      linkedProductId,
      linkedProductIds,
      categoryFreeQuantity,
      categoryMinMax,
      categoryVariationLimits,
      productFreeQuantity,
      productMinMax,
      categoryVariationPricing,
    }),
    [
      sourceType,
      selectionType,
      multipleMode,
      required,
      ruleCategoryIds,
      categoryDefaults,
      categoryDefaultVariations,
      categoryIncludeDefaultVariationPrice,
      productCategoryIds,
      linkedProductId,
      linkedProductIds,
      categoryFreeQuantity,
      categoryMinMax,
      categoryVariationLimits,
      productFreeQuantity,
      productMinMax,
      categoryVariationPricing,
    ]
  );

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const lastDraftKeyRef = useRef('');

  useEffect(() => {
    setMultipleMode('CHECKBOX');
    setRequired(false);
    setRuleCategoryIds([]);
    setCategoryDefaults({});
    setCategoryDefaultVariations({});
    setCategoryIncludeDefaultVariationPrice({});
    setProductCategoryIds([]);
    setLinkedProductId('');
    setLinkedProductIds([]);
    setCategoryFreeQuantity({});
    setCategoryMinMax({});
    setCategoryVariationLimits({});
    setProductFreeQuantity({});
    setProductMinMax({});
    setCategoryVariationPricing({});
    setCategoryProductsById({});
    setCategoryProductsLoadingById({});
    lastDraftKeyRef.current = '';
  }, [resetKey]);

  useEffect(() => {
    if (sourceType !== 'CATEGORY') return;
    for (const categoryId of ruleCategoryIds) {
      if (categoryProductsById[categoryId]?.length) continue;
      if (categoryProductsLoadingById[categoryId]) continue;

      setCategoryProductsLoadingById((prev) => ({
        ...prev,
        [categoryId]: true,
      }));

      void (async () => {
        try {
          let page = 1;
          let hasMore = true;
          const collected: MenuItemRow[] = [];
          while (hasMore) {
            const res = await axios.get<{
              data: {
                products: MenuItemRow[];
                pagination: { hasNextPage: boolean };
              };
            }>('/api/restaurant/menu/products', {
              params: {
                page,
                limit: 24,
                categoryIds: categoryId,
                includeCategories: '0',
              },
            });

            const batch = res.data.data.products ?? [];
            collected.push(...batch);
            hasMore = Boolean(res.data.data.pagination?.hasNextPage);
            page += 1;
            if (page > 20 || batch.length === 0) break;
          }

          setCategoryProductsById((prev) => ({
            ...prev,
            [categoryId]: collected,
          }));
        } finally {
          setCategoryProductsLoadingById((prev) => ({
            ...prev,
            [categoryId]: false,
          }));
        }
      })();
    }
  }, [sourceType, ruleCategoryIds, categoryProductsById, categoryProductsLoadingById]);

  useEffect(() => {
    const draftKey = JSON.stringify(currentDraft);
    if (draftKey === lastDraftKeyRef.current) return;
    lastDraftKeyRef.current = draftKey;
    onDraftChangeRef.current?.(currentDraft);
  }, [currentDraft]);

  const toggleLinkedProduct = (id: string) => {
    setLinkedProductIds((prev) => {
      if (prev.includes(id)) {
        clearProductLimitDefaults(id);
        return prev.filter((x) => x !== id);
      }
      initProductLimitDefaults(id);
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-4">
      {selectionType === 'MULTIPLE' ? (
        <div className="grid gap-2">
          <Label>Multiple style</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                ['CHECKBOX', 'Checkboxes (1 each)'],
                ['QUANTITY', 'Plus / minus quantities'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-left text-xs sm:text-sm',
                  multipleMode === value
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                )}
                onClick={() => setMultipleMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {multipleMode === 'QUANTITY' &&
          sourceType === 'CATEGORY' &&
          selectedCategories.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <Label>Free quantity</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  First N units free per category; extra units are charged.
                </p>
              </div>
              <div className="space-y-2">
                {selectedCategories.map((cat, index) => {
                  const noFreeItems = categoryFreeQuantity[cat.id] === null;
                  return (
                    <div
                      key={`free-qty-${cat.id}`}
                      className="space-y-2 rounded-md border border-border/60 bg-background p-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="tabular-nums">
                          #{index + 1}
                        </Badge>
                        <span className="text-sm font-medium">{cat.name}</span>
                      </div>
                     
                      {!noFreeItems ? (
                        <Input
                          type="number"
                          min={1}
                          className="h-10"
                          value={
                            categoryFreeQuantity[cat.id] ??
                            DEFAULT_FREE_QUANTITY
                          }
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Number.parseInt(e.target.value, 10) ||
                                DEFAULT_FREE_QUANTITY
                            );
                            setCategoryFreeQuantity((prev) => ({
                              ...prev,
                              [cat.id]: val,
                            }));
                          }}
                        />
                      ) : null}

                       <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={noFreeItems}
                          onChange={(e) => {
                            setCategoryFreeQuantity((prev) => ({
                              ...prev,
                              [cat.id]: e.target.checked
                                ? null
                                : DEFAULT_FREE_QUANTITY,
                            }));
                          }}
                        />
                        <span>No free items for this category</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          
        </div>
      ) : null}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          defaultChecked={true}
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required before add to cart</span>
      </label>

      {sourceType === 'CATEGORY' ? (
        assignableCategories.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {recommendationCategories.length === 0
                ? 'Add products to a category first, or link categories other than this product’s own.'
                : 'All available categories are already used in another recommendation section for this product.'}
            </p>
            <Button type="button" asChild size="sm" variant="secondary" className="w-fit">
              <Link href="/categories">Go to Categories</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              For each category, optionally choose a recommended variation
              (e.g. Medium) and/or a default item. A recommended variation
              filters add-ons to that size and applies it automatically at
              checkout. When a default item is set, guests only see an extra
              charge (+{currencySymbol}) for options priced above that default.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {assignableCategories.map((cat) => {
                const checked = ruleCategoryIds.includes(cat.id);
                const selectionOrder = ruleCategoryIds.indexOf(cat.id);
                const onMenu = isMenuCategoryShownInFront(cat);
                const defaultId = categoryDefaults[cat.id];
                const categoryItems = categoryProductsById[cat.id] ?? cat.items;
                const categoryItemsLoading =
                  categoryProductsLoadingById[cat.id] ?? false;
                const variationPricingEnabled =
                  categoryVariationPricing[cat.id] ?? false;
                const defaultVariationId = categoryDefaultVariations[cat.id];
                const includeDefaultVariationPrice =
                  categoryIncludeDefaultVariationPrice[cat.id] ?? true;
                return (
                  <div
                    key={cat.id}
                    className={cn(
                      'rounded-lg border p-3',
                      checked ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-primary"
                        checked={checked}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {checked ? (
                        <Badge
                          variant="secondary"
                          className="shrink-0 tabular-nums text-[10px]"
                        >
                          #{selectionOrder + 1}
                        </Badge>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {cat.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] font-normal"
                      >
                        {onMenu ? 'On menu' : 'Add-on only'}
                      </Badge>
                    </label>
                    {checked && variationTemplatesLoading ? (
                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading variation options...
                      </div>
                    ) : checked && defaultVariationOptions.length > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <Label
                          htmlFor={`recommended-variation-${cat.id}`}
                          className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Recommended variation (optional)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Pick a size for this category (e.g. Medium). Only
                          add-ons with that variation are shown, and it is
                          applied automatically when the guest selects one.
                        </p>
                        <Select
                          value={defaultVariationId || '__none__'}
                          onValueChange={(value) => {
                            if (value === '__none__') {
                              clearCategoryDefaultVariation(cat.id);
                            } else {
                              setCategoryDefaultVariation(cat.id, value);
                            }
                          }}
                        >
                          <SelectTrigger
                            id={`recommended-variation-${cat.id}`}
                            className="h-10 bg-background text-sm"
                          >
                            <SelectValue placeholder="Select variation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {defaultVariationOptions.map((option) => (
                              <SelectItem
                                key={`${cat.id}-${option.restaurantVariationId}`}
                                value={option.restaurantVariationId}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="mt-2 flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                            checked={includeDefaultVariationPrice}
                            onChange={(e) =>
                              setCategoryIncludeDefaultVariationPriceEnabled(
                                cat.id,
                                e.target.checked
                              )
                            }
                          />
                          <span className="text-xs">
                            <span className="font-medium text-foreground">
                              Show recommended variation price
                            </span>
                            <span className="mt-0.5 block text-muted-foreground">
                              When unchecked, guests see base product prices
                              only (the recommended size is free).
                            </span>
                          </span>
                        </label>
                      </div>
                    ) : checked ? (
                      <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                        No variation templates yet. Add sizes on the{' '}
                        <Link href="/variations" className="underline">
                          Variations
                        </Link>{' '}
                        page, then pick a recommended variation for this
                        category.
                      </p>
                    ) : null}
                    {checked && categoryItemsLoading ? (
                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading category products...
                      </div>
                    ) : checked && categoryItems.length > 0 ? (
                      <div className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-border pt-3">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Default item (optional)
                        </p>
                        <label
                          className={cn(
                            'mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                            !defaultId
                              ? 'bg-primary/10 text-foreground'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          <input
                            type="radio"
                            name={`default-${cat.id}`}
                            className="h-3.5 w-3.5 accent-primary"
                            checked={!defaultId}
                            onChange={() => clearCategoryDefault(cat.id)}
                          />
                          <span className="italic text-muted-foreground">
                            None
                          </span>
                        </label>
                        {categoryItems.map((it) => (
                          <label
                            key={it.id}
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                              defaultId === it.id
                                ? 'bg-primary/10 text-foreground'
                                : 'hover:bg-muted/50'
                            )}
                          >
                            <input
                              type="radio"
                              name={`default-${cat.id}`}
                              className="h-3.5 w-3.5 accent-primary"
                              checked={defaultId === it.id}
                              onChange={() =>
                                setCategoryDefault(cat.id, it.id)
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {it.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatMoney(
                                it.salePrice != null &&
                                it.salePrice > 0 &&
                                it.salePrice < it.price
                                  ? it.salePrice
                                  : it.price
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : checked ? (
                      <p className="mt-2 text-xs text-destructive">
                        Add products to this category first.
                      </p>
                    ) : null}
                    {checked &&
                    baseVariations.length > 0 &&
                    categoryItems.length > 0 ? (
                      <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-border pt-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                          checked={variationPricingEnabled}
                          disabled={Boolean(defaultVariationId)}
                          onChange={(e) =>
                            setCategoryVariationPricingEnabled(
                              cat.id,
                              e.target.checked
                            )
                          }
                        />
                        <span className="text-xs">
                          <span className="font-medium text-foreground">
                            Price add-ons by product variation
                          </span>
                          <span className="mt-0.5 block text-muted-foreground">
                            Use each add-on&apos;s variation rate when the guest
                            picks Small, Medium, or Large on this product.
                          </span>
                        </span>
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : productPickerCategories.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No categories with products available.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Choose categories (including this product&apos;s category or
            others), then pick one anchor product. Guests can choose from all
            products in those categories except the item they are ordering.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {productPickerCategories.map((cat) => {
              const checked = productCategoryIds.includes(cat.id);
              const onMenu = isMenuCategoryShownInFront(cat);
              return (
                <label
                  key={`rec-prod-cat-${cat.id}`}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                    checked
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => toggleProductCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] font-normal"
                  >
                    {onMenu ? 'On menu' : 'Add-on only'}
                  </Badge>
                </label>
              );
            })}
          </div>

          {productCategoryIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Select at least one category to load products.
            </p>
          ) : productsFromSelectedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products in the selected categories (or already assigned).
            </p>
          ) : variant === 'product-multiple' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {productsFromSelectedCategories.map((p) => {
                const checked = linkedProductIds.includes(p.id);
                const selectionOrder = linkedProductIds.indexOf(p.id);
                return (
                  <label
                    key={`rec-product-${p.id}`}
                    className="group relative block cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={() => toggleLinkedProduct(p.id)}
                    />
                    <div
                      className={cn(
                        'flex h-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                        checked
                          ? 'border-primary ring-2 ring-primary/25'
                          : 'border-border'
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full shrink-0 bg-muted">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            No photo
                          </div>
                        )}
                        {checked ? (
                          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                            #{selectionOrder + 1}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background/90 text-xs font-bold shadow-sm backdrop-blur-sm transition',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-transparent group-hover:border-primary/50'
                          )}
                          aria-hidden
                        >
                          ✓
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.categoryName}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {productsFromSelectedCategories.map((p) => {
                const checked = linkedProductId === p.id;
                return (
                  <label
                    key={`rec-product-${p.id}`}
                    className="group relative block cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`rec-product-${variant}`}
                      className="peer sr-only"
                      checked={checked}
                      onChange={() => setLinkedProductId(p.id)}
                    />
                    <div
                      className={cn(
                        'flex h-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                        checked
                          ? 'border-primary ring-2 ring-primary/25'
                          : 'border-border'
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full shrink-0 bg-muted">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            No photo
                          </div>
                        )}
                        <span
                          className={cn(
                            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background/90 text-xs font-bold shadow-sm backdrop-blur-sm transition',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-transparent group-hover:border-primary/50'
                          )}
                          aria-hidden
                        >
                          ✓
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.categoryName}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectionType === 'MULTIPLE' &&
      sourceType === 'CATEGORY' &&
      selectedCategories.length > 0 &&
      !useVariationLimits ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Min / max</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Minimum and maximum selections per category.
            </p>
          </div>
          <div className="space-y-2">
            {selectedCategories.map((cat) => {
              const limits =
                categoryMinMax[cat.id] ?? { ...DEFAULT_CATEGORY_MIN_MAX };
              return (
                <div
                  key={`minmax-${cat.id}`}
                  className="grid gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]"
                >
                  <span className="self-center text-sm font-medium">
                    {cat.name}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="h-9"
                    aria-label={`${cat.name} minimum`}
                    maxLength={limits.maxItems.toString().length}
                    disabled={limits.minItems >= limits.maxItems}
                    value={limits.minItems}
                    onChange={(e) => {
                      const val = Math.max(
                        0,
                        Number.parseInt(e.target.value, 10) || 0
                      );
                      setCategoryMinMax((prev) => ({
                        ...prev,
                        [cat.id]: {
                          ...(prev[cat.id] ?? DEFAULT_CATEGORY_MIN_MAX),
                          minItems: val,
                        },
                      }));
                    }}
                  />
                  <Input
                    type="number"
                    min={1}
                    className="h-9"
                    aria-label={`${cat.name} maximum`}
                    // minLength={limits.maxItems.toString().length}
                    disabled={limits.minItems >= limits.maxItems}
                    value={limits.maxItems}
                    onChange={(e) => {
                      const val = Math.max(
                        1,
                        Number.parseInt(e.target.value, 10) || 1
                      );
                      setCategoryMinMax((prev) => ({
                        ...prev,
                        [cat.id]: {
                          ...(prev[cat.id] ?? DEFAULT_CATEGORY_MIN_MAX),
                          maxItems: val,
                        },
                      }));
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

{multipleMode === 'QUANTITY' &&
          sourceType === 'PRODUCT' &&
          linkedProductIds.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <Label>Free quantity</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  First N units free per linked product.
                </p>
              </div>
              <div className="space-y-2">
                {linkedProductIds.map((productId) => {
                  const product = allProducts.find((p) => p.id === productId);
                  if (!product) return null;
                  const noFreeItems = productFreeQuantity[productId] === null;
                  return (
                    <div
                      key={`free-qty-product-${productId}`}
                      className="space-y-2 rounded-md border border-border/60 bg-background p-2"
                    >
                      <span className="text-sm font-medium">{product.name}</span>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={noFreeItems}
                          onChange={(e) => {
                            setProductFreeQuantity((prev) => ({
                              ...prev,
                              [productId]: e.target.checked
                                ? null
                                : DEFAULT_FREE_QUANTITY,
                            }));
                          }}
                        />
                        <span>No free items for this product</span>
                      </label>
                      {!noFreeItems ? (
                        <Input
                          type="number"
                          min={1}
                          className="h-10"
                          value={
                            productFreeQuantity[productId] ??
                            DEFAULT_FREE_QUANTITY
                          }
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Number.parseInt(e.target.value, 10) ||
                                DEFAULT_FREE_QUANTITY
                            );
                            setProductFreeQuantity((prev) => ({
                              ...prev,
                              [productId]: val,
                            }));
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

      {selectionType === 'MULTIPLE' &&
      sourceType === 'PRODUCT' &&
      linkedProductIds.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Min / max</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Minimum and maximum selections per linked product.
            </p>
          </div>
          <div className="space-y-2">
            {linkedProductIds.map((productId) => {
              const product = allProducts.find((p) => p.id === productId);
              if (!product) return null;
              const limits =
                productMinMax[productId] ?? { ...DEFAULT_CATEGORY_MIN_MAX };
              return (
                <div
                  key={`minmax-product-${productId}`}
                  className="grid gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]"
                >
                  <span className="self-center text-sm font-medium">
                    {product.name}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="h-9"
                    aria-label={`${product.name} minimum`}
                    value={limits.minItems}
                    onChange={(e) => {
                      const val = Math.max(
                        0,
                        Number.parseInt(e.target.value, 10) || 0
                      );
                      setProductMinMax((prev) => ({
                        ...prev,
                        [productId]: {
                          ...(prev[productId] ?? DEFAULT_CATEGORY_MIN_MAX),
                          minItems: val,
                        },
                      }));
                    }}
                  />
                  <Input
                    type="number"
                    min={1}
                    className="h-9"
                    aria-label={`${product.name} maximum`}
                    value={limits.maxItems}
                    onChange={(e) => {
                      const val = Math.max(
                        1,
                        Number.parseInt(e.target.value, 10) || 1
                      );
                      setProductMinMax((prev) => ({
                        ...prev,
                        [productId]: {
                          ...(prev[productId] ?? DEFAULT_CATEGORY_MIN_MAX),
                          maxItems: val,
                        },
                      }));
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {useVariationLimits && selectedCategories.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Min / max</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Per category and base-product variation.
            </p>
          </div>
          <div className="space-y-4">
            {selectedCategories.map((cat) => {
              const rows =
                categoryVariationLimits[cat.id] ??
                defaultVariationLimitsForVariations(baseVariations);
              return (
                <div key={`var-limits-${cat.id}`} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    {cat.name}
                  </p>
                  {rows.map((row, index) => {
                    const v = baseVariations.find(
                      (x) => x.id === row.variationId
                    );
                    const label = v ? variationLabel(v) : 'Variation';
                    return (
                      <div
                        key={`${cat.id}-${row.variationId}`}
                        className="grid gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]"
                      >
                        <span className="self-center text-sm text-foreground">
                          {label}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          className="h-9"
                          aria-label={`${cat.name} ${label} minimum`}
                          value={row.minItems}
                          onChange={(e) => {
                            const val = Math.max(
                              0,
                              Number.parseInt(e.target.value, 10) || 0
                            );
                            setCategoryVariationLimits((prev) => {
                              const current =
                                prev[cat.id] ??
                                defaultVariationLimitsForVariations(
                                  baseVariations
                                );
                              return {
                                ...prev,
                                [cat.id]: current.map((r, i) =>
                                  i === index ? { ...r, minItems: val } : r
                                ),
                              };
                            });
                          }}
                        />
                        <Input
                          type="number"
                          min={1}
                          className="h-9"
                          aria-label={`${cat.name} ${label} maximum`}
                          value={row.maxItems}
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Number.parseInt(e.target.value, 10) || 1
                            );
                            setCategoryVariationLimits((prev) => {
                              const current =
                                prev[cat.id] ??
                                defaultVariationLimitsForVariations(
                                  baseVariations
                                );
                              return {
                                ...prev,
                                [cat.id]: current.map((r, i) =>
                                  i === index ? { ...r, maxItems: val } : r
                                ),
                              };
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        className="w-full"
        disabled={saving}
        onClick={() => onSave(currentDraft)}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            {saveLabel}
          </>
        )}
      </Button>
    </div>
  );
}
