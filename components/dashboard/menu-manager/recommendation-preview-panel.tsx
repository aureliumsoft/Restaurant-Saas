'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Minus, Plus, Sparkles, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  configurationAddonPriceLabel,
  configurationDefaultListUnitPrice,
  configurationGroupDisplayTitle,
  configurationItemListUnitPrice,
  configurationItemListUnitPriceForGroup,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import { effectiveMenuItemUnitPrice } from '@/lib/menu/recommendation-addon-price';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { useUiLanguage } from '@/hooks/use-ui-language';
import {
  isPreviewGroupVisibleForParentVariation,
  linkedItemsForPreviewGroup,
  visibleItemsForPreviewGroup,
  type PreviewAttrGroup,
} from '@/lib/menu/recommendation-preview-groups';

import { PersonalizeOptionsSection } from '@/components/order/personalize-options-section';
import { MenuOfferChoiceDialog } from '@/components/order/menu-offer-choice-dialog';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import type { RestaurantRegionalSettings } from '@/lib/restaurant-regional';

import type { MenuCategoryRow, MenuItemRow } from './types';

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        selected
          ? 'border-primary bg-primary'
          : 'border-muted-foreground/35 bg-background'
      )}
      aria-hidden
    >
      {selected ? (
        <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
      ) : null}
    </span>
  );
}

function CheckboxIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/35 bg-background'
      )}
      aria-hidden
    >
      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

function effectiveUnitPrice(price: number, salePrice: number | null) {
  return effectiveMenuItemUnitPrice(price, salePrice);
}

function previewDefaultListUnit(
  group: PreviewAttrGroup,
  visibleItems: MenuItemRow[],
  parentVariation: ParentVariationContext | null
): number | null {
  const defaultLinkedRestaurantVariationId =
    group.defaultLinkedRestaurantVariationId ?? null;
  const includeDefaultLinkedVariationPrice =
    group.includeDefaultLinkedVariationPrice ?? true;
  return configurationDefaultListUnitPrice(
    {
      defaultMenuItemId:
        group.defaultLinkedMenuItemId ?? group.defaultLinkedMenuItem?.id,
      defaultUnitPrice:
        group.defaultLinkedMenuItem && !(group.useVariationPricing ?? false)
          ? defaultLinkedRestaurantVariationId
            ? configurationItemListUnitPriceForGroup(
                {
                  price: group.defaultLinkedMenuItem.price,
                  salePrice: group.defaultLinkedMenuItem.salePrice,
                },
                {
                  defaultLinkedRestaurantVariationId,
                  includeDefaultLinkedVariationPrice,
                }
              )
            : effectiveMenuItemUnitPrice(
                group.defaultLinkedMenuItem.price,
                group.defaultLinkedMenuItem.salePrice
              )
          : null,
      useVariationPricing: group.useVariationPricing,
      defaultLinkedRestaurantVariationId,
      includeDefaultLinkedVariationPrice,
      items: visibleItems.map((item) => ({
        menuItemId: item.id,
        price: item.price,
        salePrice: item.salePrice,
        variations: item.variations,
      })),
    },
    parentVariation,
    visibleItems.map((item) => ({
      menuItemId: item.id,
      price: item.price,
      salePrice: item.salePrice,
      variations: item.variations,
    }))
  );
}

function multiSelectionHint(
  minItems: number | null,
  maxItems: number | null
): string {
  if (minItems != null && maxItems != null) {
    return `Choose ${minItems}–${maxItems} options`;
  }
  if (minItems != null) return `Choose at least ${minItems}`;
  if (maxItems != null) return `Choose up to ${maxItems}`;
  return 'Choose one or more options';
}

type OfferPreviewItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  isDraft?: boolean;
};

type Props = {
  selected: (MenuItemRow & { categoryName: string }) | null;
  localCategories: MenuCategoryRow[];
  allProducts?: Array<MenuItemRow & { categoryIds?: string[]; categoryName?: string }>;
  previewGroups: PreviewAttrGroup[];
  previewByGroup: Record<string, string[]>;
  onPreviewChange: (groupId: string, ids: string[]) => void;
  dealsItems?: OfferPreviewItem[];
  offeredItems?: OfferPreviewItem[];
  onDeleteGroup?: (groupId: string, isDraft: boolean) => void;
  deletingRuleId?: string | null;
  deletingRule?: boolean;
  loadingPersonalize?: boolean;
  loadingPreviewProducts?: boolean;
  personalizePreviewGroups?: Array<{
    id: string;
    parentName: string;
    maxItems: number;
    options: Array<{ id: string; name: string; imageUrl?: string | null }>;
  }>;
  previewPersonalizeByGroup?: Record<string, string[]>;
  onPersonalizePreviewChange?: (groupId: string, ids: string[]) => void;
};

export function RecommendationPreviewPanel({
  selected,
  localCategories,
  allProducts = [],
  previewGroups,
  previewByGroup,
  onPreviewChange,
  dealsItems = [],
  offeredItems = [],
  onDeleteGroup,
  deletingRuleId,
  deletingRule,
  loadingPersonalize = false,
  loadingPreviewProducts = false,
  personalizePreviewGroups = [],
  previewPersonalizeByGroup = {},
  onPersonalizePreviewChange,
}: Props) {
  const uiLang = useUiLanguage();
  const { formatMoney, regional } = useOwnerRestaurantRegional();
  const [previewVariationId, setPreviewVariationId] = useState('');
  const [dealChoiceOpen, setDealChoiceOpen] = useState(false);

  const bundleProducts = useMemo(() => {
    return dealsItems.map((item) => {
      const full = allProducts.find((p) => p.id === item.id);
      return {
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        price: full?.price ?? 0,
        salePrice: full?.salePrice ?? null,
        variations: full?.variations ?? [],
      };
    });
  }, [dealsItems, allProducts]);

  useEffect(() => {
    const first = selected?.variations?.[0]?.id ?? '';
    setPreviewVariationId(first);
  }, [selected?.id, selected?.variations]);

  const previewVariationContext = useMemo(() => {
    const variation = selected?.variations?.find(
      (v) => v.id === previewVariationId
    );
    if (!variation) {
      return {
        parent: null as ParentVariationContext | null,
        shortLabel: null as string | null,
      };
    }
    return {
      parent: {
        id: variation.id,
        name: variation.name ?? null,
        title: variation.title ?? variation.name ?? null,
        restaurantVariationId: variation.restaurantVariationId ?? null,
      },
      shortLabel: resolveBilingualText(
        variation.title ?? variation.name,
        uiLang
      ) || null,
    };
  }, [previewVariationId, selected?.variations, uiLang]);

  const visiblePreviewGroups = useMemo(() => {
    if (!selected) return [];
    return previewGroups.filter((group) => {
      const items = linkedItemsForPreviewGroup(
        group,
        selected,
        localCategories,
        allProducts
      );
      return isPreviewGroupVisibleForParentVariation(
        group,
        items,
        previewVariationContext.parent
      );
    });
  }, [previewGroups, selected, localCategories, allProducts, previewVariationContext.parent]);

  const hasVariationPricingGroups = useMemo(
    () => previewGroups.some((g) => g.useVariationPricing),
    [previewGroups]
  );

  const hasDefaultVariationGroups = useMemo(
    () =>
      previewGroups.some(
        (g) =>
          Boolean(g.defaultLinkedRestaurantVariationId) &&
          !(g.useVariationPricing ?? false)
      ),
    [previewGroups]
  );

  if (!selected) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-foreground">Customer preview</p>
        <p className="max-w-[240px] text-xs text-muted-foreground">
          Choose a product above to see how guests view it when ordering.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full max-h-full">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 bg-card shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Customer preview
        </p>
        <Badge variant="secondary" className="text-[10px] font-medium">
          Live
        </Badge>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">

      <div className="space-y-3">
        {selected.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.imageUrl}
            alt={resolveBilingualText(selected.name, uiLang)}
            className="aspect-[16/10] w-full rounded-lg object-cover"
          />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            No photo
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {resolveBilingualText(selected.name, uiLang)}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {resolveBilingualText(selected.categoryName, uiLang)}
          </p>
          <p className="mt-2 text-sm font-medium tabular-nums text-foreground">
            {formatMoney(
              effectiveUnitPrice(selected.price, selected.salePrice)
            )}
          </p>
          {selected.description?.trim() ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {selected.description}
            </p>
          ) : null}
        </div>
          {(selected.variations?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Size</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.variations!.map((variation) => {
                  const active = previewVariationId === variation.id;
                  const label =
                    resolveBilingualText(
                      variation.title || variation.name,
                      uiLang
                    ) || 'Variation';
                  return (
                    <button
                      key={variation.id}
                      type="button"
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-background text-foreground hover:bg-muted'
                      )}
                      onClick={() => setPreviewVariationId(variation.id)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {hasVariationPricingGroups && !previewVariationContext.parent ? (
                <p className="text-xs text-muted-foreground">
                  Select a variation to preview variation-priced add-ons.
                </p>
              ) : null}
            </div>
          ) : null}
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-foreground">
          What guests can choose
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Live customer preview — edits are saved on the left.
        </p>
      </div>

      {previewGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No configuration groups yet. Add categories or products in the
          sections on the left.
        </p>
      ) : visiblePreviewGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasVariationPricingGroups
            ? 'No add-on categories are available for this product variation.'
            : hasDefaultVariationGroups
              ? 'No add-ons match the configured default variation yet. Load products in those categories or check variation rates.'
              : loadingPreviewProducts
                ? 'Loading add-on products for preview…'
                : 'No configuration groups are available to preview yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {visiblePreviewGroups.map((g) => (
            <PreviewGroupCard
              key={g.id}
              group={g}
              baseProduct={selected}
              categories={localCategories}
              allProducts={allProducts}
              parentVariation={previewVariationContext.parent}
              variationShortLabel={previewVariationContext.shortLabel}
              previewIds={previewByGroup[g.id] ?? []}
              regional={regional}
              onPreviewChange={(ids) => onPreviewChange(g.id, ids)}
              onDelete={
                onDeleteGroup
                  ? () => onDeleteGroup(g.id, Boolean(g.isDraft))
                  : undefined
              }
              deleting={
                deletingRule && !g.isDraft && deletingRuleId === g.id
              }
            />
          ))}
        </div>
      )}

      {loadingPersonalize ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading personalize items…
        </div>
      ) : personalizePreviewGroups.length > 0 ? (
        <div className="space-y-3 border-t border-border pt-4">
          <PersonalizeOptionsSection
            groups={personalizePreviewGroups}
            selectedByGroup={previewPersonalizeByGroup}
            onToggle={(groupId, optionId) => {
              if (!onPersonalizePreviewChange) return;
              const group = personalizePreviewGroups.find(
                (g) => g.id === groupId
              );
              if (!group) return;
              const current = previewPersonalizeByGroup[groupId] ?? [];
              const next = current.includes(optionId)
                ? current.filter((id) => id !== optionId)
                : current.length >= group.maxItems
                  ? current
                  : [...current, optionId];
              onPersonalizePreviewChange(groupId, next);
            }}
          />
        </div>
      ) : null}

      {dealsItems.length > 0 ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-foreground">
                Recommended deals
              </h4>
              <p className="text-xs text-muted-foreground">
                Popup offered to guests selecting this product
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDealChoiceOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Test deal popup
            </Button>
          </div>
          <ul className="space-y-2">
            {dealsItems.map((item) => (
              <li
                key={item.id}
                role="button"
                tabIndex={0}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition hover:bg-muted/40',
                  item.isDraft
                    ? 'border-dashed border-primary/40 bg-primary/5'
                    : 'border-border bg-background'
                )}
                onClick={() => setDealChoiceOpen(true)}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
                    —
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {resolveBilingualText(item.name, uiLang)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Click to test "Select a deal" preview
                  </span>
                </div>
                {item.isDraft ? (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    Draft
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {offeredItems.length > 0 ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-foreground">
              Recommended products (Cart)
            </h4>
            <p className="text-xs text-muted-foreground">
              Add-ons shown on the cart drawer / checkout
            </p>
          </div>
          <ul className="space-y-2">
            {offeredItems.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                  item.isDraft
                    ? 'border-dashed border-primary/40 bg-primary/5'
                    : 'border-border bg-background'
                )}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
                    —
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {resolveBilingualText(item.name, uiLang)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Shown in customer cart upsell
                  </span>
                </div>
                {item.isDraft ? (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    Draft
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>

      <MenuOfferChoiceDialog
        open={dealChoiceOpen}
        onOpenChange={setDealChoiceOpen}
        product={
          selected
            ? {
                id: selected.id,
                name: selected.name,
                imageUrl: selected.imageUrl,
                price: selected.price,
                salePrice: selected.salePrice,
                variations: selected.variations ?? [],
              }
            : null
        }
        bundleProducts={bundleProducts}
        onChooseSingle={() => setDealChoiceOpen(false)}
        onChooseBundle={() => setDealChoiceOpen(false)}
      />
    </div>
  );
}

function PreviewGroupCard({
  group,
  baseProduct,
  categories,
  allProducts,
  parentVariation,
  variationShortLabel,
  previewIds,
  regional,
  onPreviewChange,
  onDelete,
  deleting,
}: {
  group: PreviewAttrGroup;
  baseProduct: MenuItemRow;
  categories: MenuCategoryRow[];
  allProducts: Array<MenuItemRow & { categoryIds?: string[]; categoryName?: string }>;
  parentVariation: ParentVariationContext | null;
  variationShortLabel: string | null;
  previewIds: string[];
  regional: RestaurantRegionalSettings;
  onPreviewChange: (ids: string[]) => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const uiLang = useUiLanguage();
  const allItems = linkedItemsForPreviewGroup(
    group,
    baseProduct,
    categories,
    allProducts
  );
  const items = visibleItemsForPreviewGroup(
    group,
    allItems,
    parentVariation
  );
  const useVariationPricing = group.useVariationPricing ?? false;
  const defaultLinkedRestaurantVariationId =
    group.defaultLinkedRestaurantVariationId ?? null;
  const includeDefaultLinkedVariationPrice =
    group.includeDefaultLinkedVariationPrice ?? true;
  const defaultUnit = previewDefaultListUnit(group, items, parentVariation);
  const defaultVariationLabel =
    defaultLinkedRestaurantVariationId && !useVariationPricing
      ? resolveBilingualText(
          group.defaultLinkedRestaurantVariation?.shortLabel?.trim() ||
            group.defaultLinkedRestaurantVariation?.name,
          uiLang
        ) || null
      : null;
  const resolvedGroupName = resolveBilingualText(group.name, uiLang);
  const groupTitle =
    defaultVariationLabel && !useVariationPricing
      ? `${resolvedGroupName} ${defaultVariationLabel}`
      : configurationGroupDisplayTitle(
          resolvedGroupName,
          parentVariation,
          useVariationPricing,
          variationShortLabel
        );

  return (
    <section
      className={cn(
        'rounded-lg border bg-background p-4 text-foreground shadow-sm',
        group.isDraft
          ? 'border-dashed border-primary/40'
          : 'border-border'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="tabular-nums text-[10px]">
              Step {(group.sortOrder ?? 0) + 1}
            </Badge>
            <Label className="text-sm font-semibold">{groupTitle}</Label>
            {group.isDraft ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                Draft
              </Badge>
            ) : null}
            {group.required ? (
              <Badge
                variant="outline"
                className="border-red-200 bg-red-50 text-[10px] font-semibold uppercase text-red-700"
              >
                Required
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px] uppercase">
              {group.selectionType === 'SINGLE' ? 'Single' : 'Multiple'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {group.sourceType === 'PRODUCT'
              ? `Product · ${resolveBilingualText(group.linkedProduct?.name, uiLang) || '—'}`
              : `Category · ${resolveBilingualText(group.linkedCategory?.name, uiLang) || '—'}`}
          </p>
        </div>
        {onDelete && !group.isDraft ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Remove rule"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No products available for this group yet.
          </p>
        ) : (() => {
          const radioMode = group.selectionType === 'SINGLE' || group.maxItems === 1;
          const quantityMode = group.selectionType === 'MULTIPLE' && group.multipleMode === 'QUANTITY';

          return (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {items.map((it) => {
                const checked = previewIds.includes(it.id);
                const radioChecked = previewIds[0] === it.id;
                const qty = previewIds.filter((id) => id === it.id).length;
                const totalUnits = previewIds.length;
                const atMax = group.maxItems != null && totalUnits >= group.maxItems;
                const displayName = resolveBilingualText(it.name, uiLang);

                const isFreeOverride = Boolean(
                  group.productOverrides?.[it.id]?.free
                );

                const listUnit = configurationItemListUnitPriceForGroup(it, {
                  parentVariation,
                  useVariationPricing,
                  defaultLinkedRestaurantVariationId,
                  includeDefaultLinkedVariationPrice,
                });
                const rawPriceLabel = configurationAddonPriceLabel(
                  listUnit,
                  defaultUnit,
                  {
                    freeQuantity: group.freeQuantity,
                    multipleMode: group.multipleMode,
                    groupSelectedIds: previewIds,
                    optionId: it.id,
                    regional,
                    categoryDiscountPercent: group.categoryDiscountPercent,
                    categoryExtraCostPercent: group.categoryExtraCostPercent,
                  }
                );
                const priceLabel = isFreeOverride ? 'Free' : rawPriceLabel;

                if (radioMode) {
                  return (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onPreviewChange([it.id])}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition select-none',
                        radioChecked
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:bg-muted/50'
                      )}
                    >
                      <OptionThumb imageUrl={it.imageUrl} name={displayName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold uppercase leading-snug">
                          {displayName}
                        </p>
                        {priceLabel ? (
                          <p className="text-xs text-muted-foreground font-medium">
                            {priceLabel}
                          </p>
                        ) : null}
                      </div>
                      <RadioIndicator selected={radioChecked} />
                    </div>
                  );
                }

                if (quantityMode) {
                  return (
                    <div
                      key={it.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition select-none',
                        qty > 0
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card'
                      )}
                    >
                      <OptionThumb imageUrl={it.imageUrl} name={displayName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold uppercase leading-snug">
                          {displayName}
                        </p>
                        {priceLabel ? (
                          <p className="text-xs text-muted-foreground font-medium">
                            {priceLabel}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {qty > 0 ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg border-primary/30"
                              aria-label={`Decrease ${displayName}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const idx = previewIds.lastIndexOf(it.id);
                                if (idx >= 0) {
                                  const next = [...previewIds];
                                  next.splice(idx, 1);
                                  onPreviewChange(next);
                                }
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums">
                              {qty}
                            </span>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          className="h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                          aria-label={`Add ${displayName}`}
                          disabled={qty === 0 && atMax}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!atMax) {
                              onPreviewChange([...previewIds, it.id]);
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (checked) {
                        onPreviewChange(
                          previewIds.filter((id) => id !== it.id)
                        );
                      } else if (!atMax) {
                        onPreviewChange([...previewIds, it.id]);
                      }
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition select-none',
                      checked
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-card hover:bg-muted/50',
                      atMax && !checked && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <OptionThumb imageUrl={it.imageUrl} name={displayName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold uppercase leading-snug">
                        {displayName}
                      </p>
                      {priceLabel ? (
                        <p className="text-xs text-muted-foreground font-medium">
                          {priceLabel}
                        </p>
                      ) : null}
                    </div>
                    <CheckboxIndicator selected={checked} />
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </section>
  );
}

function OptionThumb({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
