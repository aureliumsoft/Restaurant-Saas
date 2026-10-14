'use client';

import { useMemo, Children } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { useUiLanguage } from '@/hooks/use-ui-language';
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

import { SelectableRow, SelectableList } from './selectable-list';


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
  const { t } = useTranslation();
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

  const uiLang = useUiLanguage();
  const wc = 'dashboard.menuManager.wizardConfig';

  const title = useMemo(() => {
    switch (kind) {
      case 'cat-one':
        return t(`${wc}.titleCatOne`);
      case 'cat-many':
        return t(`${wc}.titleCatMany`);
      case 'prod-one':
        return t(`${wc}.titleProdOne`);
      case 'prod-many':
        return t(`${wc}.titleProdMany`);
    }
  }, [kind, t]);

  const hint = isCategoryKind(kind) ? t(`${wc}.hintCategory`) : t(`${wc}.hintProduct`);

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
      const list = allProducts.filter((p) =>
        menuItemCategoryIds(p).includes(catId)
      );
      const sorted = [...list].sort((a, b) => {
        const orderA =
          a.sortOrderByCategory?.[catId] ?? Number.MAX_SAFE_INTEGER;
        const orderB =
          b.sortOrderByCategory?.[catId] ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        const createA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createA !== createB) return createA - createB;
        return a.name.localeCompare(b.name);
      });
      map.set(catId, sorted);
    }
    return map;
  }, [allProducts, selectedCategoryIds]);

  const updateProductOverride = (
    categoryId: string,
    productId: string,
    patch: Partial<{ excluded: boolean; free: boolean }>
  ) => {
    setCategorySettings((current) => {
      const category = current[categoryId] ?? defaultCategorySettings();
      const existing = category.productOverrides[productId] ?? {
        excluded: false,
        free: false,
      };
      return patchCategory(current, categoryId, {
        productOverrides: {
          ...category.productOverrides,
          [productId]: { ...existing, ...patch },
        },
      });
    });
  };

  const linkedNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of filteredLinkedProducts) {
      map.set(p.id, resolveBilingualText(p.name, uiLang));
    }
    return map;
  }, [filteredLinkedProducts, uiLang]);

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
            {t(`${wc}.noEligibleCategories`)}
          </p>
        ) : (
          <SelectableList
            search={categorySearch}
            onSearchChange={setCategorySearch}
            searchPlaceholder={t(`${wc}.searchCategoriesPlaceholder`)}
            emptyMessage={t(`${wc}.noCategoriesMatch`)}
          >
            {filteredEligibleCategories.map((cat) => (
              <SelectableRow
                key={cat.id}
                multi={kind === 'cat-many'}
                active={selectedCategoryIds.includes(cat.id)}
                title={resolveBilingualText(cat.name, uiLang)}
                imageUrl={cat.imageUrl}
                subtitle={
                  isMenuCategoryShownInFront(cat)
                    ? t(`${wc}.onCustomerMenu`)
                    : t(`${wc}.addonOnlyHidden`)
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
            {t(`${wc}.categoryProductsOverridesLabel`)}
          </p>
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border p-2 overscroll-contain">
            {selectedCategoryIds.map((categoryId) => {
              const category = selectedCategories.find((item) => item.id === categoryId);
              const products = productsByCategory.get(categoryId) ?? [];
              if (products.length === 0) return null;
              return (
                <section key={categoryId} className="rounded-lg border border-border/70">
                  <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium">
                    {category
                      ? resolveBilingualText(category.name, uiLang)
                      : t(`${wc}.categoryFallback`)}
                  </div>
                  <ul className="divide-y divide-border">
                    {products.map((product) => {
                      const override =
                        categorySettings[categoryId]?.productOverrides[product.id] ?? {
                          excluded: false,
                          free: false,
                        };
                      return (
                        <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                          <LazyProductImage
                            src={product.imageUrl}
                            hasImage={Boolean(product.imageUrl)}
                            alt=""
                            emptyLabel="—"
                            className="h-9 w-9 shrink-0 rounded-md"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {resolveBilingualText(product.name, uiLang)}
                          </span>
                          <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={override.free}
                              disabled={override.excluded}
                              onChange={(event) =>
                                updateProductOverride(categoryId, product.id, {
                                  free: event.target.checked,
                                })
                              }
                            />
                            {t(`${wc}.free`)}
                          </label>
                          <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={override.excluded}
                              onChange={(event) =>
                                updateProductOverride(categoryId, product.id, {
                                  excluded: event.target.checked,
                                  ...(event.target.checked ? { free: false } : {}),
                                })
                              }
                            />
                            {t(`${wc}.remove`)}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {isProductKind(kind) ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t(`${wc}.filterByProductCategories`)}
          </p>
          <SelectableList
            search={productFilterSearch}
            onSearchChange={setProductFilterSearch}
            searchPlaceholder={t(`${wc}.searchCategoriesPlaceholder`)}
            emptyMessage={t(`${wc}.noCategoriesMatchDot`)}
          >
            {filteredProductPickerCategories.map((cat) => (
              <SelectableRow
                key={cat.id}
                multi
                active={productCategoryIds.includes(cat.id)}
                title={resolveBilingualText(cat.name, uiLang)}
                imageUrl={cat.imageUrl}
                subtitle={
                  isMenuCategoryShownInFront(cat)
                    ? t(`${wc}.onCustomerMenu`)
                    : t(`${wc}.addonOnly`)
                }
                onClick={() => toggleProductCategoryId(cat.id)}
              />
            ))}
          </SelectableList>

          {productCategoryIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(`${wc}.selectAtLeastOneCategory`)}
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">
                {t(`${wc}.linkedProducts`)}
              </p>
              <SelectableList
                search={productSearch}
                onSearchChange={setProductSearch}
                searchPlaceholder={t(`${wc}.searchProductsPlaceholder`)}
                emptyMessage={t(`${wc}.noProductsMatch`)}
              >
                {filteredLinkedProducts.map((p) => (
                  <SelectableRow
                    key={p.id}
                    multi={kind === 'prod-many'}
                    active={linkedProductIds.includes(p.id)}
                    title={resolveBilingualText(p.name, uiLang)}
                    subtitle={resolveBilingualText(p.categoryName, uiLang)}
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
            <p className="mb-2 text-xs text-muted-foreground">{t(`${wc}.howGuestsPick`)}</p>
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
                {t(`${wc}.checkboxesOption`)}
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
                {t(`${wc}.quantityOption`)}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{t(`${wc}.mustChooseBeforeCart`)}</span>
            <SwitchControl
              on={required}
              onToggle={() => setRequired(!required)}
              aria-label={t(`${wc}.requiredAria`)}
            />
          </div>

          {kind === 'cat-many' && selectedCategoryIds.length > 0 ? (
            baseVariations.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {t(`${wc}.minMaxPerVariation`)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t(`${wc}.minMaxPerVariationHint`)}
                  </p>
                </div>
                {selectedCategories.map((cat) => {
                  const settings = categorySettings[cat.id] ?? defaultCategorySettings();
                  const catDisplayName = resolveBilingualText(cat.name, uiLang);
                  const limits = baseVariations.map((v) => {
                    return (
                      settings.perSizeLimits.find((r) => r.variationId === v.id) ?? {
                        variationId: v.id,
                        minItems: settings.minItems,
                        maxItems: settings.maxItems,
                      }
                    );
                  });

                  return (
                    <div key={`var-limits-${cat.id}`} className="space-y-2 rounded-xl border border-border p-3">
                      <p className="text-sm font-semibold text-foreground">{catDisplayName}</p>
                      <div className="space-y-2">
                        {limits.map((row) => {
                          const v = baseVariations.find((x) => x.id === row.variationId);
                          const label = v ? variationLabel(v) : t(`${wc}.variationFallback`);
                          return (
                            <div
                              key={`${cat.id}-${row.variationId}`}
                              className="grid gap-2 rounded-lg border border-border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]"
                            >
                              <span className="self-center text-sm font-medium text-foreground">
                                {label}
                              </span>
                              <Input
                                type="number"
                                min={0}
                                className="h-9"
                                aria-label={`${catDisplayName} ${label} ${t(`${wc}.minAria`)}`}
                                value={row.minItems}
                                onChange={(e) => {
                                  const val = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                                  const updatedLimits = limits.map((r) =>
                                    r.variationId === row.variationId ? { ...r, minItems: val } : r
                                  );
                                  setCategorySettings((prev) =>
                                    patchCategory(prev, cat.id, {
                                      usePerSizeLimits: true,
                                      perSizeLimits: updatedLimits,
                                    })
                                  );
                                }}
                              />
                              <Input
                                type="number"
                                min={1}
                                className="h-9"
                                aria-label={`${catDisplayName} ${label} ${t(`${wc}.maxAria`)}`}
                                value={row.maxItems}
                                onChange={(e) => {
                                  const val = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                                  const updatedLimits = limits.map((r) =>
                                    r.variationId === row.variationId ? { ...r, maxItems: val } : r
                                  );
                                  setCategorySettings((prev) =>
                                    patchCategory(prev, cat.id, {
                                      usePerSizeLimits: true,
                                      perSizeLimits: updatedLimits,
                                    })
                                  );
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t(`${wc}.minMaxPerCategory`)}
                </p>
                {selectedCategories.map((cat, index) => {
                  const settings =
                    categorySettings[cat.id] ?? defaultCategorySettings();
                  const catDisplayName = resolveBilingualText(cat.name, uiLang);
                  return (
                    <div
                      key={`minmax-${cat.id}`}
                      className="grid gap-2 rounded-xl border border-border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem]"
                    >
                      <span className="self-center truncate text-sm font-medium">
                        {selectedCategoryIds.length > 1 ? `#${index + 1} ` : ''}
                        {catDisplayName}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        aria-label={`${catDisplayName} ${t(`${wc}.minAria`)}`}
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
                        aria-label={`${catDisplayName} ${t(`${wc}.maxAria`)}`}
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
            )
          ) : null}

          {kind === 'prod-many' && linkedProductIds.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t(`${wc}.minMaxPerLinkedProduct`)}
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
                        {linkedNameById.get(pid) ?? t(`${wc}.productFallback`)}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        aria-label={t(`${wc}.minAria`)}
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
                        aria-label={t(`${wc}.maxAria`)}
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
          {t(`${wc}.mustPickExactlyOne`)}
        </p>
      )}

      <div className="rounded-xl border border-dashed border-border bg-muted/20">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span>{t(`${wc}.morePricingLimits`)}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {showAdvanced ? t(`${wc}.hide`) : t(`${wc}.show`)}
          </span>
        </button>

        {showAdvanced ? (
          <div className="space-y-4 border-t border-border px-3 py-3">
            <p className="text-xs text-muted-foreground">
              {t(`${wc}.advancedSameOptionsHint`)}
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
                      <p className="text-sm font-semibold">
                        {resolveBilingualText(cat.name, uiLang)}
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>{t(`${wc}.categoryDiscountLabel`)}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            placeholder={t(`${wc}.noDiscountPlaceholder`)}
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
                          <Label>{t(`${wc}.categoryExtraCostLabel`)}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={500}
                            placeholder={t(`${wc}.noExtraCostPlaceholder`)}
                            value={
                              settings.extraCostPercent != null
                                ? String(settings.extraCostPercent)
                                : ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              setCategorySettings((prev) =>
                                patchCategory(prev, cat.id, {
                                  extraCostPercent:
                                    raw === ''
                                      ? null
                                      : Math.min(
                                          500,
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
                      </div>

                      <div className="space-y-1.5">
                        <Label>{t(`${wc}.recommendedSize`)}</Label>
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
                              <SelectValue placeholder={t(`${wc}.none`)} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t(`${wc}.none`)}</SelectItem>
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

                      {settings.recommendedVariationId ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm">
                            {t(`${wc}.showRecommendedSizePrice`)}
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {t(`${wc}.showRecommendedSizePriceHint`)}
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
                        <Label>{t(`${wc}.defaultItemBaseline`)}</Label>
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
                            <SelectValue placeholder={t(`${wc}.none`)} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              {t(`${wc}.noneChargeFullPrice`)}
                            </SelectItem>
                            {catItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {resolveBilingualText(item.name, uiLang)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {baseVariations.length > 0 ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm">
                            {t(`${wc}.priceAddonsBySize`)}
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {t(`${wc}.priceAddonsBySizeHint`)}
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
                          <Label>{t(`${wc}.freeQuantity`)}</Label>
                          <p className="text-xs text-muted-foreground">
                            {t(`${wc}.freeQuantityHintCategory`)}
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
                            <span>{t(`${wc}.noFreeItemsCategory`)}</span>
                          </label>
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
                  {t(`${wc}.freeQuantityPerLinkedProduct`)}
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
                        {linkedNameById.get(pid) ?? t(`${wc}.productFallback`)}
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
                        <span>{t(`${wc}.noFreeItemsProduct`)}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {isCategoryKind(kind) && selectedCategoryIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(`${wc}.selectCategoryAboveHint`)}
              </p>
            ) : null}

            {kind === 'prod-many' &&
            !(multipleMode === 'QUANTITY' && linkedProductIds.length > 0) ? (
              <p className="text-sm text-muted-foreground">
                {t(`${wc}.switchToQuantityHint`)}
              </p>
            ) : null}

            {kind === 'prod-one' ? (
              <p className="text-sm text-muted-foreground">
                {t(`${wc}.productOneNoExtraFieldsHint`)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack}>
          {t(`${wc}.back`)}
        </Button>
        <Button type="button" disabled={!canSave || isSaving} onClick={onSave}>
          {savingRules ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t(`${wc}.savingEllipsis`)}
            </>
          ) : (
            t(`${wc}.saveThisChoice`)
          )}
        </Button>
      </div>
    </div>
  );
}
