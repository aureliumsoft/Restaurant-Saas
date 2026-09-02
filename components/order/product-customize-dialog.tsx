'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { ConfigurationSelectSummary } from '@/components/order/configuration-select-summary';
import { LazyMenuProductImage } from '@/components/menu/lazy-menu-product-image';
import {
  NestedRecommendationSheet,
  type NestedRecommendationResult,
} from '@/components/order/nested-recommendation-sheet';
import {
  buildCategoryGroupSelectionSummary,
  buildProductRecSelectionSummary,
} from '@/lib/menu/configuration-selection-summary';
import { modifierSelectionsUnitTotal } from '@/lib/menu/build-modifier-selections';
import { buildConfirmModifierSelections } from '@/lib/menu/build-confirm-modifier-selections';
import {
  appendSelectionTimeline,
  removeSelectionTimeline,
  removeSelectionTimelinePrefix,
  selectionTimelineKeys,
} from '@/lib/menu/selection-timeline';
import { buildPersonalizeModifierSelections } from '@/lib/menu/personalize-modifiers';
import {
  PersonalizeOptionsSection,
  type PersonalizeGroup,
} from '@/components/order/personalize-options-section';
import { buildCustomerLightSurfaceVars } from '@/lib/restaurant-theme';
import type { RestaurantRegionalSettings } from '@/lib/restaurant-regional';
import {
  chargeableUnitsForOptionInGroup,
  getRecommendationLimits,
  hasQuantityFreeTier,
  totalSelectedUnits,
} from '@/lib/menu/recommendation-limits';
import {
  configurationChargeableAddonUnit,
  configurationDefaultListUnitPriceForSelection,
  configurationGroupDisplayTitle,
  configurationItemListUnitPriceForGroup,
  configurationItemResolvedListUnit,
  filterConfigurationItemsForGroup,
  configurationAddonPriceLabel,
  isConfigurationGroupVisibleForFilters,
  isConfigurationItemAvailableForParentVariation,
  isConfigurationItemAvailableForDefaultLinkedVariation,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import {
  chargeableVariationUnitPrice,
  formatVariationAddonDisplay,
  productRecommendationVariationPriceLabel,
  productRecommendationVariationUnitPrice,
  productUnitPriceWithVariation,
  variationPickerBaselineUnitPrice,
} from '@/lib/menu/recommendation-addon-price';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import {
  clearOptionDataForGroup,
  clearOptionDataForKey,
  effectiveOptionVariationId,
  isOptionConfigComplete,
  optionNeedsManualVariationPicker,
  optionSelectionKey,
  recommendedProductNeedsSheet,
  recommendationOptionNeedsSheet,
  resolveCategoryItemVariationId,
  resolveProductRecommendationVariationId,
  shouldAutoOpenOptionFlow,
  syncParentVariationOptionSelections,
} from '@/lib/menu/recommendation-option-utils';

export type MenuOption = {
  menuItemId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  unitPrice: number;
};

export type AttributeGroup = {
  id: string;
  name: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  sourceType?: 'CATEGORY' | 'PRODUCT';
  multipleMode?: 'CHECKBOX' | 'QUANTITY';
  freeQuantity?: number | null;
  categoryDiscountPercent?: number | null;
  required: boolean;
  minItems?: number | null;
  maxItems?: number | null;
  variationLimits?: {
    variationId: string;
    minItems: number;
    maxItems: number;
  }[];
  linkedCategoryName?: string | null;
  /** Baseline item for delta pricing (category configurations). */
  defaultMenuItemId?: string | null;
  defaultUnitPrice?: number | null;
  /** When true, item prices follow the guest's selected base-product variation. */
  useVariationPricing?: boolean;
  /** Fixed restaurant variation tier for linked category items (e.g. Medium only). */
  defaultLinkedRestaurantVariationId?: string | null;
  /** When false with a default variation, guests see base item price only. */
  includeDefaultLinkedVariationPrice?: boolean;
  items: (Omit<MenuOption, 'unitPrice'> & {
    price: number;
    salePrice: number | null;
    variations?: {
      id: string;
      name?: string;
      title?: string;
      swatchHex?: string | null;
      imageUrl?: string | null;
      priceDelta: number;
      restaurantVariationId?: string | null;
    }[];
    nestedAttributeGroups?: AttributeGroup[];
    personalizeGroups?: PersonalizeGroup[];
  })[];
};

export type ProductVariationOption = {
  id: string;
  name: string;
  imageUrl?: string | null;
  swatchHex: string | null;
  priceDelta: number; // stored field; interpreted as absolute override price
  restaurantVariationId?: string | null;
  variationShortLabel?: string | null;
};

export type SelectedProductVariation = {
  id: string;
  name: string;
  swatchHex: string | null;
  priceDelta: number; // absolute selected unit price
};

function effectiveUnitPrice(price: number, salePrice: number | null) {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
}

function visibleConfigurationItems(
  group: AttributeGroup,
  parentVariation: ParentVariationContext | null
) {
  return filterConfigurationItemsForGroup(group.items, {
    parentVariation,
    useVariationPricing: group.useVariationPricing ?? false,
    defaultLinkedRestaurantVariationId:
      group.defaultLinkedRestaurantVariationId,
  });
}

function configurationItemPickerPrice(
  item: AttributeGroup['items'][number],
  group: AttributeGroup,
  parentVariation: ParentVariationContext | null,
  groupSelectedIds: string[],
  selectedNestedVariationByOption: Record<string, string>,
  regional?: Partial<RestaurantRegionalSettings>
) {
  const visible = visibleConfigurationItems(group, parentVariation);
  const optionKey = optionSelectionKey(group.id, item.menuItemId);
  const nestedVariationId = effectiveOptionVariationId(
    item,
    optionKey,
    selectedNestedVariationByOption,
    {},
    { group, parentVariation }
  );
  const nestedVariation = nestedVariationId
    ? (item.variations ?? []).find((v) => v.id === nestedVariationId)
    : undefined;
  const listUnit =
    group.defaultLinkedRestaurantVariationId &&
    !(group.useVariationPricing ?? false)
      ? configurationItemListUnitPriceForGroup(item, {
          defaultLinkedRestaurantVariationId:
            group.defaultLinkedRestaurantVariationId,
          includeDefaultLinkedVariationPrice:
            group.includeDefaultLinkedVariationPrice,
        })
      : configurationItemResolvedListUnit(
          item,
          parentVariation,
          group.useVariationPricing ?? false,
          nestedVariationId
        );
  const defaultListUnit = configurationDefaultListUnitPriceForSelection(
    group,
    parentVariation,
    visible,
    nestedVariation ?? null
  );
  const itemQty = groupSelectedIds.filter(
    (id) => id === item.menuItemId
  ).length;
  const unitCharge = configurationChargeableAddonUnit(
    listUnit,
    defaultListUnit,
    group.categoryDiscountPercent
  );
  const chargeableQty =
    group.multipleMode === 'QUANTITY'
      ? chargeableUnitsForOptionInGroup(
          groupSelectedIds,
          item.menuItemId,
          group.freeQuantity
        )
      : itemQty > 0
        ? 1
        : 0;
  return {
    price: unitCharge * chargeableQty,
    priceLabel: configurationAddonPriceLabel(listUnit, defaultListUnit, {
      freeQuantity: group.freeQuantity,
      multipleMode: group.multipleMode,
      groupSelectedIds,
      optionId: item.menuItemId,
      regional,
      categoryDiscountPercent: group.categoryDiscountPercent,
    }),
  };
}

function multiSelectionHint(
  minItems: number | null | undefined,
  maxItems: number | null | undefined
): string {
  if (minItems != null && maxItems != null) {
    return `Choose ${minItems}–${maxItems} options`;
  }
  if (minItems != null) return `Choose at least ${minItems}`;
  if (maxItems != null) return `Choose up to ${maxItems}`;
  return 'Choose one or more';
}

function groupSelectionCount(selectedIds: string[]) {
  return selectedIds.length;
}

type Props = {
  productName: string;
  productImageUrl?: string | null;
  productBaseUnitPrice: number;
  productDescription?: string | null;
  themePrimaryColor?: string | null;
  attributeGroups: AttributeGroup[];
  personalizeGroups?: PersonalizeGroup[];
  variations?: ProductVariationOption[];
  open: boolean;
  /** When true, sheet is open but recommendation data is still loading. */
  isLoading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    mods: {
    attributeGroupId: string;
    groupName: string;
    selections: MenuOption[];
    }[],
    variation?: SelectedProductVariation | null,
    quantity?: number
  ) => void;
};

export function ProductCustomizeDialog({
  productName,
  productImageUrl,
  productBaseUnitPrice,
  productDescription,
  themePrimaryColor,
  attributeGroups,
  personalizeGroups = [],
  variations = [],
  open,
  isLoading = false,
  onOpenChange,
  onConfirm,
}: Props) {
  const { formatMoney, regional } = useRestaurantRegional(undefined);
  const variationPickerBaseline = useMemo(
    () => variationPickerBaselineUnitPrice(productBaseUnitPrice, variations),
    [productBaseUnitPrice, variations]
  );

  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<string, string[]>
  >({});
  const [selectedPersonalizeByGroup, setSelectedPersonalizeByGroup] = useState<
    Record<string, string[]>
  >({});
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [selectedNestedVariationByOption, setSelectedNestedVariationByOption] =
    useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [picker, setPicker] = useState<
    | null
    | { kind: 'variation' }
    | { kind: 'group-single'; groupId: string }
    | { kind: 'group-multi'; groupId: string }
    | { kind: 'nested'; groupId: string; optionId: string }
    | { kind: 'recommendation-product-variation'; groupId: string }
  >(null);
  const [nestedConfigs, setNestedConfigs] = useState<
    Record<string, NestedRecommendationResult>
  >({});
  const [
    preselectedRecommendationVariationByGroup,
    setPreselectedRecommendationVariationByGroup,
  ] = useState<Record<string, string>>({});
  const [activeProductGroupId, setActiveProductGroupId] = useState<
    string | null
  >(null);
  const [nestedOptionConfigs, setNestedOptionConfigs] = useState<
    Record<string, NestedRecommendationResult>
  >({});
  const [activeCategoryOption, setActiveCategoryOption] = useState<{
    groupId: string;
    optionId: string;
  } | null>(null);
  const [selectionTimeline, setSelectionTimeline] = useState<string[]>([]);

  const categoryGroups = useMemo(
    () => attributeGroups.filter((g) => g.sourceType !== 'PRODUCT'),
    [attributeGroups]
  );
  const productRecommendationGroups = useMemo(
    () => attributeGroups.filter((g) => g.sourceType === 'PRODUCT'),
    [attributeGroups]
  );

  const baseProductVariationContext = useMemo(() => {
    const v = variations.find((x) => x.id === selectedVariationId);
    if (!v) {
      return {
        parent: null as ParentVariationContext | null,
        shortLabel: null as string | null,
      };
    }
    return {
      parent: {
        id: v.id,
        name: v.name,
        title: v.name,
        restaurantVariationId: v.restaurantVariationId ?? null,
      },
      shortLabel: v.variationShortLabel ?? null,
    };
  }, [variations, selectedVariationId]);

  const visibleCategoryGroups = useMemo(
    () =>
      categoryGroups.filter((g) =>
        isConfigurationGroupVisibleForFilters(
          g,
          baseProductVariationContext.parent
        )
      ),
    [categoryGroups, baseProductVariationContext.parent]
  );

  const visibleProductRecommendationGroups = useMemo(
    () =>
      productRecommendationGroups.filter((g) => {
        const item = g.items[0];
        if (!item) return false;
        return isConfigurationItemAvailableForParentVariation(
          item,
          baseProductVariationContext.parent,
          g.useVariationPricing ?? false
        );
      }),
    [productRecommendationGroups, baseProductVariationContext.parent]
  );

  useEffect(() => {
    const parent = baseProductVariationContext.parent;
    setSelectedByGroup((prev) => {
      let changed = false;
      const next: Record<string, string[]> = { ...prev };
      for (const g of categoryGroups) {
        const usesParent = g.useVariationPricing ?? false;
        const usesDefaultLinked = Boolean(g.defaultLinkedRestaurantVariationId);
        if (!usesParent && !usesDefaultLinked) continue;
        const allowed = new Set(
          filterConfigurationItemsForGroup(g.items, {
            parentVariation: parent,
            useVariationPricing: usesParent,
            defaultLinkedRestaurantVariationId:
              g.defaultLinkedRestaurantVariationId,
          }).map((it) => it.menuItemId)
        );
        const cur = prev[g.id] ?? [];
        const filtered = cur.filter((id) => allowed.has(id));
        if (filtered.length !== cur.length) {
          next[g.id] = filtered;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [baseProductVariationContext.parent, categoryGroups, selectedVariationId]);

  useEffect(() => {
    const parent = baseProductVariationContext.parent;
    setPreselectedRecommendationVariationByGroup((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of productRecommendationGroups) {
        if (!g.useVariationPricing) continue;
        const item = g.items[0];
        if (!item) continue;
        const resolved = resolveCategoryItemVariationId(item, parent, g);
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
        parent,
        prev
      );
      return synced ?? prev;
    });
    setNestedOptionConfigs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, config] of Object.entries(prev)) {
        const [groupId, optionId] = key.split(':');
        const group = categoryGroups.find((g) => g.id === groupId);
        const item = group?.items.find((it) => it.menuItemId === optionId);
        if (!item?.nestedAttributeGroups?.length) continue;
        const synced = syncParentVariationOptionSelections(
          item.nestedAttributeGroups,
          config.selectedByGroup,
          parent,
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
    baseProductVariationContext.parent,
    categoryGroups,
    productRecommendationGroups,
    selectedByGroup,
    selectedVariationId,
  ]);

  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

  const limitsForGroup = useCallback(
    (group: AttributeGroup) =>
      getRecommendationLimits(
        {
          selectionType: group.selectionType,
          minItems: group.minItems ?? null,
          maxItems: group.maxItems ?? null,
          variationLimits: group.variationLimits,
        },
        selectedVariationId || null
      ),
    [selectedVariationId]
  );

  const scrollToGroup = (groupId: string) => {
    const el = groupRefs.current[groupId];
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const advanceAfterGroupComplete = (
    groupId: string,
    nextSelectedByGroup: Record<string, string[]>
  ) => {
    const idx = visibleCategoryGroups.findIndex((g) => g.id === groupId);
    for (let i = idx + 1; i < visibleCategoryGroups.length; i++) {
      const next = visibleCategoryGroups[i]!;
      const limits = limitsForGroup(next);
      const count = totalSelectedUnits(nextSelectedByGroup[next.id] ?? []);
      if (count < limits.maxItems) {
        scrollToGroup(next.id);
        setPicker(
          next.selectionType === 'SINGLE'
            ? { kind: 'group-single', groupId: next.id }
            : { kind: 'group-multi', groupId: next.id }
        );
        return;
      }
    }
    applyNextPendingPicker(
      selectedVariationId,
      nextSelectedByGroup,
      selectedNestedVariationByOption,
      {
        nestedConfigs,
        preselectedByGroup: preselectedRecommendationVariationByGroup,
        optionNestedConfigs: nestedOptionConfigs,
      }
    );
  };

  const getNextPendingPicker = (
    nextVariationId: string,
    nextSelectedByGroup: Record<string, string[]>,
    nextNested: Record<string, string>,
    productRecState?: {
      nestedConfigs: Record<string, NestedRecommendationResult>;
      preselectedByGroup: Record<string, string>;
      optionNestedConfigs?: Record<string, NestedRecommendationResult>;
    }
  ):
    | null
    | { kind: 'variation' }
    | { kind: 'group-single'; groupId: string }
    | { kind: 'group-multi'; groupId: string }
    | { kind: 'nested'; groupId: string; optionId: string }
    | { kind: 'recommendation-product-variation'; groupId: string }
    | { kind: 'recommendation-product-sheet'; groupId: string }
    | { kind: 'category-option-sheet'; groupId: string; optionId: string } => {
    if (variations.length > 0 && !nextVariationId) {
      return { kind: 'variation' };
    }

    if (productRecState) {
      for (const g of visibleProductRecommendationGroups) {
        const item = g.items[0];
        if (!item) continue;
        if (g.useVariationPricing) {
          const resolved = resolveCategoryItemVariationId(
            item,
            baseProductVariationContext.parent,
            g
          );
          if (!resolved) continue;
          if (productRecState.nestedConfigs[g.id]) continue;
          if (recommendedProductNeedsSheet(g)) {
            return { kind: 'recommendation-product-sheet', groupId: g.id };
          }
          continue;
        }
        if (!recommendedProductNeedsSheet(g)) continue;
        if (productRecState.nestedConfigs[g.id]) continue;
        if (
          optionNeedsManualVariationPicker(item, g) &&
          !productRecState.preselectedByGroup[g.id]
        ) {
          return {
            kind: 'recommendation-product-variation',
            groupId: g.id,
          };
        }
        return { kind: 'recommendation-product-sheet', groupId: g.id };
      }
    }

    for (const g of visibleCategoryGroups) {
      const selectedIds = nextSelectedByGroup[g.id] ?? [];
      if (selectedIds.length === 0 && g.required) {
        if (g.selectionType === 'SINGLE') {
          return { kind: 'group-single', groupId: g.id };
        }
        return { kind: 'group-multi', groupId: g.id };
      }
      if (selectedIds.length === 0 && g.selectionType === 'MULTIPLE') {
        continue;
      }
      if (selectedIds.length === 0) {
        return { kind: 'group-single', groupId: g.id };
      }
      const optionsToCheck =
        g.selectionType === 'SINGLE' ? selectedIds.slice(0, 1) : selectedIds;
      for (const optionId of optionsToCheck) {
        const selectedOption = g.items.find((it) => it.menuItemId === optionId);
        if (!selectedOption) continue;
        const key = optionSelectionKey(g.id, selectedOption.menuItemId);
        const optionCtx = {
          group: g,
          parentVariation: baseProductVariationContext.parent,
        };
        if (
          !recommendationOptionNeedsSheet(selectedOption, g) ||
          isOptionConfigComplete(
            selectedOption,
            key,
            nextNested,
            productRecState?.optionNestedConfigs ?? {},
            optionCtx
          )
        ) {
          continue;
        }
        if (
          optionNeedsManualVariationPicker(selectedOption, g) &&
          !nextNested[key]
        ) {
          return {
            kind: 'nested',
            groupId: g.id,
            optionId: selectedOption.menuItemId,
          };
        }
        return {
          kind: 'category-option-sheet',
          groupId: g.id,
          optionId: selectedOption.menuItemId,
        };
      }
    }

    return null;
  };

  const applyNextPendingPicker = (
    nextVariationId: string,
    nextSelectedByGroup: Record<string, string[]>,
    nextNested: Record<string, string>,
    productRecState?: {
      nestedConfigs: Record<string, NestedRecommendationResult>;
      preselectedByGroup: Record<string, string>;
      optionNestedConfigs?: Record<string, NestedRecommendationResult>;
    }
  ) => {
    const next = getNextPendingPicker(
      nextVariationId,
      nextSelectedByGroup,
      nextNested,
      productRecState
    );
    if (next?.kind === 'recommendation-product-sheet') {
      setPicker(null);
      setActiveCategoryOption(null);
      setActiveProductGroupId(next.groupId);
      return;
    }
    if (next?.kind === 'category-option-sheet') {
      setPicker(null);
      setActiveProductGroupId(null);
      setActiveCategoryOption({
        groupId: next.groupId,
        optionId: next.optionId,
      });
      return;
    }
    if (next?.kind === 'recommendation-product-variation') {
      const group = productRecommendationGroups.find((g) => g.id === next.groupId);
      const item = group?.items[0];
      if (group?.useVariationPricing && item) {
        setPicker(null);
        if (recommendedProductNeedsSheet(group)) {
          setActiveProductGroupId(next.groupId);
        }
        return;
      }
      setActiveProductGroupId(null);
      setActiveCategoryOption(null);
    }
    if (next?.kind === 'nested') {
      const group = categoryGroups.find((g) => g.id === next.groupId);
      const item = group?.items.find((it) => it.menuItemId === next.optionId);
      if (group && item && !optionNeedsManualVariationPicker(item, group)) {
        if ((item.nestedAttributeGroups?.length ?? 0) > 0) {
          setPicker(null);
          setActiveCategoryOption({
            groupId: next.groupId,
            optionId: next.optionId,
          });
          return;
        }
        setPicker(null);
        return;
      }
    }
    setPicker(next);
  };

  const openCategoryOptionFlow = useCallback(
    (groupId: string, optionId: string) => {
      const group = categoryGroups.find((g) => g.id === groupId);
      const item = group?.items.find((it) => it.menuItemId === optionId);
      if (!item || !recommendationOptionNeedsSheet(item, group)) return;
      setActiveProductGroupId(null);
      setActiveCategoryOption(null);
      if (optionNeedsManualVariationPicker(item, group)) {
        setPicker({ kind: 'nested', groupId, optionId });
        return;
      }
      setActiveCategoryOption({ groupId, optionId });
    },
    [categoryGroups]
  );

  useEffect(() => {
    if (!open) return;
    if (isLoading) {
      setPicker(null);
      setActiveProductGroupId(null);
      setActiveCategoryOption(null);
      return;
    }
    const init: Record<string, string[]> = {};
    for (const g of categoryGroups) init[g.id] = [];
    setSelectedByGroup(init);
    const personalizeInit: Record<string, string[]> = {};
    for (const g of personalizeGroups) personalizeInit[g.id] = [];
    setSelectedPersonalizeByGroup(personalizeInit);
    setSelectedVariationId('');
    setSelectedNestedVariationByOption({});
    setQuantity(1);
    setNestedConfigs({});
    setPreselectedRecommendationVariationByGroup({});
    setActiveProductGroupId(null);
    setNestedOptionConfigs({});
    setActiveCategoryOption(null);
    setSelectionTimeline([]);
    const autoNested: Record<string, NestedRecommendationResult> = {};
    for (const g of productRecommendationGroups) {
      if (!recommendedProductNeedsSheet(g)) {
        autoNested[g.id] = {
          productVariationId: '',
          selectedByGroup: {},
          selectedNestedVariationByOption: {},
          mods: [],
        };
      }
    }
    setNestedConfigs(autoNested);
    applyNextPendingPicker(
      '',
      init,
      {},
      {
        nestedConfigs: autoNested,
        preselectedByGroup: {},
        optionNestedConfigs: {},
      }
    );
  }, [open, isLoading, categoryGroups, productRecommendationGroups, personalizeGroups]);

  const requiredMissing = useMemo(() => {
    if (isLoading) return true;
    const missingProductRecs = visibleProductRecommendationGroups.some((g) => {
      if (!g.required) return false;
      if (!recommendedProductNeedsSheet(g)) return false;
      return !nestedConfigs[g.id];
    });
    const missingAttrs = visibleCategoryGroups.some((g) => {
      const count = totalSelectedUnits(selectedByGroup[g.id] ?? []);
      if (g.selectionType === 'SINGLE') {
        return g.required && count === 0;
      }
      const min = limitsForGroup(g).minItems ?? (g.required ? 1 : 0);
      if (g.required && count < min) return true;
      if (count > 0 && min > 0 && count < min) return true;
      if (count > limitsForGroup(g).maxItems) return true;
      return false;
    });
    const missingVariation = variations.length > 0 && !selectedVariationId;
    const missingCategoryOptionConfig = visibleCategoryGroups.some((g) => {
      const selectedIds = selectedByGroup[g.id] ?? [];
      const ids =
        g.selectionType === 'SINGLE' ? selectedIds.slice(0, 1) : selectedIds;
      return ids.some((optionId) => {
        const option = g.items.find((it) => it.menuItemId === optionId);
        if (!option) return false;
        return !isOptionConfigComplete(
          option,
          optionSelectionKey(g.id, optionId),
          selectedNestedVariationByOption,
          nestedOptionConfigs,
          {
            group: g,
            parentVariation: baseProductVariationContext.parent,
          }
        );
      });
    });
    return (
      missingProductRecs ||
      missingAttrs ||
      missingVariation ||
      missingCategoryOptionConfig
    );
  }, [
    isLoading,
    visibleCategoryGroups,
    visibleProductRecommendationGroups,
    nestedConfigs,
    nestedOptionConfigs,
    selectedByGroup,
    variations,
    selectedVariationId,
    selectedNestedVariationByOption,
    limitsForGroup,
    baseProductVariationContext.parent,
  ]);

  const clearCategoryGroupOptionData = useCallback((groupId: string) => {
    setSelectionTimeline((prev) =>
      removeSelectionTimelinePrefix(prev, `cat:${groupId}:`)
    );
    setNestedOptionConfigs(
      (prev) => clearOptionDataForGroup(groupId, prev, {}).configs
    );
    setSelectedNestedVariationByOption((prevVar) => {
      const next = { ...prevVar };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${groupId}:`)) delete next[key];
      }
      return next;
    });
    setActiveCategoryOption((cur) => (cur?.groupId === groupId ? null : cur));
  }, []);

  const setSingle = (groupId: string, optionId: string) => {
    clearCategoryGroupOptionData(groupId);
    setSelectedByGroup((prev) => {
      const previousOption = prev[groupId]?.[0];
      const isDeselect = previousOption === optionId;
      setSelectionTimeline((timeline) => {
        let next = timeline;
        if (previousOption) {
          next = removeSelectionTimeline(
            next,
            selectionTimelineKeys.categoryOption(groupId, previousOption)
          );
        }
        if (!isDeselect) {
          next = appendSelectionTimeline(
            next,
            selectionTimelineKeys.categoryOption(groupId, optionId)
          );
        }
        return next;
      });
      return {
        ...prev,
        [groupId]: isDeselect ? [] : [optionId],
      };
    });
  };

  const toggleMultiCheckbox = (group: AttributeGroup, optionId: string) => {
    setSelectedByGroup((prev) => {
      const cur = prev[group.id] ?? [];
      const limits = limitsForGroup(group);
      if (cur.includes(optionId)) {
        const key = optionSelectionKey(group.id, optionId);
        const cleared = clearOptionDataForKey(
          key,
          nestedOptionConfigs,
          selectedNestedVariationByOption
        );
        setNestedOptionConfigs(cleared.configs);
        setSelectedNestedVariationByOption(cleared.variations);
        setActiveCategoryOption((curOpt) =>
          curOpt?.groupId === group.id && curOpt?.optionId === optionId
            ? null
            : curOpt
        );
        setSelectionTimeline((timeline) =>
          removeSelectionTimeline(
            timeline,
            selectionTimelineKeys.categoryOption(group.id, optionId)
          )
        );
        return {
          ...prev,
          [group.id]: cur.filter((x) => x !== optionId),
        };
      }
      const key = optionSelectionKey(group.id, optionId);
      setNestedOptionConfigs((prevCfg) => {
        const next = { ...prevCfg };
        delete next[key];
        return next;
      });
      setSelectedNestedVariationByOption((prevVar) => {
        const next = { ...prevVar };
        delete next[key];
        return next;
      });
      if (totalSelectedUnits(cur) >= limits.maxItems) {
        advanceAfterGroupComplete(group.id, prev);
        return prev;
      }
      const next = { ...prev, [group.id]: [...cur, optionId] };
      const item = group.items.find((it) => it.menuItemId === optionId);
      if (item && recommendationOptionNeedsSheet(item, group)) {
        queueMicrotask(() => openCategoryOptionFlow(group.id, optionId));
      }
      setSelectionTimeline((timeline) =>
        appendSelectionTimeline(
          timeline,
          selectionTimelineKeys.categoryOption(group.id, optionId)
        )
      );
      if (totalSelectedUnits(next[group.id]!) >= limits.maxItems) {
        queueMicrotask(() => advanceAfterGroupComplete(group.id, next));
      }
      return next;
    });
  };

  const increaseMultiQty = (group: AttributeGroup, optionId: string) => {
    setSelectedByGroup((prev) => {
      const cur = prev[group.id] ?? [];
      const limits = limitsForGroup(group);
      if (totalSelectedUnits(cur) >= limits.maxItems) {
        advanceAfterGroupComplete(group.id, prev);
        return prev;
      }
      const isFirstUnit = cur.filter((id) => id === optionId).length === 0;
      if (isFirstUnit) {
        const key = optionSelectionKey(group.id, optionId);
        setNestedOptionConfigs((prevCfg) => {
          const nextCfg = { ...prevCfg };
          delete nextCfg[key];
          return nextCfg;
        });
        setSelectedNestedVariationByOption((prevVar) => {
          const nextVar = { ...prevVar };
          delete nextVar[key];
          return nextVar;
        });
      }
      const next = { ...prev, [group.id]: [...cur, optionId] };
      const item = group.items.find((it) => it.menuItemId === optionId);
      if (isFirstUnit && item && recommendationOptionNeedsSheet(item, group)) {
        queueMicrotask(() => openCategoryOptionFlow(group.id, optionId));
      }
      if (isFirstUnit) {
        setSelectionTimeline((timeline) =>
          appendSelectionTimeline(
            timeline,
            selectionTimelineKeys.categoryOption(group.id, optionId)
          )
        );
      }
      if (totalSelectedUnits(next[group.id]!) >= limits.maxItems) {
        queueMicrotask(() => advanceAfterGroupComplete(group.id, next));
      }
      return next;
    });
  };

  const togglePersonalizeOption = (groupId: string, optionId: string) => {
    const group = personalizeGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSelectedPersonalizeByGroup((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId)) {
        setSelectionTimeline((timeline) =>
          removeSelectionTimeline(
            timeline,
            selectionTimelineKeys.personalize(groupId, optionId)
          )
        );
        return {
          ...prev,
          [groupId]: cur.filter((id) => id !== optionId),
        };
      }
      if (cur.length >= group.maxItems) return prev;
      setSelectionTimeline((timeline) =>
        appendSelectionTimeline(
          timeline,
          selectionTimelineKeys.personalize(groupId, optionId)
        )
      );
      return { ...prev, [groupId]: [...cur, optionId] };
    });
  };

  const decreaseMultiQty = (groupId: string, optionId: string) => {
    setSelectedByGroup((prev) => {
      const current = [...(prev[groupId] ?? [])];
      const idx = current.lastIndexOf(optionId);
      if (idx < 0) return prev;
      current.splice(idx, 1);
      const remainingQty = current.filter((id) => id === optionId).length;
      if (remainingQty === 0) {
        const key = optionSelectionKey(groupId, optionId);
        const cleared = clearOptionDataForKey(
          key,
          nestedOptionConfigs,
          selectedNestedVariationByOption
        );
        setNestedOptionConfigs(cleared.configs);
        setSelectedNestedVariationByOption(cleared.variations);
        setActiveCategoryOption((curOpt) =>
          curOpt?.groupId === groupId && curOpt?.optionId === optionId
            ? null
            : curOpt
        );
        setSelectionTimeline((timeline) =>
          removeSelectionTimeline(
            timeline,
            selectionTimelineKeys.categoryOption(groupId, optionId)
          )
        );
      }
      return { ...prev, [groupId]: current };
    });
  };

  const handleConfirm = () => {
    if (requiredMissing) return;

    const mods = buildConfirmModifierSelections({
      visibleCategoryGroups,
      selectedByGroup,
      selectedNestedVariationByOption,
      nestedOptionConfigs,
      visibleProductRecommendationGroups,
      nestedConfigs,
      preselectedRecommendationVariationByGroup,
      personalizeGroups,
      selectedPersonalizeByGroup,
      parentVariation: baseProductVariationContext.parent,
      parentVariationShortLabel: baseProductVariationContext.shortLabel,
      selectionTimeline,
      allGroupsFlat: attributeGroups,
    });

    const selectedVariation =
      variations.find((v) => v.id === selectedVariationId) ?? null;
    const variation = selectedVariation
      ? {
          id: selectedVariation.id,
          name: selectedVariation.name,
          swatchHex: selectedVariation.swatchHex,
          priceDelta: productUnitPriceWithVariation(
            productBaseUnitPrice,
            selectedVariation.priceDelta,
            variations
          ),
        }
      : null;
    onConfirm(mods, variation, quantity);
  };

  const decreaseGroupSelection = (
    group: AttributeGroup,
    selectedIds: string[]
  ) => {
    if (selectedIds.length === 0) return;
    if (group.selectionType === 'SINGLE') {
      setSelectedByGroup((prev) => ({ ...prev, [group.id]: [] }));
      setSelectedNestedVariationByOption((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${group.id}:`)) delete next[key];
        }
        return next;
      });
      return;
    }
    const removeId = selectedIds[selectedIds.length - 1]!;
    setSelectionTimeline((timeline) =>
      removeSelectionTimeline(
        timeline,
        selectionTimelineKeys.categoryOption(group.id, removeId)
      )
    );
    setSelectedByGroup((prev) => ({
      ...prev,
      [group.id]: (prev[group.id] ?? []).filter((id) => id !== removeId),
    }));
    setSelectedNestedVariationByOption((prev) => {
      const next = { ...prev };
      delete next[`${group.id}:${removeId}`];
      return next;
    });
  };

  const openGroupSelection = (group: AttributeGroup) => {
    if (group.selectionType === 'SINGLE') {
      setPicker({ kind: 'group-single', groupId: group.id });
      return;
    }
    setPicker({ kind: 'group-multi', groupId: group.id });
  };

  const openCategoryGroupSelect = (group: AttributeGroup) => {
    setActiveProductGroupId(null);
    setActiveCategoryOption(null);
    openGroupSelection(group);
  };

  const selectedUnitTotal = useMemo(() => {
    const selectedVariation = variations.find(
      (v) => v.id === selectedVariationId
    );
    const base = productUnitPriceWithVariation(
      productBaseUnitPrice,
      selectedVariation?.priceDelta,
      variations
    );
    const mods = buildConfirmModifierSelections({
      visibleCategoryGroups,
      selectedByGroup,
      selectedNestedVariationByOption,
      nestedOptionConfigs,
      visibleProductRecommendationGroups,
      nestedConfigs,
      preselectedRecommendationVariationByGroup,
      personalizeGroups,
      selectedPersonalizeByGroup,
      parentVariation: baseProductVariationContext.parent,
      parentVariationShortLabel: baseProductVariationContext.shortLabel,
      selectionTimeline,
      allGroupsFlat: attributeGroups,
    });

    return base + modifierSelectionsUnitTotal(mods);
  }, [
    attributeGroups,
    baseProductVariationContext,
    nestedConfigs,
    nestedOptionConfigs,
    personalizeGroups,
    preselectedRecommendationVariationByGroup,
    productBaseUnitPrice,
    selectedByGroup,
    selectedNestedVariationByOption,
    selectedPersonalizeByGroup,
    selectedVariationId,
    selectionTimeline,
    variations,
    visibleCategoryGroups,
    visibleProductRecommendationGroups,
  ]);

  const dialogVars = useMemo(
    () => buildCustomerLightSurfaceVars(themePrimaryColor) as CSSProperties,
    [themePrimaryColor]
  );

  const basePriceLabel = formatMoney(productBaseUnitPrice);

  const productRecPickerContext = () => ({
    nestedConfigs,
    preselectedByGroup: preselectedRecommendationVariationByGroup,
    optionNestedConfigs: nestedOptionConfigs,
  });

  const activeCategoryOptionTarget = useMemo(() => {
    if (!activeCategoryOption) return null;
    const group = categoryGroups.find(
      (g) => g.id === activeCategoryOption.groupId
    );
    const item = group?.items.find(
      (it) => it.menuItemId === activeCategoryOption.optionId
    );
    if (!group || !item) return null;
    return {
      group,
      item,
      key: optionSelectionKey(
        activeCategoryOption.groupId,
        activeCategoryOption.optionId
      ),
    };
  }, [activeCategoryOption, categoryGroups]);

  const pickerTitle = useMemo(() => {
    if (!picker) return '';
    if (picker.kind === 'variation') return 'Select variation';
    if (picker.kind === 'recommendation-product-variation') {
      const group = productRecommendationGroups.find(
        (g) => g.id === picker.groupId
      );
      const item = group?.items[0];
      return item ? `Select ${item.name}` : 'Select variation';
    }
    if (picker.kind === 'group-single') {
      const group = categoryGroups.find((g) => g.id === picker.groupId);
      return group ? `Select ${group.name}` : 'Select option';
    }
    if (picker.kind === 'group-multi') {
      const group = categoryGroups.find((g) => g.id === picker.groupId);
      return group ? `Select ${group.name}` : 'Select options';
    }
    const group = categoryGroups.find((g) => g.id === picker.groupId);
    const item = group?.items.find((i) => i.menuItemId === picker.optionId);
    return item ? `Select ${item.name} variation` : 'Select variation';
  }, [categoryGroups, picker, productRecommendationGroups]);

  const pickerSubtitle = useMemo(() => {
    if (picker?.kind === 'recommendation-product-variation') {
      return 'Choose a variation first';
    }
    if (!picker || picker.kind !== 'group-multi') return null;
    const group = categoryGroups.find((g) => g.id === picker.groupId);
    if (!group) return null;
    const limits = limitsForGroup(group);
    const count = totalSelectedUnits(selectedByGroup[group.id] ?? []);
    const hint = multiSelectionHint(limits.minItems, limits.maxItems);
    const progress = ` · Selected ${count} / ${limits.maxItems}`;
    return `${hint}${progress}`;
  }, [categoryGroups, limitsForGroup, picker, selectedByGroup]);

  const activeProductGroup = productRecommendationGroups.find(
    (g) => g.id === activeProductGroupId
  );
  const activeProductItem = activeProductGroup?.items[0];

  const openRecommendationGroup = (groupId: string) => {
    const group = productRecommendationGroups.find((g) => g.id === groupId);
    const item = group?.items[0];
    if (!group || !item) return;
    setActiveCategoryOption(null);
    setActiveProductGroupId(null);
    if (group.useVariationPricing) {
      setActiveProductGroupId(groupId);
      return;
    }
    if (optionNeedsManualVariationPicker(item, group)) {
      setPicker({ kind: 'recommendation-product-variation', groupId });
      return;
    }
    setActiveProductGroupId(groupId);
  };

  const pickerEntries = useMemo(() => {
    if (!picker)
      return [] as Array<{
        id: string;
        name: string;
        price: number;
        priceLabel: string | null;
        imageUrl?: string | null;
        selected: boolean;
        quantity?: number;
        onChoose: () => void;
        onIncrease?: () => void;
        onDecrease?: () => void;
      }>;
    if (picker.kind === 'variation') {
      return variations.map((v) => ({
        id: v.id,
        name: v.name,
        price: chargeableVariationUnitPrice(
          v.priceDelta,
          variationPickerBaseline
        ),
        priceLabel: formatVariationAddonDisplay(
          v.priceDelta,
          variationPickerBaseline,
          regional
        ),
        imageUrl: v.imageUrl ?? null,
        selected: selectedVariationId === v.id,
        quantity: undefined,
        onChoose: () => {
          const nextVariationId = v.id;
          setSelectedVariationId(nextVariationId);
          applyNextPendingPicker(
            nextVariationId,
            selectedByGroup,
            selectedNestedVariationByOption,
            productRecPickerContext()
          );
        },
        onIncrease: undefined,
        onDecrease: undefined,
      }));
    }
    if (picker.kind === 'recommendation-product-variation') {
      const group = productRecommendationGroups.find(
        (g) => g.id === picker.groupId
      );
      const item = group?.items[0];
      if (!group || !item) return [];
      return (item.variations ?? []).map((v) => ({
        id: v.id,
        name: v.name ?? v.title ?? 'Variation',
        price: productRecommendationVariationUnitPrice(item, v.id),
        priceLabel: productRecommendationVariationPriceLabel(
          item,
          v.priceDelta
        ),
        imageUrl: v.imageUrl ?? item.imageUrl ?? null,
        selected: preselectedRecommendationVariationByGroup[group.id] === v.id,
        quantity: undefined,
        onChoose: () => {
          setPreselectedRecommendationVariationByGroup((prev) => ({
            ...prev,
            [group.id]: v.id,
          }));
          setPicker(null);
          setActiveProductGroupId(group.id);
        },
        onIncrease: undefined,
        onDecrease: undefined,
      }));
    }
    if (picker.kind === 'group-single') {
      const group = categoryGroups.find((g) => g.id === picker.groupId);
      if (!group) return [];
      const selected = selectedByGroup[group.id]?.[0] ?? '';
      const groupSelectedIds = selected ? [selected] : [];
      return visibleConfigurationItems(
        group,
        baseProductVariationContext.parent
      ).map((it) => {
        const { price, priceLabel } = configurationItemPickerPrice(
          it,
          group,
          baseProductVariationContext.parent,
          groupSelectedIds,
          selectedNestedVariationByOption,
          regional
        );
        return {
        id: it.menuItemId,
        name: it.name,
        price,
        priceLabel,
        imageUrl: it.imageUrl,
        selected: selected === it.menuItemId,
        quantity: undefined,
        onChoose: () => {
          const switching =
            (selectedByGroup[group.id]?.[0] ?? '') !== it.menuItemId;
          const cleared = switching
            ? clearOptionDataForGroup(
                group.id,
                nestedOptionConfigs,
                selectedNestedVariationByOption
              )
            : {
                configs: nestedOptionConfigs,
                variations: selectedNestedVariationByOption,
              };
          if (switching) {
            setNestedOptionConfigs(cleared.configs);
          }
          const key = optionSelectionKey(group.id, it.menuItemId);
          const resolved = resolveCategoryItemVariationId(
            it,
            baseProductVariationContext.parent,
            group
          );
          const nextNestedVariations = { ...cleared.variations };
          if (resolved) nextNestedVariations[key] = resolved;
          setSelectedNestedVariationByOption(nextNestedVariations);
          setActiveCategoryOption(null);
          const nextSelectedByGroup = {
            ...selectedByGroup,
            [group.id]: [it.menuItemId],
          };
          setSelectedByGroup((prev) => ({
            ...prev,
            [group.id]: [it.menuItemId],
          }));
          setSelectionTimeline((timeline) => {
            const previousOption = selectedByGroup[group.id]?.[0];
            let next = timeline;
            if (previousOption && previousOption !== it.menuItemId) {
              next = removeSelectionTimeline(
                next,
                selectionTimelineKeys.categoryOption(group.id, previousOption)
              );
            }
            return appendSelectionTimeline(
              next,
              selectionTimelineKeys.categoryOption(group.id, it.menuItemId)
            );
          });
          if (optionNeedsManualVariationPicker(it, group)) {
            setPicker({
              kind: 'nested',
              groupId: group.id,
              optionId: it.menuItemId,
            });
            return;
          }
          const optionCtx = {
            group,
            parentVariation: baseProductVariationContext.parent,
          };
          if (
            recommendationOptionNeedsSheet(it, group) &&
            !isOptionConfigComplete(
              it,
              key,
              nextNestedVariations,
              cleared.configs,
              optionCtx
            )
          ) {
            setPicker(null);
            setActiveCategoryOption({
              groupId: group.id,
              optionId: it.menuItemId,
            });
            return;
          }
          applyNextPendingPicker(
            selectedVariationId,
            nextSelectedByGroup,
            nextNestedVariations,
            {
              ...productRecPickerContext(),
              optionNestedConfigs: cleared.configs,
            }
          );
        },
        onIncrease: undefined,
        onDecrease: undefined,
      };
      });
    }
    if (picker.kind === 'group-multi') {
      const group = categoryGroups.find((g) => g.id === picker.groupId);
      if (!group) return [];
      const selected = selectedByGroup[group.id] ?? [];
      return visibleConfigurationItems(
        group,
        baseProductVariationContext.parent
      ).map((it) => {
        const itemQty = selected.filter((x) => x === it.menuItemId).length;
        const { price, priceLabel } = configurationItemPickerPrice(
          it,
          group,
          baseProductVariationContext.parent,
          selected,
          selectedNestedVariationByOption,
          regional
        );
        return {
        id: it.menuItemId,
        name: it.name,
        price,
        priceLabel,
        imageUrl: it.imageUrl,
        selected: selected.includes(it.menuItemId),
        quantity: itemQty,
        onChoose: () => {
          if (group.multipleMode === 'CHECKBOX') {
            toggleMultiCheckbox(group, it.menuItemId);
            return;
          }
          const qty = selected.filter((x) => x === it.menuItemId).length;
          if (qty > 0) {
            decreaseMultiQty(group.id, it.menuItemId);
            return;
          }
          increaseMultiQty(group, it.menuItemId);
        },
        onIncrease:
          group.multipleMode === 'QUANTITY'
            ? () => increaseMultiQty(group, it.menuItemId)
            : undefined,
        onDecrease:
          group.multipleMode === 'QUANTITY'
            ? () => decreaseMultiQty(group.id, it.menuItemId)
            : undefined,
      };
      });
    }
    if (picker.kind === 'nested') {
      const group = categoryGroups.find((g) => g.id === picker.groupId);
    const item = group?.items.find((it) => it.menuItemId === picker.optionId);
      if (!item || !group || !optionNeedsManualVariationPicker(item, group)) {
        return [];
      }
      const key = optionSelectionKey(picker.groupId, picker.optionId);
      const optionVariationBaseline = variationPickerBaselineUnitPrice(
        effectiveUnitPrice(item.price, item.salePrice),
        item.variations
      );
    return (item.variations ?? []).map((v) => ({
      id: v.id,
      name: v.name ?? v.title ?? 'Variation',
      price: chargeableVariationUnitPrice(
        v.priceDelta,
        optionVariationBaseline
      ),
      priceLabel: formatVariationAddonDisplay(
        v.priceDelta,
        optionVariationBaseline,
        regional
      ),
      imageUrl: v.imageUrl ?? item.imageUrl ?? null,
      selected: selectedNestedVariationByOption[key] === v.id,
      quantity: undefined,
      onChoose: () => {
        setSelectedNestedVariationByOption((prev) => ({
          ...prev,
          [key]: v.id,
        }));
        if ((item.nestedAttributeGroups?.length ?? 0) > 0) {
          setPicker(null);
          setActiveCategoryOption({
            groupId: picker.groupId,
            optionId: picker.optionId,
          });
          return;
        }
        applyNextPendingPicker(
          selectedVariationId,
          selectedByGroup,
          { ...selectedNestedVariationByOption, [key]: v.id },
          productRecPickerContext()
        );
      },
      onIncrease: undefined,
      onDecrease: undefined,
    }));
    }
    return [];
  }, [
    baseProductVariationContext,
    categoryGroups,
    picker,
    preselectedRecommendationVariationByGroup,
    productImageUrl,
    productRecommendationGroups,
    regional,
    selectedByGroup,
    selectedNestedVariationByOption,
    selectedVariationId,
    variations,
  ]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-[min(100vw,80rem)] flex-col overflow-hidden border-l bg-background p-0 text-foreground sm:max-w-[min(100vw,80rem)]"
        style={dialogVars}
      >
        <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Left: hero image (desktop — full height) */}
          <div className="relative hidden min-h-0 shrink-0 overflow-hidden bg-muted lg:block lg:w-[58%] lg:max-w-none">
            {productImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary menu image URLs
              <img
                src={productImageUrl}
                alt={productName}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-primary/10">
                <span className="text-sm font-medium text-muted-foreground">
                  No image
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/10" />
          </div>

          {/* Mobile: prominent image strip */}
          <div className="relative h-[min(38vh,280px)] w-full shrink-0 overflow-hidden bg-muted lg:hidden">
            {productImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productImageUrl}
                alt={productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted text-sm text-muted-foreground">
                No image
              </div>
            )}
          </div>

          {/* Right: details + scroll + footer */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:w-[42%] lg:max-w-none">
            <SheetHeader className="shrink-0 space-y-0 border-b border-border px-5 pb-4 pt-5 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pr-2">
                  <SheetTitle className="text-balance text-xl font-bold uppercase leading-tight tracking-wide text-primary md:text-2xl">
                    {productName}
                  </SheetTitle>
                  <p className="mt-2 text-lg font-bold tabular-nums text-primary md:text-xl">
                    {basePriceLabel}
                  </p>
                </div>
                <SheetClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>
              {productDescription?.trim() ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                  {productDescription}
                </p>
              ) : null}
            </SheetHeader>

            <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
              {isLoading ? (
                <div
                  className="flex min-h-[16rem] flex-col items-center justify-center gap-3 py-12 text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Loading options…</p>
                </div>
              ) : (
              <div className="space-y-5">
                {variations.length > 0 ? (
                  <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <Label className="text-sm font-semibold leading-snug text-foreground">
                        Variation
                      </Label>
                      <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                        Required
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-3 flex h-12 w-full items-center justify-between rounded-lg border border-input bg-muted/40 px-3 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                      onClick={() => setPicker({ kind: 'variation' })}
                    >
                      <span className="truncate text-muted-foreground">
                        {selectedVariationId
                          ? variations.find((v) => v.id === selectedVariationId)
                              ?.name ?? 'Select…'
                          : 'Select…'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </section>
                ) : null}

                {visibleProductRecommendationGroups.map((g) => {
                  const item = g.items[0];
                  if (!item) return null;
                  const configured = Boolean(nestedConfigs[g.id]);
                  const needsSheet = recommendedProductNeedsSheet(g);
                  const missing = needsSheet && !configured && g.required;
                  const manualProductVariation = optionNeedsManualVariationPicker(
                    item,
                    g
                  );
                  const selectedVariationIdForGroup = manualProductVariation
                    ? preselectedRecommendationVariationByGroup[g.id]
                    : resolveCategoryItemVariationId(
                        item,
                        baseProductVariationContext.parent,
                        g
                      ) ?? preselectedRecommendationVariationByGroup[g.id];
                  const productRecSummary = buildProductRecSelectionSummary(
                    g,
                    nestedConfigs[g.id],
                    selectedVariationIdForGroup,
                    baseProductVariationContext.parent,
                    regional
                  );
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
                          <span className="text-xs text-muted-foreground">
                            Optional
                          </span>
                        )}
                      </div>
                      {missing ? (
                        <p className="mt-2 text-xs text-destructive">
                          Please configure this recommendation
                        </p>
                      ) : null}
                      {needsSheet ? (
                        <button
                          type="button"
                          className="mt-3 flex w-full min-h-12 items-center justify-between gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                          onClick={() => openRecommendationGroup(g.id)}
                        >
                          <ConfigurationSelectSummary
                            lines={productRecSummary}
                            placeholder={`Select ${item.name}`}
                          />
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      ) : null}
                    </section>
                  );
                })}

                {visibleCategoryGroups.length === 0 &&
                visibleProductRecommendationGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No add-ons available.
                  </p>
          ) : (
                  visibleCategoryGroups.map((g) => {
              const selectedIds = selectedByGroup[g.id] ?? [];
                    const limits = limitsForGroup(g);
                    const count = totalSelectedUnits(selectedIds);
                    const min = limits.minItems ?? (g.required ? 1 : 0);
                    const missing =
                      g.selectionType === 'SINGLE'
                        ? g.required && count === 0
                        : (g.required && count < min) ||
                          (count > 0 && min > 0 && count < min);

              return (
                <section
                  key={g.id}
                        ref={(el) => {
                          groupRefs.current[g.id] = el;
                        }}
                        className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Label className="text-sm font-semibold leading-snug text-foreground">
                              {configurationGroupDisplayTitle(
                                g.name,
                                baseProductVariationContext.parent,
                                g.useVariationPricing ?? false,
                                baseProductVariationContext.shortLabel
                              )}
                      </Label>
                      {g.linkedCategoryName ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          From {g.linkedCategoryName}
                        </p>
                      ) : null}
                    </div>
                          {g.required ? (
                            <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                              Required
                            </span>
                          ) : (
                            <p className="shrink-0 text-xs text-muted-foreground">
                              {g.selectionType === 'SINGLE'
                                ? 'Optional'
                                : multiSelectionHint(
                                    limits.minItems,
                                    limits.maxItems
                                  )}
                      </p>
                    )}
                  </div>
                        {g.selectionType === 'MULTIPLE' ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Selected {count} / {limits.maxItems}
                            {g.multipleMode === 'QUANTITY' &&
                            hasQuantityFreeTier(g.freeQuantity)
                              ? ` · first ${g.freeQuantity} free`
                                  : ''}
                          </p>
                        ) : null}
                        {missing ? (
                          <p className="mt-1 text-xs text-destructive">
                            {g.selectionType === 'SINGLE'
                              ? 'Please select an option'
                              : `Please select at least ${min} option${min === 1 ? '' : 's'}`}
                          </p>
                        ) : null}

                        <div className="mt-3">
                          {(() => {
                            const visible = visibleConfigurationItems(
                              g,
                              baseProductVariationContext.parent
                            );
                            if (visible.length === 0) {
                              return (
                      <p className="text-sm text-muted-foreground">
                                  {g.useVariationPricing &&
                                  variations.length > 0 &&
                                  !selectedVariationId
                                    ? 'Select a product variation to see add-ons for this size.'
                                    : g.useVariationPricing
                                      ? 'No add-ons available for this variation.'
                                      : 'No options available in this category yet.'}
                                </p>
                              );
                            }
                            const categorySummary =
                              buildCategoryGroupSelectionSummary(
                                g,
                                selectedIds,
                                selectedNestedVariationByOption,
                                nestedOptionConfigs,
                                baseProductVariationContext.parent,
                                baseProductVariationContext.shortLabel,
                                regional
                              );
                                return (
                                  <button
                                    type="button"
                                className="flex w-full min-h-12 items-center justify-between gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                                onClick={() => openCategoryGroupSelect(g)}
                              >
                                <ConfigurationSelectSummary
                                  lines={categorySummary}
                                  placeholder="Select…"
                                />
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  </button>
                                );
                              })()}
                  </div>
                </section>
              );
            })
          )}

                {personalizeGroups.length > 0 ? (
                  <PersonalizeOptionsSection
                    groups={personalizeGroups}
                    selectedByGroup={selectedPersonalizeByGroup}
                    onToggle={togglePersonalizeOption}
                  />
                ) : null}
        </div>
              )}
            </div>

            {picker && !isLoading ? (
              <aside
                className="absolute inset-0 flex min-h-0 flex-col justify-end bg-black/40 animate-in fade-in-0 duration-200"
                aria-modal="true"
                role="dialog"
                aria-labelledby="product-customize-picker-title"
              >
                <div className="flex max-h-[min(50dvh,26rem)] w-full shrink-0 flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card shadow-2xl animate-in slide-in-from-bottom-6 duration-300 ease-out">
                  <div className="shrink-0 p-4 pb-0">
                  <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
                    <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3
                        id="product-customize-picker-title"
                        className="text-base font-semibold text-foreground"
                      >
                        {pickerTitle}
                      </h3>
                      {pickerSubtitle ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pickerSubtitle}
                        </p>
                      ) : null}
                    </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setPicker(null)}
                        aria-label="Close picker"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2">
                    {pickerEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                          entry.selected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background'
                        }`}
                        onClick={entry.onChoose}
                      >
                        <LazyMenuProductImage
                          src={entry.imageUrl}
                          alt={entry.name}
                          emptyLabel=""
                          className="h-12 w-12 shrink-0 rounded-md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {entry.name}
                          </p>
                          {entry.priceLabel ? (
                          <p className="text-xs text-muted-foreground">
                              {entry.priceLabel}
                          </p>
                          ) : null}
                        </div>
                        {picker.kind === 'group-multi' ? (
                          <div
                            className="ml-auto flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={!entry.quantity}
                              onClick={entry.onDecrease}
                            >
                              -
          </Button>
                            <span className="min-w-[2ch] text-center text-xs font-semibold">
                              {entry.quantity ?? 0}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={entry.onIncrease}
                            >
                              +
          </Button>
                          </div>
                        ) : entry.selected ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  {picker.kind === 'group-multi' ? (
                    <div className="shrink-0 border-t border-border bg-card p-4 pt-3">
                      <Button
                        type="button"
                        className="h-11 w-full rounded-xl font-semibold"
                        onClick={() => {
                          const nextPicker = getNextPendingPicker(
                            selectedVariationId,
                            selectedByGroup,
                            selectedNestedVariationByOption,
                            productRecPickerContext()
                          );
                          if (
                            nextPicker &&
                            nextPicker.kind === 'group-multi' &&
                            nextPicker.groupId === picker.groupId
                          ) {
                            setPicker(null);
                            return;
                          }
                          applyNextPendingPicker(
                            selectedVariationId,
                            selectedByGroup,
                            selectedNestedVariationByOption,
                            productRecPickerContext()
                          );
                        }}
                      >
                        Select
                      </Button>
                    </div>
                  ) : null}
                </div>
              </aside>
            ) : null}
            </div>

            {/* Sticky footer: qty + Add — stays above picker overlay */}
            <footer className="relative z-[90] shrink-0 border-t border-border bg-card px-4 py-4 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)]">
              <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <div className="flex items-center gap-0.5 rounded-lg border border-primary/30 bg-primary/5 p-0.5">
                  <Button
                    type="button"
                    variant="default"
                    className="h-10 w-10 shrink-0 rounded-md p-0 text-base font-bold"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    −
                  </Button>
                  <span className="min-w-[2.5rem] px-1 text-center text-sm font-bold tabular-nums text-foreground">
                    {String(quantity).padStart(2, '0')}
                  </span>
                  <Button
                    type="button"
                    variant="default"
                    className="h-10 w-10 shrink-0 rounded-md p-0 text-base font-bold"
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  >
                    +
                  </Button>
                </div>
                <Button
                  type="button"
                  disabled={requiredMissing || isLoading}
                  onClick={handleConfirm}
                  className="h-12 min-h-[3rem] flex-1 rounded-xl border-0 bg-gradient-to-r from-primary to-[var(--restaurant-primary-dark,var(--primary))] px-5 text-base font-bold text-primary-foreground shadow-md shadow-primary/30 transition-opacity hover:opacity-95 disabled:opacity-50 sm:min-w-[12rem]"
                >
                  <span className="flex w-full items-center justify-between gap-4">
                    <span>{isLoading ? 'Loading…' : 'Add'}</span>
                    <span className="tabular-nums">
                      {formatMoney(selectedUnitTotal * quantity)}
                    </span>
                  </span>
                </Button>
              </div>
            </footer>

            {activeCategoryOptionTarget ? (
              <NestedRecommendationSheet
                open
                stackClassName="z-[92]"
                parentGroupName={activeCategoryOptionTarget.group.name}
                parentConfigurationGroup={activeCategoryOptionTarget.group}
                baseProductVariation={baseProductVariationContext.parent}
                baseProductVariationShortLabel={
                  baseProductVariationContext.shortLabel
                }
                product={activeCategoryOptionTarget.item}
                attributeGroups={
                  activeCategoryOptionTarget.item.nestedAttributeGroups ?? []
                }
                initialProductVariationId={
                  nestedOptionConfigs[activeCategoryOptionTarget.key]
                    ?.productVariationId ??
                  selectedNestedVariationByOption[
                    activeCategoryOptionTarget.key
                  ]
                }
                onClose={() => setActiveCategoryOption(null)}
                onDone={(result) => {
                  const { key } = activeCategoryOptionTarget;
                  const nextNestedVariations = {
                    ...selectedNestedVariationByOption,
                    ...(result.productVariationId
                      ? { [key]: result.productVariationId }
                      : {}),
                  };
                  setActiveCategoryOption(null);
                  if (result.productVariationId) {
                    setSelectedNestedVariationByOption((prev) => ({
                      ...prev,
                      [key]: result.productVariationId,
                    }));
                  }
                  setNestedOptionConfigs((prev) => {
                    const nextOptionConfigs = { ...prev, [key]: result };
                    queueMicrotask(() => {
                      applyNextPendingPicker(
                        selectedVariationId,
                        selectedByGroup,
                        nextNestedVariations,
                        {
                          nestedConfigs,
                          preselectedByGroup:
                            preselectedRecommendationVariationByGroup,
                          optionNestedConfigs: nextOptionConfigs,
                        }
                      );
                    });
                    return nextOptionConfigs;
                  });
                }}
              />
            ) : null}

            {activeProductGroup && activeProductItem ? (
              <NestedRecommendationSheet
                open={activeProductGroupId === activeProductGroup.id}
                parentGroupName={activeProductGroup.name}
                parentConfigurationGroup={activeProductGroup}
                baseProductVariation={baseProductVariationContext.parent}
                baseProductVariationShortLabel={
                  baseProductVariationContext.shortLabel
                }
                product={activeProductItem}
                attributeGroups={activeProductItem.nestedAttributeGroups ?? []}
                initialProductVariationId={
                  preselectedRecommendationVariationByGroup[
                    activeProductGroup.id
                  ]
                }
                onClose={() => setActiveProductGroupId(null)}
                onDone={(result) => {
                  const groupId = activeProductGroup.id;
                  const nextPreselected = result.productVariationId
                    ? {
                        ...preselectedRecommendationVariationByGroup,
                        [groupId]: result.productVariationId,
                      }
                    : preselectedRecommendationVariationByGroup;
                  if (result.productVariationId) {
                    setPreselectedRecommendationVariationByGroup(
                      nextPreselected
                    );
                  }
                  setNestedConfigs((prev) => {
                    const nextNested = { ...prev, [groupId]: result };
                    setSelectionTimeline((timeline) =>
                      appendSelectionTimeline(
                        timeline,
                        selectionTimelineKeys.productRec(groupId)
                      )
                    );
                    queueMicrotask(() => {
                      applyNextPendingPicker(
                        selectedVariationId,
                        selectedByGroup,
                        selectedNestedVariationByOption,
                        {
                          nestedConfigs: nextNested,
                          preselectedByGroup: nextPreselected,
                        }
                      );
                    });
                    return nextNested;
                  });
                  setActiveProductGroupId(null);
                }}
              />
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
