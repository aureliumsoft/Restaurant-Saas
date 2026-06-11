'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  configurationAddonPriceLabel,
  configurationDefaultListUnitPrice,
  configurationGroupDisplayTitle,
  configurationItemListUnitPrice,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import { effectiveMenuItemUnitPrice } from '@/lib/menu/recommendation-addon-price';
import {
  isPreviewGroupVisibleForParentVariation,
  linkedItemsForPreviewGroup,
  visibleItemsForPreviewGroup,
  type PreviewAttrGroup,
} from '@/lib/menu/recommendation-preview-groups';

import { PersonalizeOptionsSection } from '@/components/order/personalize-options-section';

import type { MenuCategoryRow, MenuItemRow } from './types';

function effectiveUnitPrice(price: number, salePrice: number | null) {
  return effectiveMenuItemUnitPrice(price, salePrice);
}

function previewDefaultListUnit(
  group: PreviewAttrGroup,
  visibleItems: MenuItemRow[],
  parentVariation: ParentVariationContext | null
): number | null {
  return configurationDefaultListUnitPrice(
    {
      defaultMenuItemId:
        group.defaultLinkedMenuItemId ?? group.defaultLinkedMenuItem?.id,
      defaultUnitPrice:
        group.defaultLinkedMenuItem && !(group.useVariationPricing ?? false)
          ? effectiveMenuItemUnitPrice(
              group.defaultLinkedMenuItem.price,
              group.defaultLinkedMenuItem.salePrice
            )
          : null,
      useVariationPricing: group.useVariationPricing,
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
  previewGroups: PreviewAttrGroup[];
  previewByGroup: Record<string, string[]>;
  onPreviewChange: (groupId: string, ids: string[]) => void;
  offeredItems: OfferPreviewItem[];
  onDeleteGroup?: (groupId: string, isDraft: boolean) => void;
  deletingRuleId?: string | null;
  deletingRule?: boolean;
  savingAll?: boolean;
  loadingPersonalize?: boolean;
  saveAllDisabled?: boolean;
  onSaveAll?: () => void;
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
  previewGroups,
  previewByGroup,
  onPreviewChange,
  offeredItems,
  onDeleteGroup,
  deletingRuleId,
  deletingRule,
  savingAll,
  loadingPersonalize = false,
  saveAllDisabled,
  onSaveAll,
  personalizePreviewGroups = [],
  previewPersonalizeByGroup = {},
  onPersonalizePreviewChange,
}: Props) {
  const [previewVariationId, setPreviewVariationId] = useState('');

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
      shortLabel: variation.title ?? variation.name ?? null,
    };
  }, [previewVariationId, selected?.variations]);

  const visiblePreviewGroups = useMemo(() => {
    if (!selected) return [];
    return previewGroups.filter((group) => {
      const items = linkedItemsForPreviewGroup(
        group,
        selected,
        localCategories
      );
      return isPreviewGroupVisibleForParentVariation(
        group,
        items,
        previewVariationContext.parent
      );
    });
  }, [previewGroups, selected, localCategories, previewVariationContext.parent]);

  const hasVariationPricingGroups = useMemo(
    () => previewGroups.some((g) => g.useVariationPricing),
    [previewGroups]
  );

  if (!selected) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/80 p-6 text-center sm:min-h-[280px] sm:p-8">
        <p className="text-sm font-medium text-foreground">Customer preview</p>
        <p className="max-w-[min(100%,260px)] text-xs leading-relaxed text-muted-foreground">
          Choose a product in the strip above to see how guests view it when
          ordering online. Changes update here instantly as you configure.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-card shadow-sm">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Customer preview
        </p>
        <Badge variant="secondary" className="text-[10px] font-medium">
          Live
        </Badge>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm">
        {selected.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.imageUrl}
            alt={selected.name}
            className="aspect-[4/3] w-full object-cover sm:aspect-video lg:h-56 lg:max-h-[40vh]"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground sm:aspect-video lg:h-56">
            No photo
          </div>
        )}
        <div className="space-y-3 border-t border-border p-4">
          <div>
            <h3 className="text-xl font-bold uppercase leading-tight tracking-wide text-primary md:text-2xl">
              {selected.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.categoryName}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-lg font-bold tabular-nums text-primary">
              €
              {effectiveUnitPrice(selected.price, selected.salePrice).toFixed(2)}
            </p>
            {selected.description?.trim() ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {selected.description}
              </p>
            ) : null}
          </div>
          {(selected.variations?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Product variation
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.variations!.map((variation) => {
                  const active = previewVariationId === variation.id;
                  const label =
                    variation.title?.trim() ||
                    variation.name?.trim() ||
                    'Variation';
                  return (
                    <button
                      key={variation.id}
                      type="button"
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:border-primary/40'
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
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground">
          Configuration groups
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Includes saved rules and unsaved selections. Preview only — not sent
          to a cart.
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
              parentVariation={previewVariationContext.parent}
              variationShortLabel={previewVariationContext.shortLabel}
              previewIds={previewByGroup[g.id] ?? []}
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

      {offeredItems.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground">
            Associated products
          </h4>
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
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.name}
                </span>
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

      {onSaveAll ? (
        <div className="shrink-0 border-t border-border bg-card p-3 sm:p-4">
          <Button
            type="button"
            className="w-full"
            disabled={saveAllDisabled}
            onClick={onSaveAll}
          >
            {savingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving all…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save all configuration
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PreviewGroupCard({
  group,
  baseProduct,
  categories,
  parentVariation,
  variationShortLabel,
  previewIds,
  onPreviewChange,
  onDelete,
  deleting,
}: {
  group: PreviewAttrGroup;
  baseProduct: MenuItemRow;
  categories: MenuCategoryRow[];
  parentVariation: ParentVariationContext | null;
  variationShortLabel: string | null;
  previewIds: string[];
  onPreviewChange: (ids: string[]) => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const allItems = linkedItemsForPreviewGroup(group, baseProduct, categories);
  const items = visibleItemsForPreviewGroup(
    group,
    allItems,
    parentVariation
  );
  const useVariationPricing = group.useVariationPricing ?? false;
  const defaultUnit = previewDefaultListUnit(group, items, parentVariation);
  const groupTitle = configurationGroupDisplayTitle(
    group.name,
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
              ? `Product · ${group.linkedProduct?.name ?? '—'}`
              : `Category · ${group.linkedCategory?.name ?? '—'}`}
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
        ) : group.selectionType === 'SINGLE' ? (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {items.map((it) => {
              const checked = previewIds[0] === it.id;
              const listUnit = configurationItemListUnitPrice(
                it,
                parentVariation,
                useVariationPricing
              );
              const priceLabel = configurationAddonPriceLabel(
                listUnit,
                defaultUnit,
                {
                  freeQuantity: group.freeQuantity,
                  multipleMode: group.multipleMode,
                  groupSelectedIds: previewIds,
                }
              );
              return (
                <label
                  key={it.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition',
                    checked
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-card hover:bg-muted/50'
                  )}
                >
                  <OptionThumb imageUrl={it.imageUrl} name={it.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    {priceLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {priceLabel}
                      </p>
                    ) : null}
                  </div>
                  <input
                    type="radio"
                    name={`preview-${group.id}`}
                    className="h-4 w-4 shrink-0 accent-primary"
                    checked={checked}
                    onChange={() => onPreviewChange([it.id])}
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {items.map((it) => {
              const checked = previewIds.includes(it.id);
              const listUnit = configurationItemListUnitPrice(
                it,
                parentVariation,
                useVariationPricing
              );
              const priceLabel = configurationAddonPriceLabel(
                listUnit,
                defaultUnit,
                {
                  freeQuantity: group.freeQuantity,
                  multipleMode: group.multipleMode,
                  groupSelectedIds: previewIds,
                }
              );
              const atMax =
                group.maxItems != null &&
                previewIds.length >= group.maxItems &&
                !checked;
              return (
                <label
                  key={it.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition',
                    checked
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-card hover:bg-muted/50',
                    atMax && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <OptionThumb imageUrl={it.imageUrl} name={it.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    {priceLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {priceLabel}
                      </p>
                    ) : null}
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-primary"
                    checked={checked}
                    disabled={atMax}
                    onChange={() => {
                      if (checked) {
                        onPreviewChange(
                          previewIds.filter((id) => id !== it.id)
                        );
                      } else if (
                        group.maxItems == null ||
                        previewIds.length < group.maxItems
                      ) {
                        onPreviewChange([...previewIds, it.id]);
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
        )}
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
