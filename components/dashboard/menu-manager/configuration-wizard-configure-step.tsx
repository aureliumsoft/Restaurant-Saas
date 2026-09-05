'use client';

import { useMemo, Children } from 'react';
import { Loader2, Search } from 'lucide-react';

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
import { isMenuCategoryShownInFront } from '@/lib/menu/category-visibility';
import { menuItemCategoryIds } from '@/lib/menu/menu-item-category-ids';
import { variationLabel } from '@/lib/menu/recommendation-category-limits';
import type { DefaultVariationOption } from '@/lib/menu/recommendation-default-variation-options';
import {
  DEFAULT_FREE_QUANTITY,
  defaultCategorySettings,
  isCategoryKind,
  isManyKind,
  isProductKind,
  seedPerSizeLimits,
  type CategoryWizardSettings,
  type ProductWizardSettings,
  type WizardChoiceKind,
} from '@/lib/menu/configuration-wizard-draft';

import { LazyProductImage } from './lazy-product-image';
import type { MenuCategoryRow, MenuItemRow } from './types';

type ProductWithCategory = MenuItemRow & { categoryName: string };

function SwitchControl({
  on,
  onToggle,
  'aria-label': ariaLabel,
}: {
  on: boolean;
  onToggle: () => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={cn(
        'relative h-7 w-11 shrink-0 rounded-full transition',
        on ? 'bg-primary' : 'bg-muted-foreground/30'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-6 w-6 rounded-full bg-background shadow transition',
          on ? 'left-[18px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

function SelectableRow({
  active,
  title,
  subtitle,
  imageUrl,
  onClick,
  multi = false,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
        active ? 'bg-muted' : 'hover:bg-muted/50'
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center border',
          multi ? 'rounded-sm' : 'rounded-full',
          active
            ? 'border-foreground bg-foreground'
            : 'border-muted-foreground/40'
        )}
        aria-hidden
      >
        {active ? (
          <span className="h-1.5 w-1.5 rounded-[1px] bg-background" />
        ) : null}
      </span>
      <LazyProductImage
        src={imageUrl}
        hasImage={Boolean(imageUrl)}
        alt=""
        emptyLabel="—"
        className="h-10 w-10 shrink-0 rounded-md"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}

function SelectableList({
  children,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  emptyMessage,
}: {
  children: React.ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const hasSearch = typeof onSearchChange === 'function';
  const isEmpty = Children.count(children) === 0;

  return (
    <div className="rounded-xl border border-border bg-background">
      {hasSearch ? (
        <div className="relative border-b border-border">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 rounded-none border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
      ) : null}
      <div className="max-h-56 divide-y divide-border overflow-y-auto overscroll-contain">
        {isEmpty ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {emptyMessage ?? 'No matches.'}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function patchCategory(
  settings: Record<string, CategoryWizardSettings>,
  catId: string,
  patch: Partial<CategoryWizardSettings>
): Record<string, CategoryWizardSettings> {
  const current = settings[catId] ?? defaultCategorySettings();
  return { ...settings, [catId]: { ...current, ...patch } };
}

export type ConfigurationWizardConfigureStepProps = {
  kind: Exclude<WizardChoiceKind, 'prefs'>;
  isSaving: boolean;
  savingRules: boolean;
  onBack: () => void;
  onSave: () => void;
  canSave: boolean;
  filteredEligibleCategories: MenuCategoryRow[];
  categorySearch: string;
  setCategorySearch: (v: string) => void;
  selectedCategoryIds: string[];
  toggleCategoryId: (id: string) => void;
  categoryProducts: ProductWithCategory[];
  allProducts: ProductWithCategory[];
  filteredProductPickerCategories: MenuCategoryRow[];
  productFilterSearch: string;
  setProductFilterSearch: (v: string) => void;
  productCategoryIds: string[];
  toggleProductCategoryId: (id: string) => void;
  filteredLinkedProducts: ProductWithCategory[];
  productSearch: string;
  setProductSearch: (v: string) => void;
  linkedProductIds: string[];
  toggleLinkedProduct: (id: string) => void;
  multipleMode: 'CHECKBOX' | 'QUANTITY';
  setMultipleMode: (m: 'CHECKBOX' | 'QUANTITY') => void;
  required: boolean;
  setRequired: (v: boolean) => void;
  categorySettings: Record<string, CategoryWizardSettings>;
  setCategorySettings: (
    next:
      | Record<string, CategoryWizardSettings>
      | ((
          prev: Record<string, CategoryWizardSettings>
        ) => Record<string, CategoryWizardSettings>)
  ) => void;
  productSettings: Record<string, ProductWizardSettings>;
  setProductSettings: (
    next:
      | Record<string, ProductWizardSettings>
      | ((
          prev: Record<string, ProductWizardSettings>
        ) => Record<string, ProductWizardSettings>)
  ) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  defaultVariationOptions: DefaultVariationOption[];
  baseVariations: Array<{
    id: string;
    name?: string | null;
    title?: string | null;
  }>;
};

export function ConfigurationWizardConfigureStep(
  props: ConfigurationWizardConfigureStepProps
) {
  const {
    kind,
    isSaving,
    savingRules,
    onBack,
    onSave,
    canSave,
    filteredEligibleCategories,
    categorySearch,
    setCategorySearch,
    selectedCategoryIds,
    toggleCategoryId,
    categoryProducts,
    allProducts,
    filteredProductPickerCategories,
    productFilterSearch,
    setProductFilterSearch,
    productCategoryIds,
    toggleProductCategoryId,
    filteredLinkedProducts,
    productSearch,
    setProductSearch,
    linkedProductIds,
    toggleLinkedProduct,
    multipleMode,
    setMultipleMode,
    required,
    setRequired,
    categorySettings,
    setCategorySettings,
    productSettings,
    setProductSettings,
    showAdvanced,
    setShowAdvanced,
    defaultVariationOptions,
    baseVariations,
  } = props;

  const title = useMemo(() => {
    switch (kind) {
      case 'cat-one':
        return 'Which category is the option from?';
      case 'cat-many':
        return 'Which categories are the extras from?';
      case 'prod-one':
        return 'Which product options can they pick (exactly one)?';
      case 'prod-many':
        return 'Which specific products can they add?';
    }
  }, [kind]);

  const hint = isCategoryKind(kind)
    ? 'You can select more than one category. Guests see every product in those categories.'
    : 'Filter by categories, then hand-pick menu items instead of a whole category.';

  const selectedCategories = useMemo(
    () =>
      selectedCategoryIds
        .map((id) =>
          filteredEligibleCategories.find((c) => c.id === id) ??
          ({ id, name: id } as MenuCategoryRow)
        )
        .filter(Boolean),
    [selectedCategoryIds, filteredEligibleCategories]
  );

  const productsByCategory = useMemo(() => {
    const map = new Map<string, ProductWithCategory[]>();
    for (const catId of selectedCategoryIds) {
      map.set(
        catId,
        allProducts.filter((p) => menuItemCategoryIds(p).includes(catId))
      );
    }
    return map;
  }, [allProducts, selectedCategoryIds]);

  const linkedNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of filteredLinkedProducts) map.set(p.id, p.name);
    return map;
  }, [filteredLinkedProducts]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>

      {isCategoryKind(kind) ? (
        filteredEligibleCategories.length === 0 && !categorySearch ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            No eligible categories left. Create a toppings/sauce category under
            Categories, add products to it, then come back.
          </p>
        ) : (
          <SelectableList
            search={categorySearch}
            onSearchChange={setCategorySearch}
            searchPlaceholder="Search categories…"
            emptyMessage="No categories match your search."
          >
            {filteredEligibleCategories.map((cat) => (
              <SelectableRow
                key={cat.id}
                multi={kind === 'cat-many'}
                active={selectedCategoryIds.includes(cat.id)}
                title={cat.name}
                imageUrl={cat.imageUrl}
                subtitle={
                  isMenuCategoryShownInFront(cat)
                    ? 'On customer menu'
                    : 'Add-on only (hidden from browse)'
                }
                onClick={() => toggleCategoryId(cat.id)}
              />
            ))}
          </SelectableList>
        )
      ) : null}

      {isCategoryKind(kind) &&
      selectedCategoryIds.length > 0 &&
      categoryProducts.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Guests will see these items
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {categoryProducts.slice(0, 12).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <LazyProductImage
                  src={p.imageUrl}
                  hasImage={Boolean(p.imageUrl)}
                  alt=""
                  emptyLabel="—"
                  className="h-9 w-9 shrink-0 rounded-md"
                />
                <span className="truncate text-sm text-foreground">{p.name}</span>
              </li>
            ))}
            {categoryProducts.length > 12 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                +{categoryProducts.length - 12} more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {isProductKind(kind) ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Filter by product categories
          </p>
          <SelectableList
            search={productFilterSearch}
            onSearchChange={setProductFilterSearch}
            searchPlaceholder="Search categories…"
            emptyMessage="No categories match."
          >
            {filteredProductPickerCategories.map((cat) => (
              <SelectableRow
                key={cat.id}
                multi
                active={productCategoryIds.includes(cat.id)}
                title={cat.name}
                imageUrl={cat.imageUrl}
                subtitle={
                  isMenuCategoryShownInFront(cat)
                    ? 'On customer menu'
                    : 'Add-on only'
                }
                onClick={() => toggleProductCategoryId(cat.id)}
              />
            ))}
          </SelectableList>

          {productCategoryIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Select at least one category to load products.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">
                Linked products
              </p>
              <SelectableList
                search={productSearch}
                onSearchChange={setProductSearch}
                searchPlaceholder="Search products…"
                emptyMessage="No products match (or already assigned)."
              >
                {filteredLinkedProducts.map((p) => (
                  <SelectableRow
                    key={p.id}
                    multi={kind === 'prod-many'}
                    active={linkedProductIds.includes(p.id)}
                    title={p.name}
                    subtitle={p.categoryName}
                    imageUrl={p.imageUrl}
                    onClick={() => toggleLinkedProduct(p.id)}
                  />
                ))}
              </SelectableList>
            </>
          )}
        </div>
      ) : null}

      {isManyKind(kind) ? (
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">How guests pick</p>
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                className={cn(
                  'px-3 py-2 text-sm',
                  multipleMode === 'CHECKBOX'
                    ? 'bg-foreground text-background'
                    : 'bg-background text-muted-foreground'
                )}
                onClick={() => setMultipleMode('CHECKBOX')}
              >
                Checkboxes (1 each)
              </button>
              <button
                type="button"
                className={cn(
                  'border-l border-border px-3 py-2 text-sm',
                  multipleMode === 'QUANTITY'
                    ? 'bg-foreground text-background'
                    : 'bg-background text-muted-foreground'
                )}
                onClick={() => setMultipleMode('QUANTITY')}
              >
                Plus / minus quantities
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Must choose before adding to cart?</span>
            <SwitchControl
              on={required}
              onToggle={() => setRequired(!required)}
              aria-label="Required"
            />
          </div>

          {kind === 'cat-many' && selectedCategoryIds.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Min / max per category
              </p>
              {selectedCategories.map((cat, index) => {
                const settings =
                  categorySettings[cat.id] ?? defaultCategorySettings();
                return (
                  <div
                    key={`minmax-${cat.id}`}
                    className="grid gap-2 rounded-xl border border-border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]"
                  >
                    <span className="self-center truncate text-sm font-medium">
                      {selectedCategoryIds.length > 1 ? `#${index + 1} ` : ''}
                      {cat.name}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      aria-label={`${cat.name} minimum`}
                      value={settings.minItems}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          Number.parseInt(e.target.value, 10) || 0
                        );
                        setCategorySettings((prev) =>
                          patchCategory(prev, cat.id, { minItems: val })
                        );
                      }}
                    />
                    <Input
                      type="number"
                      min={1}
                      aria-label={`${cat.name} maximum`}
                      value={settings.maxItems}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          Number.parseInt(e.target.value, 10) || 1
                        );
                        setCategorySettings((prev) =>
                          patchCategory(prev, cat.id, { maxItems: val })
                        );
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {kind === 'prod-many' && linkedProductIds.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Min / max per linked product
              </p>
              <ul className="space-y-2">
                {linkedProductIds.map((pid) => {
                  const settings = productSettings[pid] ?? {
                    minItems: 0,
                    maxItems: 3,
                    freeQuantity: undefined,
                  };
                  return (
                    <li
                      key={pid}
                      className="grid gap-2 rounded-xl border border-border px-3 py-2 sm:grid-cols-[1fr_5rem_5rem]"
                    >
                      <span className="self-center truncate text-sm font-medium">
                        {linkedNameById.get(pid) ?? 'Product'}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        aria-label="Min"
                        value={settings.minItems}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            Number.parseInt(e.target.value, 10) || 0
                          );
                          setProductSettings((prev) => ({
                            ...prev,
                            [pid]: { ...settings, minItems: val },
                          }));
                        }}
                      />
                      <Input
                        type="number"
                        min={1}
                        aria-label="Max"
                        value={settings.maxItems}
                        onChange={(e) => {
                          const val = Math.max(
                            1,
                            Number.parseInt(e.target.value, 10) || 1
                          );
                          setProductSettings((prev) => ({
                            ...prev,
                            [pid]: { ...settings, maxItems: val },
                          }));
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Guests must pick exactly one option before adding to cart.
        </p>
      )}

      <div className="rounded-xl border border-dashed border-border bg-muted/20">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span>More pricing &amp; limits</span>
          <span className="text-xs font-normal text-muted-foreground">
            {showAdvanced ? 'Hide' : 'Show'}
          </span>
        </button>

        {showAdvanced ? (
          <div className="space-y-4 border-t border-border px-3 py-3">
            <p className="text-xs text-muted-foreground">
              Same advanced options as the classic editor. Configure each
              selected category or product separately.
            </p>

            {isCategoryKind(kind) && selectedCategoryIds.length > 0
              ? selectedCategories.map((cat) => {
                  const settings =
                    categorySettings[cat.id] ?? defaultCategorySettings();
                  const catItems = productsByCategory.get(cat.id) ?? [];
                  const noFree = settings.freeQuantity === null;
                  return (
                    <div
                      key={`adv-${cat.id}`}
                      className="space-y-3 rounded-xl border border-border bg-background p-3"
                    >
                      <p className="text-sm font-semibold">{cat.name}</p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Category discount (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="No discount"
                            value={
                              settings.discountPercent != null
                                ? String(settings.discountPercent)
                                : ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              setCategorySettings((prev) =>
                                patchCategory(prev, cat.id, {
                                  discountPercent:
                                    raw === ''
                                      ? null
                                      : Math.min(
                                          100,
                                          Math.max(
                                            0,
                                            Number.parseFloat(raw) || 0
                                          )
                                        ),
                                })
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Recommended size</Label>
                          <Select
                            value={
                              settings.recommendedVariationId || '__none__'
                            }
                            onValueChange={(value) => {
                              setCategorySettings((prev) =>
                                patchCategory(prev, cat.id, {
                                  recommendedVariationId:
                                    value === '__none__' ? '' : value,
                                  useVariationPricing:
                                    value === '__none__'
                                      ? settings.useVariationPricing
                                      : false,
                                })
                              );
                            }}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {defaultVariationOptions.map((opt) => (
                                <SelectItem
                                  key={opt.restaurantVariationId}
                                  value={opt.restaurantVariationId}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {settings.recommendedVariationId ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm">
                            Show recommended size price
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              Off = that size looks free for guests
                            </span>
                          </span>
                          <SwitchControl
                            on={settings.includeRecommendedVariationPrice}
                            onToggle={() =>
                              setCategorySettings((prev) =>
                                patchCategory(prev, cat.id, {
                                  includeRecommendedVariationPrice:
                                    !settings.includeRecommendedVariationPrice,
                                })
                              )
                            }
                          />
                        </div>
                      ) : null}

                      <div className="space-y-1.5">
                        <Label>Default item (baseline price)</Label>
                        <Select
                          value={settings.defaultItemId || '__none__'}
                          onValueChange={(value) =>
                            setCategorySettings((prev) =>
                              patchCategory(prev, cat.id, {
                                defaultItemId:
                                  value === '__none__' ? '' : value,
                              })
                            )
                          }
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              None — charge full price for each pick
                            </SelectItem>
                            {catItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {baseVariations.length > 0 ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm">
                            Price add-ons by product size
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              Different add-on prices for each size
                            </span>
                          </span>
                          <SwitchControl
                            on={settings.useVariationPricing}
                            onToggle={() => {
                              if (settings.recommendedVariationId) return;
                              setCategorySettings((prev) =>
                                patchCategory(prev, cat.id, {
                                  useVariationPricing:
                                    !settings.useVariationPricing,
                                })
                              );
                            }}
                          />
                        </div>
                      ) : null}

                      {kind === 'cat-many' && multipleMode === 'QUANTITY' ? (
                        <div className="space-y-2 rounded-lg border border-border/60 p-2">
                          <Label>Free quantity</Label>
                          <p className="text-xs text-muted-foreground">
                            First N units free for this category; extra units
                            are charged.
                          </p>
                          {!noFree ? (
                            <Input
                              type="number"
                              min={1}
                              value={
                                settings.freeQuantity ?? DEFAULT_FREE_QUANTITY
                              }
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  Number.parseInt(e.target.value, 10) ||
                                    DEFAULT_FREE_QUANTITY
                                );
                                setCategorySettings((prev) =>
                                  patchCategory(prev, cat.id, {
                                    freeQuantity: val,
                                  })
                                );
                              }}
                            />
                          ) : null}
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={noFree}
                              onChange={(e) =>
                                setCategorySettings((prev) =>
                                  patchCategory(prev, cat.id, {
                                    freeQuantity: e.target.checked
                                      ? null
                                      : DEFAULT_FREE_QUANTITY,
                                  })
                                )
                              }
                            />
                            <span>No free items for this category</span>
                          </label>
                        </div>
                      ) : null}

                      {kind === 'cat-many' && baseVariations.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm">
                              Different min / max per product size
                            </span>
                            <SwitchControl
                              on={settings.usePerSizeLimits}
                              onToggle={() => {
                                const next = !settings.usePerSizeLimits;
                                setCategorySettings((prev) =>
                                  patchCategory(prev, cat.id, {
                                    usePerSizeLimits: next,
                                    perSizeLimits: next
                                      ? seedPerSizeLimits(
                                          baseVariations,
                                          settings.minItems,
                                          settings.maxItems
                                        )
                                      : [],
                                  })
                                );
                              }}
                            />
                          </div>
                          {settings.usePerSizeLimits ? (
                            <ul className="space-y-2">
                              {baseVariations.map((v) => {
                                const row = settings.perSizeLimits.find(
                                  (r) => r.variationId === v.id
                                ) ?? {
                                  variationId: v.id,
                                  minItems: settings.minItems,
                                  maxItems: settings.maxItems,
                                };
                                return (
                                  <li
                                    key={v.id}
                                    className="grid gap-2 rounded-lg border border-border px-2 py-2 sm:grid-cols-[6rem_1fr_1fr]"
                                  >
                                    <span className="self-center text-sm font-medium">
                                      {variationLabel(v)}
                                    </span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={row.minItems}
                                      onChange={(e) => {
                                        const val = Math.max(
                                          0,
                                          Number.parseInt(e.target.value, 10) ||
                                            0
                                        );
                                        setCategorySettings((prev) =>
                                          patchCategory(prev, cat.id, {
                                            perSizeLimits: baseVariations.map(
                                              (bv) => {
                                                const existing =
                                                  settings.perSizeLimits.find(
                                                    (r) =>
                                                      r.variationId === bv.id
                                                  );
                                                if (bv.id === v.id) {
                                                  return {
                                                    variationId: bv.id,
                                                    minItems: val,
                                                    maxItems:
                                                      existing?.maxItems ??
                                                      settings.maxItems,
                                                  };
                                                }
                                                return (
                                                  existing ?? {
                                                    variationId: bv.id,
                                                    minItems: settings.minItems,
                                                    maxItems: settings.maxItems,
                                                  }
                                                );
                                              }
                                            ),
                                          })
                                        );
                                      }}
                                    />
                                    <Input
                                      type="number"
                                      min={1}
                                      value={row.maxItems}
                                      onChange={(e) => {
                                        const val = Math.max(
                                          1,
                                          Number.parseInt(e.target.value, 10) ||
                                            1
                                        );
                                        setCategorySettings((prev) =>
                                          patchCategory(prev, cat.id, {
                                            perSizeLimits: baseVariations.map(
                                              (bv) => {
                                                const existing =
                                                  settings.perSizeLimits.find(
                                                    (r) =>
                                                      r.variationId === bv.id
                                                  );
                                                if (bv.id === v.id) {
                                                  return {
                                                    variationId: bv.id,
                                                    minItems:
                                                      existing?.minItems ??
                                                      settings.minItems,
                                                    maxItems: val,
                                                  };
                                                }
                                                return (
                                                  existing ?? {
                                                    variationId: bv.id,
                                                    minItems: settings.minItems,
                                                    maxItems: settings.maxItems,
                                                  }
                                                );
                                              }
                                            ),
                                          })
                                        );
                                      }}
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : null}

            {kind === 'prod-many' &&
            multipleMode === 'QUANTITY' &&
            linkedProductIds.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Free quantity per linked product
                </p>
                {linkedProductIds.map((pid) => {
                  const settings = productSettings[pid] ?? {
                    minItems: 0,
                    maxItems: 3,
                    freeQuantity: undefined,
                  };
                  const noFree = settings.freeQuantity === null;
                  return (
                    <div
                      key={`free-${pid}`}
                      className="space-y-2 rounded-xl border border-border bg-background p-3"
                    >
                      <p className="text-sm font-medium">
                        {linkedNameById.get(pid) ?? 'Product'}
                      </p>
                      {!noFree ? (
                        <Input
                          type="number"
                          min={1}
                          value={
                            settings.freeQuantity ?? DEFAULT_FREE_QUANTITY
                          }
                          onChange={(e) => {
                            const val = Math.max(
                              1,
                              Number.parseInt(e.target.value, 10) ||
                                DEFAULT_FREE_QUANTITY
                            );
                            setProductSettings((prev) => ({
                              ...prev,
                              [pid]: { ...settings, freeQuantity: val },
                            }));
                          }}
                        />
                      ) : null}
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={noFree}
                          onChange={(e) =>
                            setProductSettings((prev) => ({
                              ...prev,
                              [pid]: {
                                ...settings,
                                freeQuantity: e.target.checked
                                  ? null
                                  : DEFAULT_FREE_QUANTITY,
                              },
                            }))
                          }
                        />
                        <span>No free items for this product</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {isCategoryKind(kind) && selectedCategoryIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select a category above to configure pricing options.
              </p>
            ) : null}

            {kind === 'prod-many' &&
            !(multipleMode === 'QUANTITY' && linkedProductIds.length > 0) ? (
              <p className="text-sm text-muted-foreground">
                Switch to plus/minus quantities and select products to set free
                quantity. Min/max are above.
              </p>
            ) : null}

            {kind === 'prod-one' ? (
              <p className="text-sm text-muted-foreground">
                Product · single has no extra pricing fields in classic either —
                guests pick exactly one linked product.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={!canSave || isSaving} onClick={onSave}>
          {savingRules ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save this choice'
          )}
        </Button>
      </div>
    </div>
  );
}
