'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Check, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ORDER_ACCENT_GOLD } from '@/components/order/order-menu-header';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { ConfigurationSelectSummary } from '@/components/order/configuration-select-summary';
import { recommendationGroupDisplayLabel } from '@/lib/cart-line-display';
import { LazyMenuProductImage } from '@/components/menu/lazy-menu-product-image';
import {
  NestedRecommendationSheet,
  type NestedRecommendationResult,
} from '@/components/order/nested-recommendation-sheet';
import {
  buildCategoryGroupSelectionSummary,
  buildProductRecSelectionSummary,
} from '@/lib/menu/configuration-selection-summary';
import { modifierSelectionsUnitTotal, type ModifierGroupSelection } from '@/lib/menu/build-modifier-selections';
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
  categoryOptionJumpsToCustomizer,
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
  categoryExtraCostPercent?: number | null;
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
    updatedAt?: string | Date | null;
    createdAt?: string | Date | null;
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

function stripLeadingPricePrefix(text: string) {
  return text
    .replace(/^\s*(?:€|\$|£)?\s*\d+[.,]\d{2}\s*[€$£]?\s*/u, '')
    .trim();
}

function isDesktopCustomizeLayout() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 1024px)').matches;
}

const GROUP_SELECT_TRIGGER =
  'flex min-h-[50px] w-full justify-between gap-2 bg-transparent px-[15px] text-left transition-colors hover:bg-[#fafafa]';
const GROUP_REQUIRED_LABEL = 'shrink-0 text-sm font-normal text-black';
const PICKER_CONFIRM_BUTTON =
  'h-11 w-full rounded-xl text-sm font-bold text-primary shadow-sm transition hover:brightness-95 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60';

function GroupSelectChevron({ alignTop }: { alignTop?: boolean }) {
  return (
    <ChevronDown
      className={`h-3.5 w-3.5 shrink-0 ${alignTop ? 'mt-1' : ''}`}
      style={{ color: ORDER_ACCENT_GOLD }}
    />
  );
}

function AddPlusButton({
  selected,
  label,
  onClick,
}: {
  selected?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-90"
    >
      {selected ? (
        <Check className="h-4 w-4" strokeWidth={2.75} />
      ) : (
        <Plus className="h-4 w-4" strokeWidth={2.75} />
      )}
    </button>
  );
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
    group.categoryDiscountPercent,
    group.categoryExtraCostPercent
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
      categoryExtraCostPercent: group.categoryExtraCostPercent,
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

function CustomizeGroupSkeleton({
  title,
  required,
}: {
  title?: string | null;
  required?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[10px]" aria-busy="true">
      <div className="flex items-center justify-between gap-3 border-b border-[#f4f4f4] px-[15px] py-3">
        {title?.trim() ? (
          <Label className="text-sm font-semibold text-primary">{title}</Label>
        ) : (
          <div className="h-4 w-36 animate-pulse rounded bg-zinc-200" />
        )}
        {required ? (
          <span className={GROUP_REQUIRED_LABEL}>Required</span>
        ) : (
          <div className="h-4 w-14 animate-pulse rounded bg-zinc-200" />
        )}
      </div>
      <div className="flex h-[50px] w-full items-center justify-between px-[15px]">
        <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
        <div className="h-3.5 w-3.5 rounded bg-zinc-200" />
      </div>
    </section>
  );
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
    mods: ModifierGroupSelection[],
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
  const { t } = useTranslation();
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
  const [attemptedConfirm, setAttemptedConfirm] = useState(false);
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
  const [skippedOptionalGroupIds, setSkippedOptionalGroupIds] = useState<
    Record<string, true>
  >({});
  const skippedOptionalGroupIdsRef = useRef(skippedOptionalGroupIds);
  skippedOptionalGroupIdsRef.current = skippedOptionalGroupIds;

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
      categoryGroups.filter((g) => {
        if (isLoading && g.items.length === 0) return true;
        return isConfigurationGroupVisibleForFilters(
          g,
          baseProductVariationContext.parent
        );
      }),
    [categoryGroups, baseProductVariationContext.parent, isLoading]
  );

  const visibleProductRecommendationGroups = useMemo(
    () =>
      productRecommendationGroups.filter((g) => {
        const item = g.items[0];
        return Boolean(item);
      }),
    [productRecommendationGroups]
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
  const customizeSessionRef = useRef(false);
  const selectedVariationIdRef = useRef(selectedVariationId);
  selectedVariationIdRef.current = selectedVariationId;
  const selectedByGroupRef = useRef(selectedByGroup);
  selectedByGroupRef.current = selectedByGroup;
  const selectedNestedVariationByOptionRef = useRef(
    selectedNestedVariationByOption
  );
  selectedNestedVariationByOptionRef.current = selectedNestedVariationByOption;
  const nestedConfigsRef = useRef(nestedConfigs);
  nestedConfigsRef.current = nestedConfigs;
  const preselectedRecommendationVariationByGroupRef = useRef(
    preselectedRecommendationVariationByGroup
  );
  preselectedRecommendationVariationByGroupRef.current =
    preselectedRecommendationVariationByGroup;
  const nestedOptionConfigsRef = useRef(nestedOptionConfigs);
  nestedOptionConfigsRef.current = nestedOptionConfigs;
  const pickerRef = useRef(picker);
  pickerRef.current = picker;

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
      if (selectedIds.length === 0) {
        if (g.required) {
          if (g.selectionType === 'SINGLE') {
            return { kind: 'group-single', groupId: g.id };
          }
          return { kind: 'group-multi', groupId: g.id };
        }
        if (skippedOptionalGroupIdsRef.current[g.id]) continue;
        if (g.selectionType === 'SINGLE') {
          return { kind: 'group-single', groupId: g.id };
        }
        continue;
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
    if (!open) {
      customizeSessionRef.current = false;
      return;
    }

    const autoNestedForGroups = (
      existing: Record<string, NestedRecommendationResult>
    ) => {
      const autoNested: Record<string, NestedRecommendationResult> = {
        ...existing,
      };
      for (const g of productRecommendationGroups) {
        if (recommendedProductNeedsSheet(g) || autoNested[g.id]) continue;
        autoNested[g.id] = {
          productVariationId: '',
          selectedByGroup: {},
          selectedNestedVariationByOption: {},
          mods: [],
        };
      }
      return autoNested;
    };

    if (!customizeSessionRef.current) {
      customizeSessionRef.current = true;
      const init: Record<string, string[]> = {};
      for (const g of categoryGroups) init[g.id] = [];
      setSelectedByGroup(init);
      const personalizeInit: Record<string, string[]> = {};
      for (const g of personalizeGroups) personalizeInit[g.id] = [];
      setSelectedPersonalizeByGroup(personalizeInit);
      setSelectedVariationId('');
      setSelectedNestedVariationByOption({});
      setQuantity(1);
      setAttemptedConfirm(false);
      setPreselectedRecommendationVariationByGroup({});
      setActiveProductGroupId(null);
      setNestedOptionConfigs({});
      setActiveCategoryOption(null);
      setSelectionTimeline([]);
      setSkippedOptionalGroupIds({});
      skippedOptionalGroupIdsRef.current = {};
      const autoNested = autoNestedForGroups({});
      setNestedConfigs(autoNested);
      if (variations.length > 0) {
        setPicker({ kind: 'variation' });
        return;
      }
      // Desktop: show every group like Enjoy Tacos. Mobile: sequential bottom sheets.
      if (isDesktopCustomizeLayout()) {
        setPicker(null);
        return;
      }
      applyNextPendingPicker('', init, {}, {
        nestedConfigs: autoNested,
        preselectedByGroup: {},
        optionNestedConfigs: {},
      });
      return;
    }

    setSelectedByGroup((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of categoryGroups) {
        if (g.id in next) continue;
        next[g.id] = [];
        changed = true;
      }
      return changed ? next : prev;
    });
    setSelectedPersonalizeByGroup((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of personalizeGroups) {
        if (g.id in next) continue;
        next[g.id] = [];
        changed = true;
      }
      return changed ? next : prev;
    });
    const autoNested = autoNestedForGroups(nestedConfigsRef.current);
    if (Object.keys(autoNested).length !== Object.keys(nestedConfigsRef.current).length) {
      setNestedConfigs(autoNested);
    }

    const variationId = selectedVariationIdRef.current;
    if (pickerRef.current?.kind === 'variation' && !variationId) {
      return;
    }
    if (!variationId && variations.length > 0) {
      setPicker({ kind: 'variation' });
      return;
    }
    if (isLoading) return;
    if (isDesktopCustomizeLayout()) return;
    applyNextPendingPicker(
      variationId,
      selectedByGroupRef.current,
      selectedNestedVariationByOptionRef.current,
      {
        nestedConfigs: autoNested,
        preselectedByGroup: preselectedRecommendationVariationByGroupRef.current,
        optionNestedConfigs: nestedOptionConfigsRef.current,
      }
    );
  }, [
    open,
    isLoading,
    categoryGroups,
    productRecommendationGroups,
    personalizeGroups,
    variations.length,
  ]);

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
    if (isLoading) return;
    if (requiredMissing) {
      setAttemptedConfirm(true);
      applyNextPendingPicker(
        selectedVariationId,
        selectedByGroup,
        selectedNestedVariationByOption,
        productRecPickerContext()
      );
      return;
    }

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
    if (skippedOptionalGroupIdsRef.current[group.id]) {
      const nextSkipped = { ...skippedOptionalGroupIdsRef.current };
      delete nextSkipped[group.id];
      skippedOptionalGroupIdsRef.current = nextSkipped;
      setSkippedOptionalGroupIds(nextSkipped);
    }
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
  const displayDescription = productDescription?.trim()
    ? stripLeadingPricePrefix(productDescription)
    : '';

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
      optionId: activeCategoryOption.optionId,
      key: optionSelectionKey(
        activeCategoryOption.groupId,
        activeCategoryOption.optionId
      ),
    };
  }, [activeCategoryOption, categoryGroups]);

  const pickerTitle = useMemo(() => {
    if (!picker) return '';
    if (picker.kind === 'variation') return t('select');
    if (picker.kind === 'recommendation-product-variation') {
      const group = productRecommendationGroups.find(
        (g) => g.id === picker.groupId
      );
      const item = group?.items[0];
      return item?.name?.trim() || t('select');
    }
    if (picker.kind === 'group-single' || picker.kind === 'group-multi') {
      const group = categoryGroups.find((g) => g.id === picker.groupId);
      return recommendationGroupDisplayLabel(
        group?.name?.trim() || t('select')
      );
    }
    const group = categoryGroups.find((g) => g.id === picker.groupId);
    const item = group?.items.find((i) => i.menuItemId === picker.optionId);
    return item?.name?.trim() || t('select');
  }, [categoryGroups, picker, productRecommendationGroups, t]);

  const pickerSubtitle = useMemo(() => {
    if (picker?.kind === 'recommendation-product-variation') {
      return null;
    }
    if (
      !picker ||
      (picker.kind !== 'group-multi' && picker.kind !== 'group-single')
    ) {
      return null;
    }
    const group = categoryGroups.find((g) => g.id === picker.groupId);
    if (!group) return null;
    const limits = limitsForGroup(group);
    const count = totalSelectedUnits(selectedByGroup[group.id] ?? []);
    const min = limits.minItems ?? (group.required ? 1 : 0);
    const max = limits.maxItems;
    const progress =
      min > 0
        ? t('customizeSelectedCount', { count, max })
        : t('customizeMaxCount', { count, max });
    if (picker.kind === 'group-single') {
      return group.required
        ? `${t('customizeRequired')} · ${progress}`
        : progress;
    }
    const hint = multiSelectionHint(limits.minItems, limits.maxItems);
    return `${hint} · ${progress}`;
  }, [categoryGroups, limitsForGroup, picker, selectedByGroup, t]);

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
          // Enjoy Tacos: tapping the wrap opens its customizer immediately.
          // Do not leave the guest on this list waiting for Seleccionar.
          if (categoryOptionJumpsToCustomizer(it, group)) {
            setPicker(null);
            setActiveCategoryOption({
              groupId: group.id,
              optionId: it.menuItemId,
            });
            return;
          }
          setActiveCategoryOption(null);
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
        className="flex h-full w-full max-w-full flex-col overflow-hidden border-l border-[#ececf0] bg-white p-0 text-foreground sm:max-w-full lg:max-w-[min(100vw,calc(100vh+24.375rem))]"
        style={dialogVars}
      >
        <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative hidden min-h-0 flex-1 overflow-hidden bg-white lg:block">
            {productImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary menu image URLs
              <img
                src={productImageUrl}
                alt={productName}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[#f7f7f9] text-sm text-muted-foreground">
                No image
              </div>
            )}
          </div>

          <div className="relative h-[min(42vw,15.5rem)] w-full shrink-0 overflow-hidden bg-white lg:hidden">
            {productImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary menu image URLs
              <img
                src={productImageUrl}
                alt={productName}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#f7f7f9] text-sm text-muted-foreground">
                No image
              </div>
            )}
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/95 text-muted-foreground shadow-sm hover:bg-white hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>

          <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col lg:w-[390px] lg:max-w-[390px] lg:flex-none">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pb-6 pt-6">
              <SheetHeader className="space-y-0 p-0 text-left">
                <div className="flex items-start justify-between gap-3">
                  <SheetTitle className="mb-[15px] text-balance text-[30px] font-bold uppercase leading-[40px] text-primary">
                    {productName}
                  </SheetTitle>
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="hidden h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </SheetClose>
                </div>
                <p className="text-sm font-bold tabular-nums text-primary">
                  {basePriceLabel}
                </p>
                {displayDescription ? (
                  <p className="mt-[15px] text-sm leading-[17px] text-primary">
                    {displayDescription}
                  </p>
                ) : null}
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {visibleCategoryGroups.length > 0 ||
                visibleProductRecommendationGroups.length > 0 ||
                variations.length > 0 ? (
                  <h2 className="text-[21px] font-bold text-primary">
                    {t('customizeYourProduct')}
                  </h2>
                ) : null}

                {variations.length > 0 ? (
                  <section className="overflow-hidden rounded-[10px] animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between gap-3 border-b border-[#f4f4f4] px-[15px] py-3">
                      <Label className="text-sm font-semibold leading-snug text-primary">
                        Variation
                      </Label>
                      <span className={GROUP_REQUIRED_LABEL}>
                        {t('customizeRequired')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`${GROUP_SELECT_TRIGGER} ${
                        selectedVariationId
                          ? 'items-start py-3'
                          : 'items-center'
                      }`}
                      onClick={() => setPicker({ kind: 'variation' })}
                    >
                      <span
                        className={
                          selectedVariationId
                            ? 'truncate text-sm font-semibold uppercase text-foreground'
                            : 'truncate text-xs text-[#757575]'
                        }
                      >
                        {selectedVariationId
                          ? variations.find((v) => v.id === selectedVariationId)
                              ?.name ?? t('customizeSelectPlaceholder')
                          : t('customizeSelectPlaceholder')}
                      </span>
                      <GroupSelectChevron alignTop={Boolean(selectedVariationId)} />
                    </button>
                  </section>
                ) : null}

                {/* Product Recommendation Groups */}
                {productRecommendationGroups.map((g, index) => {
                  const item = g.items[0];
                  if (!item) {
                    if (!isLoading) return null;
                    return (
                      <CustomizeGroupSkeleton
                        key={`product-rec-skel-${g.id || 'row'}-${index}`}
                        title={g.name}
                        required={g.required}
                      />
                    );
                  }
                  if (!visibleProductRecommendationGroups.some((v) => v.id === g.id)) {
                    return null;
                  }
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
                      key={`product-rec-${g.id || 'row'}-${index}`}
                      className="overflow-hidden rounded-[10px] animate-in fade-in-50 duration-200"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-[#f4f4f4] px-[15px] py-3">
                        <Label className="text-sm font-semibold text-primary">
                          {item.name}
                        </Label>
                        {g.required ? (
                          <span className={GROUP_REQUIRED_LABEL}>
                            {t('customizeRequired')}
                          </span>
                        ) : (
                          <span className="text-sm font-normal text-primary/70">
                            {t('customizeOptional')}
                          </span>
                        )}
                      </div>
                      {missing && attemptedConfirm && !isLoading ? (
                        <p className="px-[15px] pt-2 text-xs text-destructive">
                          Please configure this recommendation
                        </p>
                      ) : null}
                      {needsSheet ? (
                        <button
                          type="button"
                          className={`${GROUP_SELECT_TRIGGER} ${
                            productRecSummary.length > 0
                              ? 'items-start py-3'
                              : 'items-center'
                          }`}
                          onClick={() => openRecommendationGroup(g.id)}
                        >
                          <ConfigurationSelectSummary
                            lines={productRecSummary}
                            placeholder={t('customizeSelectPlaceholder')}
                          />
                          <GroupSelectChevron
                            alignTop={productRecSummary.length > 0}
                          />
                        </button>
                      ) : null}
                    </section>
                  );
                })}

                {/* Category Add-on Groups */}
                {visibleCategoryGroups.map((g, index) => {
                  const selectedIds = selectedByGroup[g.id] ?? [];
                  const limits = limitsForGroup(g);
                  const count = totalSelectedUnits(selectedIds);
                  const min = limits.minItems ?? (g.required ? 1 : 0);
                  const missing =
                    g.selectionType === 'SINGLE'
                      ? g.required && count === 0
                      : (g.required && count < min) ||
                        (count > 0 && min > 0 && count < min);
                  const awaitingOptions = isLoading && g.items.length === 0;
                  if (awaitingOptions) {
                    return (
                      <CustomizeGroupSkeleton
                        key={`category-group-skel-${g.id || 'row'}-${index}`}
                        title={g.name}
                        required={g.required}
                      />
                    );
                  }

                  return (
                    <section
                      key={`category-group-${g.id || 'row'}-${index}`}
                      ref={(el) => {
                        groupRefs.current[g.id] = el;
                      }}
                      className="overflow-hidden rounded-[10px] animate-in fade-in-50 duration-200"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-[#f4f4f4] px-[15px] py-3">
                        <div className="min-w-0 flex-1">
                          <Label className="text-sm font-semibold leading-snug text-primary">
                            {recommendationGroupDisplayLabel(
                              configurationGroupDisplayTitle(
                                g.name,
                                baseProductVariationContext.parent,
                                g.useVariationPricing ?? false,
                                baseProductVariationContext.shortLabel
                              )
                            )}
                          </Label>
                        </div>
                        {g.required ? (
                          <span className={GROUP_REQUIRED_LABEL}>
                            {t('customizeRequired')}
                          </span>
                        ) : (
                          <p className="shrink-0 text-sm font-normal text-primary/70">
                            {g.selectionType === 'SINGLE'
                              ? t('customizeOptional')
                              : multiSelectionHint(
                                  limits.minItems,
                                  limits.maxItems
                                )}
                          </p>
                        )}
                      </div>
                      {g.selectionType === 'MULTIPLE' ? (
                        <p className="px-[15px] pt-1 text-xs text-muted-foreground">
                          {t('customizeSelectedCount', {
                            count,
                            max: limits.maxItems,
                          })}
                          {g.multipleMode === 'QUANTITY' &&
                          hasQuantityFreeTier(g.freeQuantity)
                            ? ` · first ${g.freeQuantity} free`
                            : ''}
                        </p>
                      ) : null}
                      {missing && attemptedConfirm && !isLoading ? (
                        <p className="px-[15px] pt-1 text-xs text-destructive">
                          {g.selectionType === 'SINGLE'
                            ? 'Please select an option'
                            : `Please select at least ${min} option${min === 1 ? '' : 's'}`}
                        </p>
                      ) : null}

                      <div>
                        {(() => {
                          const visible = visibleConfigurationItems(
                            g,
                            baseProductVariationContext.parent
                          );
                          if (visible.length === 0) {
                            if (isLoading) {
                              return (
                                <div className="flex h-[50px] w-full animate-pulse items-center justify-between px-[15px]">
                                  <div className="h-3 w-24 rounded bg-zinc-200" />
                                  <div className="h-3.5 w-3.5 rounded bg-zinc-200" />
                                </div>
                              );
                            }
                            return (
                              <p className="px-[15px] py-3 text-sm text-muted-foreground">
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
                              className={`${GROUP_SELECT_TRIGGER} ${
                                categorySummary.length > 0
                                  ? 'items-start py-3'
                                  : 'items-center'
                              }`}
                              onClick={() => openCategoryGroupSelect(g)}
                            >
                              <ConfigurationSelectSummary
                                lines={categorySummary}
                                placeholder={t('customizeSelectPlaceholder')}
                              />
                              <GroupSelectChevron
                                alignTop={categorySummary.length > 0}
                              />
                            </button>
                          );
                        })()}
                      </div>
                    </section>
                  );
                })}

                {isLoading &&
                visibleCategoryGroups.length === 0 &&
                productRecommendationGroups.length === 0 ? (
                  <div className="space-y-4" aria-busy="true">
                    {[1, 2].map((i) => (
                      <CustomizeGroupSkeleton key={`loading-rec-${i}`} />
                    ))}
                  </div>
                ) : null}

                {!isLoading &&
                visibleCategoryGroups.length === 0 &&
                visibleProductRecommendationGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No add-ons available.
                  </p>
                ) : null}

                {personalizeGroups.length > 0 ? (
                  <PersonalizeOptionsSection
                    groups={personalizeGroups}
                    selectedByGroup={selectedPersonalizeByGroup}
                    onToggle={togglePersonalizeOption}
                  />
                ) : null}
              </div>
            </div>

            <footer className="shrink-0 border-t border-[#f0f0f0] bg-white px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-[3px] bg-white text-base font-semibold text-[#1f1f2e] shadow-sm ring-1 ring-[#ececec] transition hover:bg-[#fafafa] active:scale-90"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-[#1f1f2e]">
                    {String(quantity).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-[3px] text-base font-semibold text-[#333] shadow-sm transition hover:brightness-95 active:scale-90"
                    style={{ backgroundColor: ORDER_ACCENT_GOLD }}
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleConfirm}
                  className="flex h-[50px] min-h-[50px] flex-1 items-center justify-between rounded-lg px-[30px] text-sm font-bold text-primary shadow-sm transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60"
                  style={{ backgroundColor: ORDER_ACCENT_GOLD }}
                >
                  <span>{isLoading ? t('loadingMenu') : t('add')}</span>
                  <span className="tabular-nums">
                    {formatMoney(selectedUnitTotal * quantity)}
                  </span>
                </button>
              </div>
            </footer>

            {picker &&
            !activeCategoryOptionTarget &&
            !activeProductGroup ? (
              <aside
                className="absolute inset-0 flex min-h-0 flex-col justify-end bg-black/40"
                style={{ zIndex: 80 }}
                aria-modal="true"
                role="dialog"
                aria-labelledby="product-customize-picker-title"
              >
                <div className="flex max-h-[min(62dvh,32rem)] w-full shrink-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-in slide-in-from-bottom-8 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]">
                  <div className="shrink-0 px-4 pb-0 pt-3">
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
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
                    {pickerEntries.length === 0 ? (
                      <div className="space-y-2 py-1" aria-busy="true">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={`picker-skel-${i}`}
                            className="flex w-full items-center gap-3 rounded-lg p-2 animate-pulse"
                          >
                            <div className="h-14 w-14 shrink-0 rounded-lg bg-muted-foreground/15" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="h-4 w-3/4 rounded bg-muted-foreground/15" />
                              <div className="h-3 w-1/3 rounded bg-muted-foreground/10" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      pickerEntries.map((entry, index) => (
                        <div
                          key={`picker-${entry.id || 'row'}-${index}`}
                          className="flex w-full items-center gap-3 rounded-xl px-1 py-2"
                        >
                          <LazyMenuProductImage
                            src={entry.imageUrl}
                            alt={entry.name}
                            emptyLabel=""
                            className="h-14 w-14 shrink-0 rounded-lg"
                          />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={entry.onChoose}
                          >
                            <p className="truncate text-sm font-semibold uppercase leading-snug text-foreground">
                              {entry.name}
                            </p>
                            {entry.priceLabel ? (
                              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                                {entry.priceLabel}
                              </p>
                            ) : null}
                          </button>
                          {picker.kind === 'group-multi' ? (
                            <div className="ml-auto flex items-center gap-1.5">
                              {entry.quantity ? (
                                <>
                                  <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-base font-semibold"
                                    disabled={!entry.quantity}
                                    onClick={entry.onDecrease}
                                    aria-label={`Decrease ${entry.name}`}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums">
                                    {entry.quantity ?? 0}
                                  </span>
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-90"
                                onClick={entry.onIncrease ?? entry.onChoose}
                                aria-label={`Add ${entry.name}`}
                              >
                                <Plus className="h-4 w-4" strokeWidth={2.75} />
                              </button>
                            </div>
                          ) : (
                            <AddPlusButton
                              selected={entry.selected}
                              label={`${t('select')} ${entry.name}`}
                              onClick={entry.onChoose}
                            />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {(() => {
                    if (
                      picker.kind === 'group-multi' ||
                      picker.kind === 'group-single'
                    ) {
                      const currentGroupId = picker.groupId;
                      const group = categoryGroups.find(
                        (g) => g.id === currentGroupId
                      );
                      if (!group) return null;
                      const limits = limitsForGroup(group);
                      const min = limits.minItems ?? (group.required ? 1 : 0);
                      const isOptional = min === 0;
                      const selectedCount = totalSelectedUnits(
                        selectedByGroup[group.id] ?? []
                      );
                      const hasSelection = selectedCount > 0;
                      const buttonText =
                        isOptional && !hasSelection
                          ? t('customizeNoThanks')
                          : t('select');
                      const isDisabled = !isOptional && selectedCount < min;

                      return (
                        <div className="shrink-0 border-t border-[#ececf0] bg-white p-4 pt-3">
                          <button
                            type="button"
                            className={PICKER_CONFIRM_BUTTON}
                            style={{ backgroundColor: ORDER_ACCENT_GOLD }}
                            disabled={isDisabled}
                            onClick={() => {
                              if (isOptional && !hasSelection) {
                                const nextSkipped = {
                                  ...skippedOptionalGroupIdsRef.current,
                                  [currentGroupId]: true as const,
                                };
                                skippedOptionalGroupIdsRef.current = nextSkipped;
                                setSkippedOptionalGroupIds(nextSkipped);
                                const nextSelectedByGroup = {
                                  ...selectedByGroup,
                                  [currentGroupId]: [],
                                };
                                setSelectedByGroup(nextSelectedByGroup);
                                clearOptionDataForGroup(
                                  currentGroupId,
                                  nestedOptionConfigs,
                                  selectedNestedVariationByOption
                                );
                                applyNextPendingPicker(
                                  selectedVariationId,
                                  nextSelectedByGroup,
                                  selectedNestedVariationByOption,
                                  productRecPickerContext()
                                );
                                return;
                              }

                              const nextPicker = getNextPendingPicker(
                                selectedVariationId,
                                selectedByGroup,
                                selectedNestedVariationByOption,
                                productRecPickerContext()
                              );
                              if (
                                nextPicker?.kind === 'category-option-sheet' ||
                                nextPicker?.kind === 'nested'
                              ) {
                                applyNextPendingPicker(
                                  selectedVariationId,
                                  selectedByGroup,
                                  selectedNestedVariationByOption,
                                  productRecPickerContext()
                                );
                                return;
                              }
                              if (
                                nextPicker &&
                                'groupId' in nextPicker &&
                                nextPicker.groupId === currentGroupId
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
                            {buttonText}
                          </button>
                        </div>
                      );
                    }

                    if (picker.kind === 'recommendation-product-variation') {
                      const currentRecGroupId = picker.groupId;
                      const group = productRecommendationGroups.find(
                        (g) => g.id === currentRecGroupId
                      );
                      if (!group) return null;
                      const isOptional = !group.required;
                      const hasSelectedVar = Boolean(
                        preselectedRecommendationVariationByGroup[currentRecGroupId]
                      );
                      const buttonText =
                        isOptional && !hasSelectedVar
                          ? t('customizeNoThanks')
                          : t('select');
                      const isDisabled = !isOptional && !hasSelectedVar;

                      return (
                        <div className="shrink-0 border-t border-[#ececf0] bg-white p-4 pt-3">
                          <button
                            type="button"
                            className={PICKER_CONFIRM_BUTTON}
                            style={{ backgroundColor: ORDER_ACCENT_GOLD }}
                            disabled={isDisabled}
                            onClick={() => {
                              setPicker(null);
                              applyNextPendingPicker(
                                selectedVariationId,
                                selectedByGroup,
                                selectedNestedVariationByOption,
                                productRecPickerContext()
                              );
                            }}
                          >
                            {buttonText}
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              </aside>
            ) : null}

            {activeCategoryOptionTarget ? (
              <NestedRecommendationSheet
                open
                stackClassName="z-[120]"
                stackZIndex={120}
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
                onClose={() => {
                  const target = activeCategoryOptionTarget;
                  setActiveCategoryOption(null);
                  if (!target) return;
                  if (nestedOptionConfigs[target.key]) return;
                  setSelectedByGroup((prev) => {
                    const current = prev[target.group.id] ?? [];
                    const nextIds = current.filter(
                      (id) => id !== target.optionId
                    );
                    if (nextIds.length === current.length) return prev;
                    return { ...prev, [target.group.id]: nextIds };
                  });
                }}
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
                stackClassName="z-[120]"
                stackZIndex={120}
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
