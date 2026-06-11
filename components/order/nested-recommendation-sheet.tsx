'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { Check, ChevronDown, Minus, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { buildModifierSelectionsForGroups } from '@/lib/menu/build-modifier-selections';
import {
  getRecommendationLimits,
  totalSelectedUnits,
} from '@/lib/menu/recommendation-limits';
import {
  effectiveOptionVariationId,
  emptyOptionNestedConfig,
  isOptionConfigComplete,
  optionNeedsManualVariationPicker,
  optionSelectionKey,
  recommendedProductNeedsSheet,
  recommendationOptionNeedsSheet,
  resolveCategoryItemVariationId,
  resolveProductRecommendationVariationId,
  syncParentVariationOptionSelections,
} from '@/lib/menu/recommendation-option-utils';
import {
  configurationAddonPriceLabel,
  configurationDefaultListUnitPriceForSelection,
  configurationGroupDisplayTitle,
  configurationItemResolvedListUnit,
  filterConfigurationItemsForParentVariation,
  isConfigurationGroupVisibleForParentVariation,
  isConfigurationItemAvailableForParentVariation,
  parentVariationFromItemVariation,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import {
  effectiveMenuItemUnitPrice,
  formatVariationAddonDisplay,
  productRecommendationVariationPriceLabel,
  productRecommendationVariationUnitPrice,
  productUnitPriceWithVariation,
  variationPickerBaselineUnitPrice,
} from '@/lib/menu/recommendation-addon-price';

import {
  PersonalizeOptionsSection,
  type PersonalizeGroup,
} from '@/components/order/personalize-options-section';
import { buildPersonalizeModifierSelections } from '@/lib/menu/personalize-modifiers';
import type {
  AttributeGroup,
  MenuOption,
} from '@/components/order/product-customize-dialog';

function effectiveUnitPrice(price: number, salePrice: number | null) {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
}

function isRadioGroup(
  group: AttributeGroup,
  limits: { minItems: number; maxItems: number }
) {
  return group.selectionType === 'SINGLE' || limits.maxItems === 1;
}

function isQuantityGroup(group: AttributeGroup) {
  return (
    group.selectionType === 'MULTIPLE' && group.multipleMode === 'QUANTITY'
  );
}

function OptionThumbnail({
  imageUrl,
  name,
}: {
  imageUrl?: string | null;
  name: string;
}) {
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground">
          {name.slice(0, 2)}
        </div>
      )}
    </div>
  );
}

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
        selected
          ? 'border-primary bg-primary'
          : 'border-muted-foreground/35 bg-background'
      }`}
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
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/35 bg-background'
      }`}
      aria-hidden
    >
      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

export type NestedRecommendationResult = {
  productVariationId: string;
  selectedByGroup: Record<string, string[]>;
  selectedNestedVariationByOption: Record<string, string>;
  mods: {
    attributeGroupId: string;
    groupName: string;
    selections: MenuOption[];
  }[];
};

type ProductItem = AttributeGroup['items'][number] & {
  personalizeGroups?: PersonalizeGroup[];
};

/** Depth-first ids of category sections currently visible in the sheet. */
function collectVisibleCategoryGroupIds(
  groups: AttributeGroup[],
  selectedByGroup: Record<string, string[]>,
  parentVariation: ParentVariationContext | null
): string[] {
  const ids: string[] = [];
  for (const g of groups) {
    if (g.sourceType === 'PRODUCT' && g.items.length === 1) {
      ids.push(
        ...collectVisibleCategoryGroupIds(
          g.items[0]!.nestedAttributeGroups ?? [],
          selectedByGroup,
          parentVariation
        )
      );
      continue;
    }
    if (g.sourceType === 'PRODUCT') continue;
    if (
      !isConfigurationGroupVisibleForParentVariation(g, parentVariation)
    ) {
      continue;
    }
    ids.push(g.id);
    const selectedIds =
      g.selectionType === 'SINGLE'
        ? (selectedByGroup[g.id] ?? []).slice(0, 1)
        : (selectedByGroup[g.id] ?? []);
    for (const optionId of selectedIds) {
      const option = g.items.find((it) => it.menuItemId === optionId);
      if (option?.nestedAttributeGroups?.length) {
        ids.push(
          ...collectVisibleCategoryGroupIds(
            option.nestedAttributeGroups,
            selectedByGroup,
            parentVariation
          )
        );
      }
    }
  }
  return ids;
}

type InlineGroupsProps = {
  groups: AttributeGroup[];
  rootGroups: AttributeGroup[];
  baseProductVariation: ParentVariationContext | null;
  baseProductVariationShortLabel: string | null;
  productVariationId: string;
  selectedByGroup: Record<string, string[]>;
  selectedNestedVariationByOption: Record<string, string>;
  optionNestedConfigs: Record<string, NestedRecommendationResult>;
  groupRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  allGroupsFlat: AttributeGroup[];
  onSelectedByGroupChange: Dispatch<SetStateAction<Record<string, string[]>>>;
  onNestedVariationChange: Dispatch<SetStateAction<Record<string, string>>>;
  onPatchOptionNestedConfig: (
    key: string,
    config: NestedRecommendationResult
  ) => void;
  onOpenOptionVariation: (
    parentOptionKey: string | undefined,
    groupId: string,
    optionId: string
  ) => void;
  scrollToGroup: (groupId: string) => void;
  scopeParentOptionKey?: string;
  onClearOptionNestedForGroup?: (groupId: string) => void;
  onClearOptionNested?: (key: string) => void;
  isNestedCollapsed?: (groupId: string) => boolean;
  onCollapseNestedForGroup?: (groupId: string) => void;
  onExpandNestedForGroup?: (groupId: string) => void;
  advanceAfterGroupComplete: (
    groupId: string,
    nextSelectedByGroup: Record<string, string[]>
  ) => void;
};

type OptionNestedPanelProps = {
  optionKey: string;
  item: ProductItem;
  variationId: string;
  baseProductVariation: ParentVariationContext | null;
  baseProductVariationShortLabel: string | null;
  config: NestedRecommendationResult;
  allGroupsFlat: AttributeGroup[];
  groupRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  onPatchOptionNestedConfig: (
    key: string,
    config: NestedRecommendationResult
  ) => void;
  onOpenOptionVariation: (
    parentOptionKey: string | undefined,
    groupId: string,
    optionId: string
  ) => void;
  scrollToGroup: (groupId: string) => void;
  onClearOptionNestedForGroup?: (groupId: string) => void;
  onClearOptionNested?: (key: string) => void;
  isNestedCollapsed?: (groupId: string) => boolean;
  onCollapseNestedForGroup?: (groupId: string) => void;
  onExpandNestedForGroup?: (groupId: string) => void;
  advanceAfterGroupComplete: (
    groupId: string,
    nextSelectedByGroup: Record<string, string[]>
  ) => void;
};

function OptionNestedPanel({
  optionKey,
  item,
  variationId,
  baseProductVariation,
  baseProductVariationShortLabel,
  config,
  allGroupsFlat,
  groupRefs,
  onPatchOptionNestedConfig,
  onOpenOptionVariation,
  scrollToGroup,
  onClearOptionNestedForGroup,
  onClearOptionNested,
  isNestedCollapsed,
  onCollapseNestedForGroup,
  onExpandNestedForGroup,
  advanceAfterGroupComplete,
}: OptionNestedPanelProps) {
  const configurationParentVariation =
    parentVariationFromItemVariation(item.variations, variationId) ??
    baseProductVariation;

  const nestedGroups = (item.nestedAttributeGroups ?? []).filter((g) =>
    isConfigurationGroupVisibleForParentVariation(
      g,
      configurationParentVariation
    )
  );
  if (nestedGroups.length === 0) return null;

  return (
    <div className="mt-3 border-l-2 border-primary/20 pl-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Options for {item.name}
      </p>
      <InlineRecommendationGroups
        groups={nestedGroups}
        rootGroups={nestedGroups}
        baseProductVariation={configurationParentVariation}
        baseProductVariationShortLabel={baseProductVariationShortLabel}
        productVariationId={variationId}
        selectedByGroup={config.selectedByGroup}
        selectedNestedVariationByOption={config.selectedNestedVariationByOption}
        optionNestedConfigs={{}}
        groupRefs={groupRefs}
        allGroupsFlat={allGroupsFlat}
        onSelectedByGroupChange={(updater) => {
          onPatchOptionNestedConfig(optionKey, {
            ...config,
            productVariationId: variationId,
            selectedByGroup:
              typeof updater === 'function'
                ? updater(config.selectedByGroup)
                : updater,
          });
        }}
        onNestedVariationChange={(updater) => {
          onPatchOptionNestedConfig(optionKey, {
            ...config,
            productVariationId: variationId,
            selectedNestedVariationByOption:
              typeof updater === 'function'
                ? updater(config.selectedNestedVariationByOption)
                : updater,
          });
        }}
        onPatchOptionNestedConfig={onPatchOptionNestedConfig}
        onOpenOptionVariation={onOpenOptionVariation}
        scrollToGroup={scrollToGroup}
        scopeParentOptionKey={optionKey}
        onClearOptionNestedForGroup={onClearOptionNestedForGroup}
        onClearOptionNested={onClearOptionNested}
        isNestedCollapsed={isNestedCollapsed}
        onCollapseNestedForGroup={onCollapseNestedForGroup}
        onExpandNestedForGroup={onExpandNestedForGroup}
        advanceAfterGroupComplete={advanceAfterGroupComplete}
      />
    </div>
  );
}

function InlineRecommendationGroups({
  groups,
  rootGroups,
  baseProductVariation,
  baseProductVariationShortLabel,
  productVariationId,
  selectedByGroup,
  selectedNestedVariationByOption,
  optionNestedConfigs,
  groupRefs,
  allGroupsFlat,
  onSelectedByGroupChange,
  onNestedVariationChange,
  onPatchOptionNestedConfig,
  onOpenOptionVariation,
  scrollToGroup,
  scopeParentOptionKey,
  onClearOptionNestedForGroup,
  onClearOptionNested,
  isNestedCollapsed,
  onCollapseNestedForGroup,
  onExpandNestedForGroup,
  advanceAfterGroupComplete,
}: InlineGroupsProps) {
  const limitsForGroup = useCallback(
    (group: AttributeGroup) =>
      getRecommendationLimits(
        {
          selectionType: group.selectionType,
          minItems: group.minItems ?? null,
          maxItems: group.maxItems ?? null,
          variationLimits: group.variationLimits,
        },
        productVariationId || null
      ),
    [productVariationId]
  );

  const selectRadio = (
    group: AttributeGroup,
    optionId: string,
    limits: { minItems: number; maxItems: number }
  ) => {
    const cur = selectedByGroup[group.id]?.[0];
    if (cur === optionId && limits.minItems === 0) {
      onNestedVariationChange((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${group.id}:`)) delete next[key];
        }
        return next;
      });
      onSelectedByGroupChange((prev) => ({ ...prev, [group.id]: [] }));
      return;
    }
    if (cur === optionId) {
      const item = group.items.find((it) => it.menuItemId === optionId);
      if (item && optionNeedsManualVariationPicker(item, group)) {
        onOpenOptionVariation(scopeParentOptionKey, group.id, optionId);
        return;
      }
      onCollapseNestedForGroup?.(group.id);
      scrollToGroup(group.id);
      return;
    }
    onExpandNestedForGroup?.(group.id);
    onClearOptionNestedForGroup?.(group.id);
    onNestedVariationChange((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${group.id}:`)) delete next[key];
      }
      const item = group.items.find((it) => it.menuItemId === optionId);
      if (item) {
        const key = optionSelectionKey(group.id, optionId);
        const resolved = resolveCategoryItemVariationId(
          item,
          baseProductVariation,
          group
        );
        if (resolved) next[key] = resolved;
      }
      return next;
    });
    onSelectedByGroupChange((prev) => {
      const next = { ...prev, [group.id]: [optionId] };
      const item = group.items.find((it) => it.menuItemId === optionId);
      const key = optionSelectionKey(group.id, optionId);
      if (item && recommendationOptionNeedsSheet(item, group)) {
        queueMicrotask(() => beginOptionSetup(group.id, optionId));
      }
      if (totalSelectedUnits(next[group.id]!) >= limits.maxItems) {
        queueMicrotask(() => advanceAfterGroupComplete(group.id, next));
      }
      return next;
    });
  };

  const beginOptionSetup = (groupId: string, optionId: string) => {
    const group = allGroupsFlat.find((g) => g.id === groupId);
    const item = group?.items.find((it) => it.menuItemId === optionId);
    if (!item || !recommendationOptionNeedsSheet(item, group)) return;
    const key = optionSelectionKey(groupId, optionId);
    if (optionNeedsManualVariationPicker(item, group)) {
      onOpenOptionVariation(scopeParentOptionKey, groupId, optionId);
      return;
    } else {
      const resolved = resolveCategoryItemVariationId(
        item,
        baseProductVariation,
        group
      );
      if (resolved) {
        onNestedVariationChange((prev) => ({ ...prev, [key]: resolved }));
      }
    }
    onExpandNestedForGroup?.(groupId);
    scrollToGroup(groupId);
  };

  const focusGroupItemChange = (groupId: string) => {
    onCollapseNestedForGroup?.(groupId);
    scrollToGroup(groupId);
  };

  const toggleMultiCheckbox = (group: AttributeGroup, optionId: string) => {
    const limits = limitsForGroup(group);
    onSelectedByGroupChange((prev) => {
      const cur = prev[group.id] ?? [];
      if (cur.includes(optionId)) {
        onClearOptionNested?.(optionSelectionKey(group.id, optionId));
        onNestedVariationChange((prevVar) => {
          const next = { ...prevVar };
          delete next[`${group.id}:${optionId}`];
          return next;
        });
        return {
          ...prev,
          [group.id]: cur.filter((x) => x !== optionId),
        };
      }
      if (totalSelectedUnits(cur) >= limits.maxItems) {
        advanceAfterGroupComplete(group.id, prev);
        return prev;
      }
      const next = { ...prev, [group.id]: [...cur, optionId] };
      const item = group.items.find((it) => it.menuItemId === optionId);
      const key = optionSelectionKey(group.id, optionId);
      if (item && recommendationOptionNeedsSheet(item, group)) {
        queueMicrotask(() => beginOptionSetup(group.id, optionId));
      }
      if (totalSelectedUnits(next[group.id]!) >= limits.maxItems) {
        queueMicrotask(() => advanceAfterGroupComplete(group.id, next));
      }
      return next;
    });
  };

  const increaseMultiQty = (group: AttributeGroup, optionId: string) => {
    const limits = limitsForGroup(group);
    onSelectedByGroupChange((prev) => {
      const cur = prev[group.id] ?? [];
      if (totalSelectedUnits(cur) >= limits.maxItems) {
        advanceAfterGroupComplete(group.id, prev);
        return prev;
      }
      const next = { ...prev, [group.id]: [...cur, optionId] };
      const item = group.items.find((it) => it.menuItemId === optionId);
      const key = optionSelectionKey(group.id, optionId);
      const isFirstUnit =
        cur.filter((id) => id === optionId).length === 0;
      if (isFirstUnit && item && recommendationOptionNeedsSheet(item, group)) {
        queueMicrotask(() => beginOptionSetup(group.id, optionId));
      }
      if (totalSelectedUnits(next[group.id]!) >= limits.maxItems) {
        queueMicrotask(() => advanceAfterGroupComplete(group.id, next));
      }
      return next;
    });
  };

  const decreaseMultiQty = (groupId: string, optionId: string) => {
    const current = [...(selectedByGroup[groupId] ?? [])];
    const idx = current.lastIndexOf(optionId);
    if (idx < 0) return;
    current.splice(idx, 1);
      if (current.filter((id) => id === optionId).length === 0) {
      onClearOptionNested?.(optionSelectionKey(groupId, optionId));
      onNestedVariationChange((prev) => {
        const next = { ...prev };
        delete next[`${groupId}:${optionId}`];
        return next;
      });
    }
    onSelectedByGroupChange((prev) => ({ ...prev, [groupId]: current }));
  };

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        if (
          !isConfigurationGroupVisibleForParentVariation(
            g,
            baseProductVariation
          )
        ) {
          return null;
        }

        const selectedIds = selectedByGroup[g.id] ?? [];
        const limits = limitsForGroup(g);
        const count = totalSelectedUnits(selectedIds);
        const min = limits.minItems ?? (g.required ? 1 : 0);
        const radioMode = isRadioGroup(g, limits);
        const quantityMode = isQuantityGroup(g);
        const missing =
          radioMode
            ? g.required && count === 0
            : (g.required && count < min) ||
              (count > 0 && min > 0 && count < min);

        const renderOptionNestedInline = (it: (typeof g.items)[number]) => {
          const optionQty = selectedIds.filter(
            (id) => id === it.menuItemId
          ).length;
          const selected = radioMode
            ? selectedIds[0] === it.menuItemId
            : optionQty > 0;
          if (
            !selected ||
            !(it.nestedAttributeGroups?.length ?? 0) ||
            isNestedCollapsed?.(g.id)
          ) {
            return null;
          }
          const key = optionSelectionKey(g.id, it.menuItemId);
          const optionCtx = {
            group: g,
            parentVariation: baseProductVariation,
          };
          const variationId =
            effectiveOptionVariationId(
              it,
              key,
              selectedNestedVariationByOption,
              optionNestedConfigs,
              optionCtx
            ) ?? '';
          if (
            optionNeedsManualVariationPicker(it, g) &&
            !variationId
          ) {
            return null;
          }
          const config =
            optionNestedConfigs[key] ??
            emptyOptionNestedConfig();
          return (
            <OptionNestedPanel
              optionKey={key}
              item={it}
              variationId={variationId}
              baseProductVariation={baseProductVariation}
              baseProductVariationShortLabel={baseProductVariationShortLabel}
              config={config}
              allGroupsFlat={allGroupsFlat}
              groupRefs={groupRefs}
              onPatchOptionNestedConfig={onPatchOptionNestedConfig}
              onOpenOptionVariation={onOpenOptionVariation}
              scrollToGroup={scrollToGroup}
              onClearOptionNestedForGroup={onClearOptionNestedForGroup}
              onClearOptionNested={onClearOptionNested}
              isNestedCollapsed={isNestedCollapsed}
              onCollapseNestedForGroup={onCollapseNestedForGroup}
              onExpandNestedForGroup={onExpandNestedForGroup}
              advanceAfterGroupComplete={advanceAfterGroupComplete}
            />
          );
        };

        return (
          <section
            key={g.id}
            ref={(el) => {
              groupRefs.current[g.id] = el;
            }}
            className="overflow-hidden rounded-lg border border-border bg-card scroll-mt-4"
          >
            <div className="flex items-center justify-between gap-3 bg-muted/60 px-4 py-2.5">
              <Label className="text-sm font-bold uppercase tracking-wide text-foreground">
                {configurationGroupDisplayTitle(
                  g.name,
                  baseProductVariation,
                  g.useVariationPricing ?? false,
                  baseProductVariationShortLabel
                )}
              </Label>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {count}/{limits.maxItems} max.
              </span>
            </div>

            {missing ? (
              <p className="border-b border-border px-4 py-1.5 text-xs text-destructive">
                {radioMode
                  ? 'Please select an option'
                  : `Please select at least ${min} option${min === 1 ? '' : 's'}`}
              </p>
            ) : null}

            <div className="divide-y divide-border">
              {(() => {
                const visibleItems = filterConfigurationItemsForParentVariation(
                  g.items,
                  baseProductVariation,
                  g.useVariationPricing ?? false
                );
                if (visibleItems.length === 0) {
                  return (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      {g.useVariationPricing && !baseProductVariation
                        ? 'Select the main product variation first.'
                        : g.useVariationPricing
                          ? 'No add-ons for this variation.'
                          : 'No options available.'}
                    </p>
                  );
                }
                return visibleItems.map((it) => {
                  const optionKey = optionSelectionKey(g.id, it.menuItemId);
                  const nestedVariationId = effectiveOptionVariationId(
                    it,
                    optionKey,
                    selectedNestedVariationByOption,
                    optionNestedConfigs,
                    { group: g, parentVariation: baseProductVariation }
                  );
                  const nestedVariation = nestedVariationId
                    ? (it.variations ?? []).find((v) => v.id === nestedVariationId)
                    : undefined;
                  const listUnit = configurationItemResolvedListUnit(
                    it,
                    baseProductVariation,
                    g.useVariationPricing ?? false,
                    nestedVariationId
                  );
                  const defaultListUnit =
                    configurationDefaultListUnitPriceForSelection(
                      g,
                      baseProductVariation,
                      visibleItems,
                      nestedVariation ?? null
                    );
                  const qty = selectedIds.filter(
                    (id) => id === it.menuItemId
                  ).length;
                  const addonLabel = configurationAddonPriceLabel(
                    listUnit,
                    defaultListUnit ?? null,
                    {
                      freeQuantity: g.freeQuantity,
                      multipleMode: g.multipleMode,
                      groupSelectedIds: selectedIds,
                    }
                  );
                  const radioSelected = selectedIds[0] === it.menuItemId;
                  const checkboxSelected = qty > 0;
                  const atMax =
                    totalSelectedUnits(selectedIds) >= limits.maxItems;

                  return (
                    <div key={it.menuItemId} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <OptionThumbnail
                          imageUrl={it.imageUrl}
                          name={it.name}
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            if (radioMode) {
                              selectRadio(g, it.menuItemId, limits);
                            } else if (quantityMode) {
                              if (qty === 0 && !atMax) {
                                increaseMultiQty(g, it.menuItemId);
                              } else if (qty > 0) {
                                focusGroupItemChange(g.id);
                              }
                            } else if (checkboxSelected) {
                              focusGroupItemChange(g.id);
                            } else {
                              toggleMultiCheckbox(g, it.menuItemId);
                            }
                          }}
                        >
                          <p className="text-sm font-bold uppercase leading-snug text-foreground">
                            {it.name}
                          </p>
                          {addonLabel ? (
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                              {addonLabel}
                            </p>
                          ) : null}
                        </button>

                        {radioMode ? (
                          <button
                            type="button"
                            className="shrink-0 p-1"
                            aria-label={`Select ${it.name}`}
                            onClick={() =>
                              selectRadio(g, it.menuItemId, limits)
                            }
                          >
                            <RadioIndicator selected={radioSelected} />
                          </button>
                        ) : quantityMode ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {qty > 0 ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 rounded-lg border-primary/30"
                                  aria-label={`Decrease ${it.name}`}
                                  onClick={() =>
                                    decreaseMultiQty(g.id, it.menuItemId)
                                  }
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
                              className="h-9 w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                              aria-label={`Add ${it.name}`}
                              disabled={qty === 0 && atMax}
                              onClick={() => increaseMultiQty(g, it.menuItemId)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="shrink-0 p-1"
                            aria-label={`Toggle ${it.name}`}
                            disabled={!checkboxSelected && atMax}
                            onClick={() =>
                              toggleMultiCheckbox(g, it.menuItemId)
                            }
                          >
                            <CheckboxIndicator selected={checkboxSelected} />
                          </button>
                        )}
                      </div>
                      {renderOptionNestedInline(it)}
                    </div>
                  );
                });
              })()}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type Props = {
  open: boolean;
  parentGroupName: string;
  product: ProductItem;
  attributeGroups: AttributeGroup[];
  initialProductVariationId?: string;
  /** Group context for the product being configured (category option or product rec). */
  parentConfigurationGroup?: { useVariationPricing?: boolean };
  /** Base product variation (e.g. taco size) for configuration item rates. */
  baseProductVariation?: ParentVariationContext | null;
  baseProductVariationShortLabel?: string | null;
  /** Higher z-index when stacked inside another sheet. */
  stackClassName?: string;
  onClose: () => void;
  onDone: (result: NestedRecommendationResult) => void;
};

export function NestedRecommendationSheet({
  open,
  parentGroupName,
  product,
  attributeGroups,
  initialProductVariationId,
  parentConfigurationGroup,
  baseProductVariation = null,
  baseProductVariationShortLabel = null,
  stackClassName,
  onClose,
  onDone,
}: Props) {
  const [productVariationId, setProductVariationId] = useState(
    initialProductVariationId ?? ''
  );
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<string, string[]>
  >({});
  const [selectedPersonalizeByGroup, setSelectedPersonalizeByGroup] = useState<
    Record<string, string[]>
  >({});
  const [selectedNestedVariationByOption, setSelectedNestedVariationByOption] =
    useState<Record<string, string>>({});
  const [optionNestedConfigs, setOptionNestedConfigs] = useState<
    Record<string, NestedRecommendationResult>
  >({});
  const [productGroupConfigs, setProductGroupConfigs] = useState<
    Record<string, NestedRecommendationResult>
  >({});
  const [preselectedProductVariationByGroup, setPreselectedProductVariationByGroup] =
    useState<Record<string, string>>({});
  const [activeProductGroupId, setActiveProductGroupId] = useState<string | null>(
    null
  );
  const [productRecVariationPickerGroupId, setProductRecVariationPickerGroupId] =
    useState<string | null>(null);
  const [rootVariationPickerOpen, setRootVariationPickerOpen] = useState(false);
  const [optionVariationPicker, setOptionVariationPicker] = useState<{
    groupId: string;
    optionId: string;
    parentOptionKey?: string;
  } | null>(null);
  const [collapsedNestedGroupIds, setCollapsedNestedGroupIds] = useState<
    Set<string>
  >(() => new Set());

  const personalizeGroups = useMemo(
    () =>
      (product.personalizeGroups ?? []).filter(
        (group) => group.options.length > 0
      ),
    [product.personalizeGroups]
  );

  const productRecommendationGroups = useMemo(
    () => attributeGroups.filter((g) => g.sourceType === 'PRODUCT'),
    [attributeGroups]
  );

  const categoryGroups = useMemo(
    () => attributeGroups.filter((g) => g.sourceType !== 'PRODUCT'),
    [attributeGroups]
  );

  const visibleProductRecommendationGroups = useMemo(
    () =>
      productRecommendationGroups.filter((g) => {
        const item = g.items[0];
        if (!item) return false;
        return isConfigurationItemAvailableForParentVariation(
          item,
          baseProductVariation,
          g.useVariationPricing ?? false
        );
      }),
    [baseProductVariation, productRecommendationGroups]
  );

  const rootManualVariation = optionNeedsManualVariationPicker(
    product,
    parentConfigurationGroup
  );

  /** Variation context for category add-ons inside this sheet (recommended product size). */
  const configurationParentVariation = useMemo(
    () =>
      parentVariationFromItemVariation(
        product.variations,
        productVariationId || null
      ) ?? baseProductVariation,
    [baseProductVariation, product.variations, productVariationId]
  );

  const isProductGroupConfigured = useCallback(
    (g: AttributeGroup, item: ProductItem) => {
      if (productGroupConfigs[g.id]) return true;
      const hasNested = (item.nestedAttributeGroups?.length ?? 0) > 0;
      if (hasNested) return false;
      if (optionNeedsManualVariationPicker(item, g)) {
        return Boolean(preselectedProductVariationByGroup[g.id]);
      }
      return Boolean(
        resolveCategoryItemVariationId(item, baseProductVariation, g)
      );
    },
    [baseProductVariation, preselectedProductVariationByGroup, productGroupConfigs]
  );

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string[]> = {};
    for (const g of attributeGroups) init[g.id] = [];
    const initProductConfigs: Record<string, NestedRecommendationResult> = {};
    for (const g of productRecommendationGroups) {
      if (!recommendedProductNeedsSheet(g)) {
        initProductConfigs[g.id] = emptyOptionNestedConfig();
      }
    }
    setSelectedByGroup(init);
    const personalizeInit: Record<string, string[]> = {};
    for (const g of product.personalizeGroups ?? []) {
      personalizeInit[g.id] = [];
    }
    setSelectedPersonalizeByGroup(personalizeInit);
    setSelectedNestedVariationByOption({});
    setOptionNestedConfigs({});
    setProductGroupConfigs(initProductConfigs);
    setPreselectedProductVariationByGroup({});
    setActiveProductGroupId(null);
    setProductRecVariationPickerGroupId(null);
    setRootVariationPickerOpen(false);
    setOptionVariationPicker(null);
    setCollapsedNestedGroupIds(new Set());
    setProductVariationId(initialProductVariationId ?? '');
  }, [
    open,
    attributeGroups,
    initialProductVariationId,
    product.personalizeGroups,
    productRecommendationGroups,
  ]);

  const visibleCategoryGroups = useMemo(
    () =>
      categoryGroups.filter((g) =>
        isConfigurationGroupVisibleForParentVariation(
          g,
          configurationParentVariation
        )
      ),
    [categoryGroups, configurationParentVariation]
  );

  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

  const allGroupsFlat = useMemo(() => {
    const out: AttributeGroup[] = [];
    const walk = (groups: AttributeGroup[]) => {
      for (const g of groups) {
        out.push(g);
        if (g.sourceType === 'PRODUCT' && g.items.length === 1) {
          const nested = g.items[0]?.nestedAttributeGroups ?? [];
          walk(nested);
        } else {
          for (const it of g.items) {
            if (it.nestedAttributeGroups?.length) {
              walk(it.nestedAttributeGroups);
            }
          }
        }
      }
    };
    walk(attributeGroups);
    return out;
  }, [attributeGroups]);

  useEffect(() => {
    if (!open) return;
    if (parentConfigurationGroup?.useVariationPricing) {
      const resolved = resolveCategoryItemVariationId(
        product,
        baseProductVariation,
        parentConfigurationGroup
      );
      if (resolved) {
        setProductVariationId((cur) => (cur === resolved ? cur : resolved));
      }
    }
    setPreselectedProductVariationByGroup((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of productRecommendationGroups) {
        if (!g.useVariationPricing) continue;
        const item = g.items[0];
        if (!item) continue;
        const resolved = resolveCategoryItemVariationId(
          item,
          baseProductVariation,
          g
        );
        if (resolved) {
          if (next[g.id] !== resolved) {
            next[g.id] = resolved;
            changed = true;
          }
        } else if (next[g.id]) {
          delete next[g.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setSelectedNestedVariationByOption((prev) => {
      const synced = syncParentVariationOptionSelections(
        categoryGroups,
        selectedByGroup,
        configurationParentVariation,
        prev
      );
      return synced ?? prev;
    });
    setOptionNestedConfigs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, config] of Object.entries(prev)) {
        if (!key.includes(':')) continue;
        const [groupId, optionId] = key.split(':');
        const group = allGroupsFlat.find((g) => g.id === groupId);
        const item = group?.items.find((it) => it.menuItemId === optionId);
        if (!item?.nestedAttributeGroups?.length) continue;
        const optionParent =
          parentVariationFromItemVariation(
            item.variations,
            config.productVariationId || selectedNestedVariationByOption[key]
          ) ?? configurationParentVariation;
        const synced = syncParentVariationOptionSelections(
          item.nestedAttributeGroups,
          config.selectedByGroup,
          optionParent,
          config.selectedNestedVariationByOption
        );
        if (synced) {
          next[key] = {
            ...config,
            selectedNestedVariationByOption: synced,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    open,
    allGroupsFlat,
    baseProductVariation,
    categoryGroups,
    configurationParentVariation,
    parentConfigurationGroup,
    product,
    productRecommendationGroups,
    selectedByGroup,
    selectedNestedVariationByOption,
  ]);

  const activeProductGroup = productRecommendationGroups.find(
    (g) => g.id === activeProductGroupId
  );
  const activeProductItem = activeProductGroup?.items[0];

  const openProductRecommendationGroup = useCallback(
    (groupId: string) => {
      const group = productRecommendationGroups.find((g) => g.id === groupId);
      const item = group?.items[0];
      if (!group || !item) return;
      setActiveProductGroupId(null);
      if (group.useVariationPricing) {
        setActiveProductGroupId(groupId);
        return;
      }
      if (optionNeedsManualVariationPicker(item, group)) {
        setProductRecVariationPickerGroupId(groupId);
        return;
      }
      setActiveProductGroupId(groupId);
    },
    [productRecommendationGroups]
  );

  const scrollToGroup = useCallback((groupId: string) => {
    groupRefs.current[groupId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const patchOptionNestedConfig = useCallback(
    (key: string, config: NestedRecommendationResult) => {
      setOptionNestedConfigs((prev) => ({ ...prev, [key]: config }));
    },
    []
  );

  const openOptionVariation = useCallback(
    (
      parentOptionKey: string | undefined,
      groupId: string,
      optionId: string
    ) => {
      const group = allGroupsFlat.find((g) => g.id === groupId);
      const item = group?.items.find((it) => it.menuItemId === optionId);
      if (!group || !item || !optionNeedsManualVariationPicker(item, group)) {
        return;
      }
      setOptionVariationPicker({ groupId, optionId, parentOptionKey });
    },
    [allGroupsFlat]
  );

  const runNestedPendingFlows = useCallback(() => {
    if (
      optionVariationPicker ||
      productRecVariationPickerGroupId ||
      rootVariationPickerOpen ||
      activeProductGroupId
    ) {
      return;
    }

    if (rootManualVariation && !productVariationId) {
      setRootVariationPickerOpen(true);
      return;
    }

    for (const g of visibleProductRecommendationGroups) {
      const item = g.items[0];
      if (!item) continue;
      if (g.useVariationPricing) continue;
      if (
        optionNeedsManualVariationPicker(item, g) &&
        !preselectedProductVariationByGroup[g.id]
      ) {
        setProductRecVariationPickerGroupId(g.id);
        return;
      }
    }

    for (const g of visibleCategoryGroups) {
      const selectedIds = selectedByGroup[g.id] ?? [];
      const optionIds =
        g.selectionType === 'SINGLE'
          ? selectedIds.slice(0, 1)
          : [...new Set(selectedIds)];
      for (const optionId of optionIds) {
        const item = g.items.find((it) => it.menuItemId === optionId);
        if (!item || !recommendationOptionNeedsSheet(item, g)) continue;
        const key = optionSelectionKey(g.id, optionId);
        if (
          optionNeedsManualVariationPicker(item, g) &&
          !effectiveOptionVariationId(
            item,
            key,
            selectedNestedVariationByOption,
            optionNestedConfigs,
            { group: g, parentVariation: configurationParentVariation }
          )
        ) {
          openOptionVariation(undefined, g.id, optionId);
          return;
        }
      }
    }
  }, [
    activeProductGroupId,
    configurationParentVariation,
    openOptionVariation,
    optionNestedConfigs,
    optionVariationPicker,
    preselectedProductVariationByGroup,
    productRecVariationPickerGroupId,
    productVariationId,
    rootManualVariation,
    rootVariationPickerOpen,
    selectedByGroup,
    selectedNestedVariationByOption,
    visibleCategoryGroups,
    visibleProductRecommendationGroups,
  ]);

  useEffect(() => {
    if (!open) return;
    if (parentConfigurationGroup?.useVariationPricing) {
      setRootVariationPickerOpen(false);
      setProductRecVariationPickerGroupId(null);
    }
  }, [open, parentConfigurationGroup?.useVariationPricing]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => runNestedPendingFlows());
  }, [open, runNestedPendingFlows]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => runNestedPendingFlows());
  }, [
    open,
    runNestedPendingFlows,
    productVariationId,
    preselectedProductVariationByGroup,
    selectedByGroup,
    selectedNestedVariationByOption,
  ]);

  const clearOptionNestedForGroup = useCallback((groupId: string) => {
    setOptionNestedConfigs((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${groupId}:`)) delete next[k];
      }
      return next;
    });
    setCollapsedNestedGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  }, []);

  const clearOptionNested = useCallback((key: string) => {
    setOptionNestedConfigs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const isNestedCollapsed = useCallback(
    (groupId: string) => collapsedNestedGroupIds.has(groupId),
    [collapsedNestedGroupIds]
  );

  const collapseNestedForGroup = useCallback((groupId: string) => {
    setCollapsedNestedGroupIds((prev) => new Set(prev).add(groupId));
  }, []);

  const expandNestedForGroup = useCallback((groupId: string) => {
    setCollapsedNestedGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  }, []);

  const productRecVariationTarget = useMemo(() => {
    if (!productRecVariationPickerGroupId) return null;
    const group = productRecommendationGroups.find(
      (g) => g.id === productRecVariationPickerGroupId
    );
    const item = group?.items[0];
    if (!group || !item) return null;
    return {
      group,
      item,
      selectedId: preselectedProductVariationByGroup[group.id],
    };
  }, [
    preselectedProductVariationByGroup,
    productRecVariationPickerGroupId,
    productRecommendationGroups,
  ]);

  const optionVariationTarget = useMemo(() => {
    if (!optionVariationPicker) return null;
    const group = allGroupsFlat.find((g) => g.id === optionVariationPicker.groupId);
    const item = group?.items.find(
      (it) => it.menuItemId === optionVariationPicker.optionId
    );
    if (!group || !item) return null;
    const topLevelKey = optionSelectionKey(
      optionVariationPicker.groupId,
      optionVariationPicker.optionId
    );
    const configKey = optionVariationPicker.parentOptionKey ?? topLevelKey;
    const innerKey = `${optionVariationPicker.groupId}:${optionVariationPicker.optionId}`;
    const selectedId = optionVariationPicker.parentOptionKey
      ? optionNestedConfigs[optionVariationPicker.parentOptionKey]
          ?.selectedNestedVariationByOption[innerKey]
      : selectedNestedVariationByOption[topLevelKey] ??
        optionNestedConfigs[topLevelKey]?.productVariationId;
    return {
      group,
      item,
      configKey,
      innerKey,
      selectedId,
    };
  }, [
    allGroupsFlat,
    optionNestedConfigs,
    optionVariationPicker,
    selectedNestedVariationByOption,
  ]);

  const requiredMissing = useMemo(() => {
    if (rootManualVariation && !productVariationId) return true;

    const missingProductRecs = visibleProductRecommendationGroups.some((g) => {
      const item = g.items[0];
      if (!item) return false;
      if (
        optionNeedsManualVariationPicker(item, g) &&
        !preselectedProductVariationByGroup[g.id]
      ) {
        return g.required;
      }
      if (!recommendedProductNeedsSheet(g)) return false;
      return g.required && !isProductGroupConfigured(g, item);
    });
    if (missingProductRecs) return true;

    const missingOptionConfig = allGroupsFlat.some((g) => {
      if (g.sourceType === 'PRODUCT') return false;
      if (
        !isConfigurationGroupVisibleForParentVariation(
          g,
          configurationParentVariation
        )
      ) {
        return false;
      }
      const selectedIds = selectedByGroup[g.id] ?? [];
      const ids =
        g.selectionType === 'SINGLE'
          ? selectedIds.slice(0, 1)
          : selectedIds;
      return ids.some((optionId) => {
        const option = g.items.find((it) => it.menuItemId === optionId);
        if (!option) return false;
        return !isOptionConfigComplete(
          option,
          optionSelectionKey(g.id, optionId),
          selectedNestedVariationByOption,
          optionNestedConfigs,
          { group: g, parentVariation: configurationParentVariation }
        );
      });
    });
    if (missingOptionConfig) return true;

    return allGroupsFlat.some((g) => {
      if (g.sourceType === 'PRODUCT') return false;
      if (
        !isConfigurationGroupVisibleForParentVariation(
          g,
          configurationParentVariation
        )
      ) {
        return false;
      }
      const count = totalSelectedUnits(selectedByGroup[g.id] ?? []);
      const limits = getRecommendationLimits(
        {
          selectionType: g.selectionType,
          minItems: g.minItems ?? null,
          maxItems: g.maxItems ?? null,
          variationLimits: g.variationLimits,
        },
        productVariationId || null
      );
      if (g.selectionType === 'SINGLE') {
        return g.required && count === 0;
      }
      const min = limits.minItems ?? (g.required ? 1 : 0);
      if (g.required && count < min) return true;
      if (count > 0 && min > 0 && count < min) return true;
      return false;
    });
  }, [
    allGroupsFlat,
    configurationParentVariation,
    optionNestedConfigs,
    preselectedProductVariationByGroup,
    productGroupConfigs,
    productVariationId,
    rootManualVariation,
    selectedByGroup,
    selectedNestedVariationByOption,
    visibleProductRecommendationGroups,
    isProductGroupConfigured,
  ]);

  const advanceAfterGroupComplete = useCallback(
    (groupId: string, nextSelectedByGroup: Record<string, string[]>) => {
      const order = collectVisibleCategoryGroupIds(
        categoryGroups,
        nextSelectedByGroup,
        configurationParentVariation
      );
      const idx = order.indexOf(groupId);
      for (let i = idx + 1; i < order.length; i++) {
        const nextId = order[i]!;
        const nextGroup = allGroupsFlat.find((g) => g.id === nextId);
        if (!nextGroup || nextGroup.sourceType === 'PRODUCT') continue;
        const limits = getRecommendationLimits(
          {
            selectionType: nextGroup.selectionType,
            minItems: nextGroup.minItems ?? null,
            maxItems: nextGroup.maxItems ?? null,
            variationLimits: nextGroup.variationLimits,
          },
          productVariationId || null
        );
        const count = totalSelectedUnits(nextSelectedByGroup[nextId] ?? []);
        if (count < limits.maxItems) {
          groupRefs.current[nextId]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
          return;
        }
      }
    },
    [
      allGroupsFlat,
      categoryGroups,
      configurationParentVariation,
      productVariationId,
    ]
  );

  const handleDone = () => {
    if (requiredMissing) return;
    const mods = buildModifierSelectionsForGroups(
      visibleCategoryGroups,
      selectedByGroup,
      selectedNestedVariationByOption,
      configurationParentVariation,
      baseProductVariationShortLabel
    );
    for (const [key, config] of Object.entries(optionNestedConfigs)) {
      const [groupId, optionId] = key.split(':');
      const parentGroup = allGroupsFlat.find((g) => g.id === groupId);
      const parentItem = parentGroup?.items.find(
        (it) => it.menuItemId === optionId
      );
      const nestedGroups = parentItem?.nestedAttributeGroups ?? [];
      const optionParent =
        parentVariationFromItemVariation(
          parentItem?.variations,
          config.productVariationId || selectedNestedVariationByOption[key]
        ) ?? configurationParentVariation;
      const built = buildModifierSelectionsForGroups(
        nestedGroups,
        config.selectedByGroup,
        config.selectedNestedVariationByOption,
        optionParent,
        baseProductVariationShortLabel
      );
      for (const child of built) {
        mods.push({
          attributeGroupId: child.attributeGroupId,
          groupName: child.groupName,
          selections: child.selections,
        });
      }
    }

    for (const g of visibleProductRecommendationGroups) {
      const item = g.items[0];
      if (!item) continue;
      const config = productGroupConfigs[g.id];
      if (!config && !isProductGroupConfigured(g, item)) continue;

      const pvId = resolveProductRecommendationVariationId(item, g, {
        configProductVariationId: config?.productVariationId,
        preselectedVariationId: preselectedProductVariationByGroup[g.id],
        parentVariation: baseProductVariation,
      });
      const pv = pvId
        ? (item.variations ?? []).find((v) => v.id === pvId)
        : undefined;
      const pvName = pv?.name ?? pv?.title;
      const selectionName = pvName ? `${item.name} (${pvName})` : item.name;

      mods.push({
        attributeGroupId: g.id,
        groupName: g.name,
        selections: [
          {
            menuItemId: item.menuItemId,
            name: selectionName,
            description: item.description,
            imageUrl: item.imageUrl,
            unitPrice: productRecommendationVariationUnitPrice(item, pvId),
          },
        ],
      });

      for (const child of config?.mods ?? []) {
        mods.push({
          attributeGroupId: child.attributeGroupId,
          groupName: `${g.name} — ${child.groupName}`,
          selections: child.selections,
        });
      }
    }

    mods.push(
      ...buildPersonalizeModifierSelections(
        personalizeGroups,
        selectedPersonalizeByGroup
      )
    );

    onDone({
      productVariationId,
      selectedByGroup,
      selectedNestedVariationByOption,
      mods,
    });
  };

  const togglePersonalizeOption = (groupId: string, optionId: string) => {
    const group = personalizeGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSelectedPersonalizeByGroup((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId)) {
        return {
          ...prev,
          [groupId]: cur.filter((id) => id !== optionId),
        };
      }
      if (cur.length >= group.maxItems) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });
  };

  if (!open) return null;

  return (
    <div
      className={`absolute inset-0 z-[90] flex min-h-0 flex-col bg-card animate-in fade-in-0 duration-200 ${stackClassName ?? ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name} configuration`}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {parentGroupName}
          </p>
          <h2 className="text-lg font-bold text-foreground">{product.name}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
        <div className="space-y-5">
          {visibleProductRecommendationGroups.map((g) => {
            const item = g.items[0];
            if (!item) return null;
            const configured = isProductGroupConfigured(g, item);
            const needsSheet = recommendedProductNeedsSheet(g);
            const missing = needsSheet && !configured && g.required;
            const manualProductVariation = optionNeedsManualVariationPicker(
              item,
              g
            );
            const selectedVariationIdForGroup = manualProductVariation
              ? preselectedProductVariationByGroup[g.id]
              : resolveCategoryItemVariationId(
                  item,
                  baseProductVariation,
                  g
                ) ?? preselectedProductVariationByGroup[g.id];
            const selectedVariationLabel =
              item.variations?.find((v) => v.id === selectedVariationIdForGroup)
                ?.name ??
              item.variations?.find((v) => v.id === selectedVariationIdForGroup)
                ?.title;

            return (
              <section
                key={g.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <Label className="text-sm font-semibold text-foreground">
                    {item.name}
                  </Label>
                  {g.required ? (
                    <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      Required
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Optional</span>
                  )}
                </div>
                {configured ? (
                  <p className="mt-2 text-xs text-primary">Options selected</p>
                ) : null}
                {missing ? (
                  <p className="mt-1 text-xs text-destructive">
                    Please configure this recommendation
                  </p>
                ) : null}
                {needsSheet ? (
                  <button
                    type="button"
                    className="mt-3 flex h-12 w-full items-center justify-between rounded-lg border border-input bg-muted/40 px-3 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                    onClick={() => openProductRecommendationGroup(g.id)}
                  >
                    <span className="truncate text-muted-foreground">
                      {configured
                        ? selectedVariationLabel
                          ? `${item.name} (${selectedVariationLabel})`
                          : `Selected ${item.name}`
                        : `Select ${item.name}`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ) : null}
              </section>
            );
          })}

          <InlineRecommendationGroups
            groups={visibleCategoryGroups}
            rootGroups={visibleCategoryGroups}
            baseProductVariation={configurationParentVariation}
            baseProductVariationShortLabel={baseProductVariationShortLabel}
            productVariationId={productVariationId}
            selectedByGroup={selectedByGroup}
            selectedNestedVariationByOption={selectedNestedVariationByOption}
            optionNestedConfigs={optionNestedConfigs}
            groupRefs={groupRefs}
            allGroupsFlat={allGroupsFlat}
            onSelectedByGroupChange={setSelectedByGroup}
            onNestedVariationChange={setSelectedNestedVariationByOption}
            onPatchOptionNestedConfig={patchOptionNestedConfig}
            onOpenOptionVariation={openOptionVariation}
            scrollToGroup={scrollToGroup}
            onClearOptionNestedForGroup={clearOptionNestedForGroup}
            onClearOptionNested={clearOptionNested}
            isNestedCollapsed={isNestedCollapsed}
            onCollapseNestedForGroup={collapseNestedForGroup}
            onExpandNestedForGroup={expandNestedForGroup}
            advanceAfterGroupComplete={advanceAfterGroupComplete}
          />

          {personalizeGroups.length > 0 ? (
            <PersonalizeOptionsSection
              groups={personalizeGroups}
              selectedByGroup={selectedPersonalizeByGroup}
              onToggle={togglePersonalizeOption}
            />
          ) : null}
        </div>
      </div>

      {rootVariationPickerOpen && rootManualVariation ? (
        <aside
          className="absolute inset-0 z-[95] flex min-h-0 flex-col justify-end bg-black/40 animate-in fade-in-0 duration-200"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-h-[min(55dvh,28rem)] shrink-0 overflow-hidden rounded-t-2xl border-t border-border bg-card p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  Select {product.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose a variation
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRootVariationPickerOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pb-2">
              {(product.variations ?? []).map((v) => {
                const selected = productVariationId === v.id;
                const variationBaseline = variationPickerBaselineUnitPrice(
                  effectiveMenuItemUnitPrice(product.price, product.salePrice),
                  product.variations
                );
                const variationPriceLabel = formatVariationAddonDisplay(
                  v.priceDelta,
                  variationBaseline
                );
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background'
                    }`}
                    onClick={() => {
                      setProductVariationId(v.id);
                      setRootVariationPickerOpen(false);
                      queueMicrotask(() => runNestedPendingFlows());
                    }}
                  >
                    <OptionThumbnail
                      imageUrl={v.imageUrl ?? product.imageUrl}
                      name={v.name ?? v.title ?? 'Variation'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {v.name ?? v.title ?? 'Variation'}
                      </p>
                      {variationPriceLabel ? (
                        <p className="text-xs text-muted-foreground">
                          {variationPriceLabel}
                        </p>
                      ) : null}
                    </div>
                    {selected ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      ) : null}

      {productRecVariationTarget ? (
        <aside
          className="absolute inset-0 z-[95] flex min-h-0 flex-col justify-end bg-black/40 animate-in fade-in-0 duration-200"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-h-[min(55dvh,28rem)] shrink-0 overflow-hidden rounded-t-2xl border-t border-border bg-card p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  Select {productRecVariationTarget.item.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose a variation
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProductRecVariationPickerGroupId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pb-2">
              {(productRecVariationTarget.item.variations ?? []).map((v) => {
                const selected = productRecVariationTarget.selectedId === v.id;
                const variationPriceLabel =
                  productRecommendationVariationPriceLabel(
                    productRecVariationTarget.item,
                    v.priceDelta
                  );
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background'
                    }`}
                    onClick={() => {
                      const groupId = productRecVariationTarget.group.id;
                      setPreselectedProductVariationByGroup((prev) => ({
                        ...prev,
                        [groupId]: v.id,
                      }));
                      setProductRecVariationPickerGroupId(null);
                      setActiveProductGroupId(groupId);
                    }}
                  >
                    <OptionThumbnail
                      imageUrl={
                        v.imageUrl ?? productRecVariationTarget.item.imageUrl
                      }
                      name={v.name ?? v.title ?? 'Variation'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {v.name ?? v.title ?? 'Variation'}
                      </p>
                      {variationPriceLabel ? (
                        <p className="text-xs text-muted-foreground">
                          {variationPriceLabel}
                        </p>
                      ) : null}
                    </div>
                    {selected ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      ) : null}

      {optionVariationTarget ? (
        <aside
          className="absolute inset-0 z-[95] flex min-h-0 flex-col justify-end bg-black/40 animate-in fade-in-0 duration-200"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-h-[min(55dvh,28rem)] shrink-0 overflow-hidden rounded-t-2xl border-t border-border bg-card p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  Select {optionVariationTarget.item.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose a variation
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOptionVariationPicker(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pb-2">
              {(optionVariationTarget.item.variations ?? []).map((v) => {
                const selected = optionVariationTarget.selectedId === v.id;
                const optionVariationBaseline = variationPickerBaselineUnitPrice(
                  effectiveMenuItemUnitPrice(
                    optionVariationTarget.item.price,
                    optionVariationTarget.item.salePrice
                  ),
                  optionVariationTarget.item.variations
                );
                const variationPriceLabel = formatVariationAddonDisplay(
                  v.priceDelta,
                  optionVariationBaseline
                );
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background'
                    }`}
                    onClick={() => {
                      const picker = optionVariationPicker!;
                      if (picker.parentOptionKey) {
                        const parentKey = picker.parentOptionKey;
                        const innerKey = optionVariationTarget.innerKey;
                        setOptionNestedConfigs((prev) => {
                          const cur =
                            prev[parentKey] ?? emptyOptionNestedConfig();
                          return {
                            ...prev,
                            [parentKey]: {
                              ...cur,
                              selectedNestedVariationByOption: {
                                ...cur.selectedNestedVariationByOption,
                                [innerKey]: v.id,
                              },
                            },
                          };
                        });
                        const hasNested =
                          (optionVariationTarget.item.nestedAttributeGroups
                            ?.length ?? 0) > 0;
                        if (hasNested) {
                          scrollToGroup(picker.groupId);
                        }
                      } else {
                        const topKey = optionVariationTarget.configKey;
                        setSelectedNestedVariationByOption((prev) => ({
                          ...prev,
                          [topKey]: v.id,
                        }));
                        const hasNested =
                          (optionVariationTarget.item.nestedAttributeGroups
                            ?.length ?? 0) > 0;
                        if (hasNested) {
                          setOptionNestedConfigs((prev) => ({
                            ...prev,
                            [topKey]: {
                              ...(prev[topKey] ?? emptyOptionNestedConfig()),
                              productVariationId: v.id,
                            },
                          }));
                          scrollToGroup(picker.groupId);
                        }
                      }
                      setOptionVariationPicker(null);
                      queueMicrotask(() => runNestedPendingFlows());
                    }}
                  >
                    <OptionThumbnail
                      imageUrl={
                        v.imageUrl ?? optionVariationTarget.item.imageUrl
                      }
                      name={v.name ?? v.title ?? 'Variation'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {v.name ?? v.title ?? 'Variation'}
                      </p>
                      {variationPriceLabel ? (
                        <p className="text-xs text-muted-foreground">
                          {variationPriceLabel}
                        </p>
                      ) : null}
                    </div>
                    {selected ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      ) : null}

      {activeProductGroup && activeProductItem ? (
        <NestedRecommendationSheet
          open
          stackClassName="z-[92]"
          parentGroupName={activeProductGroup.name}
          parentConfigurationGroup={activeProductGroup}
          baseProductVariation={configurationParentVariation}
          baseProductVariationShortLabel={baseProductVariationShortLabel}
          product={activeProductItem}
          attributeGroups={activeProductItem.nestedAttributeGroups ?? []}
          initialProductVariationId={
            preselectedProductVariationByGroup[activeProductGroup.id]
          }
          onClose={() => setActiveProductGroupId(null)}
          onDone={(result) => {
            const groupId = activeProductGroup.id;
            if (result.productVariationId) {
              setPreselectedProductVariationByGroup((prev) => ({
                ...prev,
                [groupId]: result.productVariationId,
              }));
            }
            setProductGroupConfigs((prev) => ({
              ...prev,
              [groupId]: result,
            }));
            setActiveProductGroupId(null);
          }}
        />
      ) : null}

      <footer className="shrink-0 border-t border-border px-4 py-4">
        <Button
          type="button"
          className="h-12 w-full rounded-xl font-bold"
          disabled={requiredMissing}
          onClick={handleDone}
        >
          Select
        </Button>
      </footer>
    </div>
  );
}
