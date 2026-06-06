'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  isCategoryEligibleForRecommendations,
  isMenuCategoryShownInFront,
} from '@/lib/menu/category-visibility';
import { Badge } from '@/components/ui/badge';

import type { RecommendationFormVariant } from '@/lib/menu/recommendation-preview-groups';

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
  productCategoryIds: string[];
  linkedProductId: string;
  linkedProductIds: string[];
  minItems: number;
  maxItems: number;
  freeQuantity: number;
  variationLimits: VariationLimitDraft[];
  useVariationPricing: boolean;
};

type Props = {
  variant: RecommendationFormVariant;
  selected: MenuItemRow & { categoryName: string };
  localCategories: MenuCategoryRow[];
  allProducts: (MenuItemRow & { categoryName: string })[];
  saving: boolean;
  onSave: (draft: RecommendationRuleDraft) => void;
  onDraftChange?: (draft: RecommendationRuleDraft) => void;
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
  onSave,
  onDraftChange,
}: Props) {
  const locked = variantDefaults(variant);
  const [sourceType] = useState<'CATEGORY' | 'PRODUCT'>(locked.sourceType);
  const [selectionType] = useState<'SINGLE' | 'MULTIPLE'>(locked.selectionType);
  const [multipleMode, setMultipleMode] = useState<'CHECKBOX' | 'QUANTITY'>('CHECKBOX');
  const [required, setRequired] = useState(false);
  const [ruleCategoryIds, setRuleCategoryIds] = useState<string[]>([]);
  const [categoryDefaults, setCategoryDefaults] = useState<
    Record<string, string>
  >({});
  const [productCategoryIds, setProductCategoryIds] = useState<string[]>([]);
  const [linkedProductId, setLinkedProductId] = useState('');
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [minItems, setMinItems] = useState(1);
  const [maxItems, setMaxItems] = useState(3);
  const [freeQuantity, setFreeQuantity] = useState(1);
  const [variationLimits, setVariationLimits] = useState<VariationLimitDraft[]>([]);
  const [useVariationPricing, setUseVariationPricing] = useState(false);

  const baseVariations = selected.variations ?? [];

  /** Non-empty categories for category-type rules (exclude base product's category). */
  const recommendationCategories = useMemo(
    () =>
      localCategories.filter(
        (c) =>
          isCategoryEligibleForRecommendations(c) &&
          c.id !== selected.categoryId
      ),
    [localCategories, selected.categoryId]
  );

  /** All non-empty categories for single-product picker (same + other categories). */
  const productPickerCategories = useMemo(
    () => localCategories.filter(isCategoryEligibleForRecommendations),
    [localCategories]
  );

  const alreadyLinkedCategoryIds = useMemo(
    () =>
      new Set(
        selected.attributeGroups
          .filter((g) => g.sourceType !== 'PRODUCT' && g.linkedCategory)
          .map((g) => g.linkedCategory!.id)
      ),
    [selected.attributeGroups]
  );

  const alreadyLinkedProductIds = useMemo(
    () =>
      new Set(
        selected.attributeGroups
          .filter((g) => g.sourceType === 'PRODUCT' && g.linkedProduct)
          .map((g) => g.linkedProduct!.id)
      ),
    [selected.attributeGroups]
  );

  const assignableCategories = recommendationCategories.filter(
    (c) => !alreadyLinkedCategoryIds.has(c.id)
  );

  const assignableProducts = allProducts.filter(
    (p) =>
      p.id !== selected.id &&
      !alreadyLinkedProductIds.has(p.id)
  );

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
    baseVariations.length > 0;

  const toggleCategory = (id: string) => {
    setRuleCategoryIds((prev) => {
      if (prev.includes(id)) {
        setCategoryDefaults((defaults) => {
          const next = { ...defaults };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      const cat = recommendationCategories.find((c) => c.id === id);
      const firstItem = cat?.items[0];
      if (firstItem) {
        setCategoryDefaults((defaults) => ({
          ...defaults,
          [id]: firstItem.id,
        }));
      }
      return [...prev, id];
    });
  };

  const setCategoryDefault = (categoryId: string, menuItemId: string) => {
    setCategoryDefaults((prev) => ({ ...prev, [categoryId]: menuItemId }));
  };

  const initVariationLimits = () => {
    setVariationLimits(
      baseVariations.map((v) => ({
        variationId: v.id,
        minItems: 1,
        maxItems: 3,
      }))
    );
  };

  const currentDraft = useMemo(
    (): RecommendationRuleDraft => ({
      sourceType,
      selectionType,
      multipleMode,
      required,
      ruleCategoryIds,
      categoryDefaults,
      productCategoryIds,
      linkedProductId,
      linkedProductIds,
      minItems,
      maxItems,
      freeQuantity,
      variationLimits,
      useVariationPricing,
    }),
    [
      sourceType,
      selectionType,
      multipleMode,
      required,
      ruleCategoryIds,
      categoryDefaults,
      productCategoryIds,
      linkedProductId,
      linkedProductIds,
      minItems,
      maxItems,
      freeQuantity,
      variationLimits,
      useVariationPricing,
    ]
  );

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const lastDraftKeyRef = useRef('');

  useEffect(() => {
    const draftKey = JSON.stringify(currentDraft);
    if (draftKey === lastDraftKeyRef.current) return;
    lastDraftKeyRef.current = draftKey;
    onDraftChangeRef.current?.(currentDraft);
  }, [currentDraft]);

  const toggleLinkedProduct = (id: string) => {
    setLinkedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
          {multipleMode === 'QUANTITY' ? (
            <div className="grid gap-2">
              <Label htmlFor="free-qty">Free quantity</Label>
              <Input
                id="free-qty"
                type="number"
                min={0}
                className="h-10"
                value={freeQuantity}
                onChange={(e) =>
                  setFreeQuantity(
                    Math.max(0, Number.parseInt(e.target.value, 10) || 0)
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                First N units are free; extra units are charged (e.g. 1 free
                topping, then paid).
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Required before add to cart</span>
      </label>

      {sourceType === 'CATEGORY' ? (
        assignableCategories.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Add products to a category first, or link categories you have not
              used yet for this product.
            </p>
            <Button type="button" asChild size="sm" variant="secondary" className="w-fit">
              <Link href="/categories">Go to Categories</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              For each category, choose the included default item. Guests only
              see an extra charge (+€) for options priced above that default.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {assignableCategories.map((cat) => {
                const checked = ruleCategoryIds.includes(cat.id);
                const onMenu = isMenuCategoryShownInFront(cat);
                const defaultId = categoryDefaults[cat.id];
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
                    {checked && cat.items.length > 0 ? (
                      <div className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-border pt-3">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Default item
                        </p>
                        {cat.items.map((it) => (
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
                              €
                              {(it.salePrice != null &&
                              it.salePrice > 0 &&
                              it.salePrice < it.price
                                ? it.salePrice
                                : it.price
                              ).toFixed(2)}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : checked ? (
                      <p className="mt-2 text-xs text-destructive">
                        Add products to this category first.
                      </p>
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

      {selectionType === 'MULTIPLE' && !useVariationLimits ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="rec-min">Min items</Label>
            <Input
              id="rec-min"
              type="number"
              min={0}
              className="h-10"
              value={minItems}
              onChange={(e) =>
                setMinItems(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rec-max">Max items</Label>
            <Input
              id="rec-max"
              type="number"
              min={1}
              className="h-10"
              value={maxItems}
              onChange={(e) =>
                setMaxItems(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
              }
            />
          </div>
        </div>
      ) : null}

      {useVariationLimits ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Min / max per variation</p>
            {variationLimits.length === 0 ? (
              <Button type="button" size="sm" variant="secondary" onClick={initVariationLimits}>
                Set limits
              </Button>
            ) : null}
          </div>
          {variationLimits.map((row, index) => {
            const v = baseVariations.find((x) => x.id === row.variationId);
            const label = v?.title?.trim() || v?.name?.trim() || 'Variation';
            return (
              <div
                key={row.variationId}
                className="grid gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[1fr_auto_auto]"
              >
                <span className="self-center text-sm font-medium">{label}</span>
                <Input
                  type="number"
                  min={0}
                  className="h-9"
                  value={row.minItems}
                  onChange={(e) => {
                    const val = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                    setVariationLimits((prev) =>
                      prev.map((r, i) =>
                        i === index ? { ...r, minItems: val } : r
                      )
                    );
                  }}
                />
                <Input
                  type="number"
                  min={1}
                  className="h-9"
                  value={row.maxItems}
                  onChange={(e) => {
                    const val = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                    setVariationLimits((prev) =>
                      prev.map((r, i) =>
                        i === index ? { ...r, maxItems: val } : r
                      )
                    );
                  }}
                />
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Example: Small → min 1 max 2 meats; Large → min 2 max 4 meats.
          </p>
        </div>
      ) : null}

      {baseVariations.length > 0 && sourceType === 'CATEGORY' ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={useVariationPricing}
            onChange={(e) => setUseVariationPricing(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">
              Price add-ons by product variation
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              When the guest picks Small, Medium, or Large on this product, each
              configuration item uses its matching variation rate when linked;
              otherwise the item&apos;s normal price is shown.
            </span>
          </span>
        </label>
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
            Save configuration
          </>
        )}
      </Button>
    </div>
  );
}
