'use client';

import { Check, Loader2, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { LazyMenuProductImage } from '@/components/menu/lazy-menu-product-image';
import type {
  AttributeGroup,
  ProductVariationOption,
  SelectedProductVariation,
} from '@/components/order/product-customize-dialog';
import type { NestedRecommendationResult } from '@/components/order/nested-recommendation-sheet';
import type { PersonalizeGroup } from '@/components/order/personalize-options-section';
import { buildConfirmModifierSelections } from '@/lib/menu/build-confirm-modifier-selections';
import type { ModifierGroupSelection } from '@/lib/menu/build-modifier-selections';
import {
  configurationAddonPriceLabel,
  configurationDefaultListUnitPriceForSelection,
  configurationItemResolvedListUnit,
  filterConfigurationItemsForGroup,
  isConfigurationGroupVisibleForFilters,
  parentVariationFromItemVariation,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import {
  fetchOptionNestedSheetPayload,
  peekOptionNestedSheetPayload,
  type OptionNestedSheetPayload,
} from '@/lib/menu/fetch-menu-product-detail';
import { customerMenuItemImageUrl } from '@/lib/menu/menu-item-image-utils';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import {
  productRecommendationVariationUnitPrice,
  productUnitPriceWithVariation,
} from '@/lib/menu/recommendation-addon-price';
import { getRecommendationLimits } from '@/lib/menu/recommendation-limits';
import {
  optionNeedsManualVariationPicker,
  optionSelectionKey,
} from '@/lib/menu/recommendation-option-utils';
import type { UiLanguage } from '@/lib/i18n/resources';
import type { RestaurantRegionalSettings } from '@/lib/restaurant-regional';
import { cn } from '@/lib/utils';

type Item = AttributeGroup['items'][number];

type Bag = {
  variationId: string | null;
  selectedByGroup: Record<string, string[]>;
  personalize: Record<string, string[]>;
};

type Draft = {
  bags: Record<string, Bag>;
  nestsLoaded: Record<string, OptionNestedSheetPayload>;
  stepId: string | null;
  qty: number;
  confirm: boolean;
};

type StepKind = 'variation' | 'choose' | 'pool' | 'yes' | 'leave';

type FlowStep = {
  id: string;
  scope: string;
  kind: StepKind;
  title: string;
  hint: string;
  sidebar: string;
  required: boolean;
  allowSkip: boolean;
  stayUntilMin: boolean;
  group?: AttributeGroup;
  item?: Item;
  items?: Item[];
  variations?: ProductVariationOption[];
  priceBase?: number;
  personalizeGroup?: PersonalizeGroup;
  personalizeOptionId?: string;
  minItems: number;
  maxItems: number;
};

type Props = {
  productName: string;
  productImageUrl?: string | null;
  productDescription?: string | null;
  productBaseUnitPrice: number;
  variations: ProductVariationOption[];
  attributeGroups: AttributeGroup[];
  personalizeGroups: PersonalizeGroup[];
  ready: boolean;
  lang: UiLanguage;
  slug: string;
  formatMoney: (n: number) => string;
  regional?: Partial<RestaurantRegionalSettings>;
  onClose: () => void;
  onConfirm: (
    mods: ModifierGroupSelection[],
    variation: SelectedProductVariation | null,
    quantity: number
  ) => void;
};

const ROOT = 'root';

function emptyBag(): Bag {
  return { variationId: null, selectedByGroup: {}, personalize: {} };
}

function bagOf(draft: Draft, scope: string): Bag {
  return draft.bags[scope] ?? emptyBag();
}

function textOf(value: unknown, lang: UiLanguage): string {
  return resolveBilingualText(value as string, lang);
}

function cleanDescription(value: string): string {
  return value
    .replace(/^\s*(?:€|\$|£)?\s*\d+[.,]\d{2}\s*[€$£]?\s*/u, '')
    .trim();
}

function parentFrom(
  variations: ProductVariationOption[],
  variationId: string | null
): ParentVariationContext | null {
  if (!variationId) return null;
  const v = variations.find((x) => x.id === variationId);
  if (!v) return null;
  return {
    id: v.id,
    name: v.name,
    title: v.name,
    restaurantVariationId: v.restaurantVariationId ?? null,
  };
}

function mergeItem(
  item: Item,
  loaded: Record<string, OptionNestedSheetPayload>
): Item {
  const nest = loaded[item.menuItemId];
  if (!nest) return item;
  return {
    ...item,
    nestedAttributeGroups: nest.nestedAttributeGroups,
    personalizeGroups: nest.personalizeGroups ?? item.personalizeGroups,
    needsNestedSheet: false,
  };
}

function groupMin(group: AttributeGroup, variationId: string | null): number {
  if (group.selectionType === 'SINGLE') return group.required ? 1 : 0;
  const limits = getRecommendationLimits(
    {
      selectionType: 'MULTIPLE',
      minItems: group.minItems ?? null,
      maxItems: group.maxItems ?? null,
      variationLimits: group.variationLimits,
    },
    variationId
  );
  return limits.minItems;
}

function groupMax(group: AttributeGroup, variationId: string | null): number {
  if (group.selectionType !== 'MULTIPLE') return 1;
  return getRecommendationLimits(
    {
      selectionType: 'MULTIPLE',
      minItems: group.minItems ?? null,
      maxItems: group.maxItems ?? null,
      variationLimits: group.variationLimits,
    },
    variationId
  ).maxItems;
}

function countOf(ids: string[], optionId?: string): number {
  if (!optionId) return ids.length;
  return ids.filter((id) => id === optionId).length;
}

type BuildCtx = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  lang: UiLanguage;
  variations: ProductVariationOption[];
  attributeGroups: AttributeGroup[];
  personalizeGroups: PersonalizeGroup[];
};

function pushGroupSteps(
  steps: FlowStep[],
  groups: AttributeGroup[],
  personalizeGroups: PersonalizeGroup[],
  scope: string,
  parent: ParentVariationContext | null,
  draft: Draft,
  ctx: BuildCtx,
  depth: number
) {
  if (depth > 4) return;
  const bag = bagOf(draft, scope);

  for (const group of groups) {
    if (group.sourceType === 'PRODUCT') {
      const raw = group.items[0];
      if (!raw) continue;
      const item = mergeItem(raw, draft.nestsLoaded);
      const selected = bag.selectedByGroup[group.id] ?? [];
      const name = textOf(item.name, ctx.lang);
      const required = Boolean(group.required);
      steps.push({
        id: `yes:${scope}:${group.id}:${item.menuItemId}`,
        scope,
        kind: 'yes',
        title: ctx.t('kioskAskAdd', { name }),
        hint: ctx.t('kioskTapToAdd'),
        sidebar: name,
        required,
        allowSkip: !required,
        stayUntilMin: false,
        group,
        item,
        minItems: required ? 1 : 0,
        maxItems: 1,
      });
      if (selected.includes(item.menuItemId)) {
        pushItemNest(
          steps,
          group,
          item,
          `rec:${scope}:${group.id}`,
          parent,
          draft,
          ctx,
          depth
        );
      }
      continue;
    }

    if (!isConfigurationGroupVisibleForFilters(group, parent)) continue;
    const items = filterConfigurationItemsForGroup(group.items, {
      parentVariation: parent,
      useVariationPricing: group.useVariationPricing,
      defaultLinkedRestaurantVariationId:
        group.defaultLinkedRestaurantVariationId,
    }).map((item) => mergeItem(item, draft.nestsLoaded));
    if (items.length === 0) continue;
    const min = groupMin(group, bag.variationId);
    const max = groupMax(group, bag.variationId);
    const selected = bag.selectedByGroup[group.id] ?? [];
    const chooseOne = group.selectionType !== 'MULTIPLE' || max <= 1;
    const groupName = textOf(group.name, ctx.lang);

    if (chooseOne) {
      const picked = items.find((item) => selected.includes(item.menuItemId));
      steps.push({
        id: `choose:${scope}:${group.id}`,
        scope,
        kind: 'choose',
        title: groupName,
        hint: ctx.t('kioskTapChoice'),
        sidebar: picked ? textOf(picked.name, ctx.lang) : groupName,
        required: min > 0,
        allowSkip: min <= 0,
        stayUntilMin: false,
        group,
        items,
        minItems: min,
        maxItems: max,
      });
      if (picked) {
        pushItemNest(
          steps,
          group,
          picked,
          `opt:${scope}:${group.id}:${picked.menuItemId}`,
          parent,
          draft,
          ctx,
          depth
        );
      }
      continue;
    }

    const pickedNames = items.filter((item) =>
      selected.includes(item.menuItemId)
    );
    steps.push({
      id: `pool:${scope}:${group.id}`,
      scope,
      kind: 'pool',
      title: groupName,
      hint:
        min > 1
          ? ctx.t('kioskTapAtLeast', { count: min })
          : ctx.t('kioskTapAny'),
      sidebar:
        pickedNames.length === 1
          ? textOf(pickedNames[0]!.name, ctx.lang)
          : groupName,
      required: min > 0,
      allowSkip: min <= 0,
      stayUntilMin: false,
      group,
      items,
      minItems: min,
      maxItems: max,
    });
    for (const item of items) {
      if (!selected.includes(item.menuItemId)) continue;
      pushItemNest(
        steps,
        group,
        item,
        `opt:${scope}:${group.id}:${item.menuItemId}`,
        parent,
        draft,
        ctx,
        depth
      );
    }
  }

  for (const group of personalizeGroups) {
    const chosen = bag.personalize[group.id] ?? [];
    const max = Math.max(1, group.maxItems || 1);
    for (const option of group.options) {
      const on = chosen.includes(option.id);
      if (!on && chosen.length >= max) continue;
      const name = textOf(option.name, ctx.lang);
      steps.push({
        id: `leave:${scope}:${group.id}:${option.id}`,
        scope,
        kind: 'leave',
        title: ctx.t('kioskAskLeave', { name }),
        hint: ctx.t('kioskTapToLeave'),
        sidebar: name,
        required: false,
        allowSkip: true,
        stayUntilMin: false,
        personalizeGroup: group,
        personalizeOptionId: option.id,
        minItems: 0,
        maxItems: max,
      });
    }
  }
}

function pushItemNest(
  steps: FlowStep[],
  group: AttributeGroup,
  item: Item,
  scope: string,
  fallbackParent: ParentVariationContext | null,
  draft: Draft,
  ctx: BuildCtx,
  depth: number
) {
  const child = bagOf(draft, scope);
  const manual = optionNeedsManualVariationPicker(item, group);
  const variations = (item.variations ?? []).map((v) => ({
    id: v.id,
    name: textOf(v.name ?? v.title ?? '', ctx.lang) || ctx.t('variationLabel'),
    imageUrl: v.imageUrl ?? null,
    swatchHex: v.swatchHex ?? null,
    priceDelta: v.priceDelta,
    restaurantVariationId: v.restaurantVariationId ?? null,
  }));
  if (manual && variations.length > 1) {
    const picked = variations.find((v) => v.id === child.variationId);
    steps.push({
      id: `var:${scope}`,
      scope,
      kind: 'variation',
      title: ctx.t('kioskChooseNamed', { name: ctx.t('variationLabel') }),
      hint: ctx.t('kioskTapChoice'),
      sidebar: picked
        ? ctx.t('kioskSizeLine', { name: picked.name })
        : ctx.t('variationLabel'),
      required: true,
      allowSkip: false,
      stayUntilMin: false,
      variations,
      priceBase: item.price,
      minItems: 1,
      maxItems: 1,
    });
  }
  const parent =
    parentVariationFromItemVariation(item.variations, child.variationId) ??
    fallbackParent;
  pushGroupSteps(
    steps,
    item.nestedAttributeGroups ?? [],
    item.personalizeGroups ?? [],
    scope,
    parent,
    draft,
    ctx,
    depth + 1
  );
}

function buildSteps(draft: Draft, ctx: BuildCtx): FlowStep[] {
  const steps: FlowStep[] = [];
  const root = bagOf(draft, ROOT);
  if (ctx.variations.length > 1) {
    const picked = ctx.variations.find((v) => v.id === root.variationId);
    steps.push({
      id: 'var:root',
      scope: ROOT,
      kind: 'variation',
      title: ctx.t('kioskChooseNamed', { name: ctx.t('variationLabel') }),
      hint: ctx.t('kioskTapChoice'),
      sidebar: picked
        ? ctx.t('kioskSizeLine', { name: picked.name })
        : ctx.t('variationLabel'),
      required: true,
      allowSkip: false,
      stayUntilMin: false,
      variations: ctx.variations,
      minItems: 1,
      maxItems: 1,
    });
  }
  const parent = parentFrom(ctx.variations, root.variationId);
  pushGroupSteps(
    steps,
    ctx.attributeGroups,
    ctx.personalizeGroups,
    ROOT,
    parent,
    draft,
    ctx,
    0
  );
  return steps;
}

function chosen(step: FlowStep, draft: Draft): boolean {
  const bag = bagOf(draft, step.scope);
  if (step.kind === 'variation') return Boolean(bag.variationId);
  if (step.kind === 'leave') {
    return (bag.personalize[step.personalizeGroup?.id ?? ''] ?? []).includes(
      step.personalizeOptionId ?? ''
    );
  }
  const ids = bag.selectedByGroup[step.group?.id ?? ''] ?? [];
  if (step.kind === 'choose') return ids.length > 0;
  if (step.kind === 'pool') {
    if (step.minItems > 0) return ids.length >= step.minItems;
    return ids.length > 0;
  }
  return ids.includes(step.item?.menuItemId ?? '');
}

function pinSingleVariation(
  draft: Draft,
  scope: string,
  group: AttributeGroup,
  item: Item
): Draft {
  const merged = mergeItem(item, draft.nestsLoaded);
  if (!optionNeedsManualVariationPicker(merged, group)) return draft;
  const only = merged.variations ?? [];
  if (only.length !== 1) return draft;
  const childScope =
    group.sourceType === 'PRODUCT'
      ? `rec:${scope}:${group.id}`
      : `opt:${scope}:${group.id}:${merged.menuItemId}`;
  return patchBag(draft, childScope, (current) => ({
    ...current,
    variationId: current.variationId ?? only[0]!.id,
  }));
}

function writeBag(draft: Draft, scope: string, bag: Bag): Draft {
  return { ...draft, bags: { ...draft.bags, [scope]: bag } };
}

function patchBag(draft: Draft, scope: string, patch: (bag: Bag) => Bag): Draft {
  const current = bagOf(draft, scope);
  return writeBag(draft, scope, patch({
    variationId: current.variationId,
    selectedByGroup: { ...current.selectedByGroup },
    personalize: { ...current.personalize },
  }));
}

function modsForScope(
  groups: AttributeGroup[],
  personalizeGroups: PersonalizeGroup[],
  scope: string,
  parent: ParentVariationContext | null,
  draft: Draft,
  lang: UiLanguage,
  depth: number
): ModifierGroupSelection[] {
  if (depth > 4) return [];
  const bag = bagOf(draft, scope);
  const category = groups
    .filter((g) => g.sourceType !== 'PRODUCT')
    .map((g) => ({
      ...g,
      items: g.items.map((item) => mergeItem(item, draft.nestsLoaded)),
    }))
    .filter((g) => isConfigurationGroupVisibleForFilters(g, parent));
  const recs = groups
    .filter((g) => g.sourceType === 'PRODUCT')
    .filter((g) => (bag.selectedByGroup[g.id] ?? []).length > 0);

  const nestedOptionConfigs: Record<string, NestedRecommendationResult> = {};
  const selectedNestedVariationByOption: Record<string, string> = {};
  for (const group of category) {
    const ids = bag.selectedByGroup[group.id] ?? [];
    const unique = group.selectionType === 'SINGLE' ? ids.slice(0, 1) : [...new Set(ids)];
    for (const optionId of unique) {
      const item = group.items.find((it) => it.menuItemId === optionId);
      if (!item) continue;
      const childScope = `opt:${scope}:${group.id}:${optionId}`;
      const child = bagOf(draft, childScope);
      const key = optionSelectionKey(group.id, optionId);
      if (child.variationId) selectedNestedVariationByOption[key] = child.variationId;
      const childParent =
        parentVariationFromItemVariation(item.variations, child.variationId) ??
        parent;
      const childMods = modsForScope(
        item.nestedAttributeGroups ?? [],
        item.personalizeGroups ?? [],
        childScope,
        childParent,
        draft,
        lang,
        depth + 1
      );
      if (childMods.length > 0 || child.variationId) {
        nestedOptionConfigs[key] = {
          productVariationId: child.variationId ?? '',
          selectedByGroup: {},
          selectedNestedVariationByOption: {},
          mods: childMods,
        };
      }
    }
  }

  const nestedConfigs: Record<string, NestedRecommendationResult> = {};
  const preselected: Record<string, string> = {};
  for (const group of recs) {
    const item = mergeItem(group.items[0]!, draft.nestsLoaded);
    const childScope = `rec:${scope}:${group.id}`;
    const child = bagOf(draft, childScope);
    if (child.variationId) preselected[group.id] = child.variationId;
    const childParent =
      parentVariationFromItemVariation(item.variations, child.variationId) ??
      parent;
    nestedConfigs[group.id] = {
      productVariationId: child.variationId ?? '',
      selectedByGroup: {},
      selectedNestedVariationByOption: {},
      mods: modsForScope(
        item.nestedAttributeGroups ?? [],
        item.personalizeGroups ?? [],
        childScope,
        childParent,
        draft,
        lang,
        depth + 1
      ),
    };
  }

  return buildConfirmModifierSelections({
    visibleCategoryGroups: category,
    selectedByGroup: bag.selectedByGroup,
    selectedNestedVariationByOption,
    nestedOptionConfigs,
    visibleProductRecommendationGroups: recs,
    nestedConfigs,
    preselectedRecommendationVariationByGroup: preselected,
    personalizeGroups,
    selectedPersonalizeByGroup: bag.personalize,
    parentVariation: parent,
    parentVariationShortLabel: null,
    selectionTimeline: [],
    allGroupsFlat: category,
    lang,
  });
}

function itemPriceLabel(
  item: Item,
  group: AttributeGroup,
  parent: ParentVariationContext | null,
  selectedIds: string[],
  regional: Partial<RestaurantRegionalSettings> | undefined,
  formatMoney: (n: number) => string
): string | null {
  if (group.sourceType === 'PRODUCT') {
    const uplift = productRecommendationVariationUnitPrice(item, null);
    if (uplift > 0) return formatMoney(uplift);
    return null;
  }
  const visible = filterConfigurationItemsForGroup(group.items, {
    parentVariation: parent,
    useVariationPricing: group.useVariationPricing,
    defaultLinkedRestaurantVariationId: group.defaultLinkedRestaurantVariationId,
  });
  const listUnit = configurationItemResolvedListUnit(
    item,
    parent,
    group.useVariationPricing ?? false,
    null
  );
  const baseline = configurationDefaultListUnitPriceForSelection(
    group,
    parent,
    visible
  );
  return configurationAddonPriceLabel(listUnit, baseline, {
    freeQuantity: group.freeQuantity,
    multipleMode: group.multipleMode,
    groupSelectedIds: selectedIds,
    optionId: item.menuItemId,
    regional,
    categoryDiscountPercent: group.categoryDiscountPercent,
    categoryExtraCostPercent: group.categoryExtraCostPercent,
  });
}

export function KioskItemFlow({
  productName,
  productImageUrl,
  productDescription,
  productBaseUnitPrice,
  variations,
  attributeGroups,
  personalizeGroups,
  ready,
  lang,
  slug,
  formatMoney,
  regional,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const confirmedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    const root = emptyBag();
    if (variations.length === 1) root.variationId = variations[0]!.id;
    return {
      bags: { [ROOT]: root },
      nestsLoaded: {},
      stepId: null,
      qty: 1,
      confirm: false,
    };
  });

  const ctx = useMemo<BuildCtx>(
    () => ({
      t: (key, vars) => String(t(key, vars)),
      lang,
      variations,
      attributeGroups,
      personalizeGroups,
    }),
    [t, lang, variations, attributeGroups, personalizeGroups]
  );

  const steps = useMemo(() => (ready ? buildSteps(draft, ctx) : []), [ready, draft, ctx]);
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === draft.stepId)
  );
  const step = steps[index] ?? null;
  const last = step != null && index === steps.length - 1;
  const stepRailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const rail = stepRailRef.current;
    if (!rail || !step) return;
    rail.querySelector<HTMLElement>('[data-now="true"]')?.scrollIntoView({
      block: 'nearest',
    });
  }, [step]);

  function go(next: Draft, fromId: string) {
    const list = buildSteps(next, ctx);
    const at = list.findIndex((s) => s.id === fromId);
    const following = list[at + 1];
    if (!following) return { ...next, confirm: true, stepId: fromId };
    return { ...next, confirm: false, stepId: following.id };
  }

  async function accept(optionId: string) {
    if (!step || busy) return;
    let nestsLoaded = draft.nestsLoaded;
    const item = step.item ?? step.items?.find((it) => it.menuItemId === optionId);
    const needsFetch = Boolean(item?.needsNestedSheet);
    if (needsFetch && item) {
      const cachedNest = peekOptionNestedSheetPayload(
        item.menuItemId,
        { slug },
        (id) => customerMenuItemImageUrl(id, { slug }),
        lang
      );
      if (cachedNest) {
        nestsLoaded = { ...nestsLoaded, [item.menuItemId]: cachedNest };
      } else {
        setBusy(true);
        try {
          const payload = await fetchOptionNestedSheetPayload(
            item.menuItemId,
            { slug },
            (id) => customerMenuItemImageUrl(id, { slug }),
            lang
          );
          if (!payload) {
            toast.error(t('configureRecommendation'));
            return;
          }
          nestsLoaded = { ...nestsLoaded, [item.menuItemId]: payload };
        } finally {
          setBusy(false);
        }
      }
    }

    setDraft((prev) => {
      const withNest = { ...prev, nestsLoaded };
      const bag = bagOf(withNest, step.scope);
      let next = withNest;
      if (step.kind === 'variation') {
        next = patchBag(withNest, step.scope, (current) => ({
          ...current,
          variationId: optionId,
        }));
      } else if (step.kind === 'choose' && step.group) {
        const picked = step.items?.find((it) => it.menuItemId === optionId);
        next = patchBag(withNest, step.scope, (current) => ({
          ...current,
          selectedByGroup: {
            ...current.selectedByGroup,
            [step.group!.id]: [optionId],
          },
        }));
        if (picked) next = pinSingleVariation(next, step.scope, step.group, picked);
      } else if (step.kind === 'pool' && step.group) {
        const ids = [...(bag.selectedByGroup[step.group.id] ?? [])];
        const quantity = step.group.multipleMode === 'QUANTITY';
        const have = countOf(ids, optionId);
        if (quantity) {
          if (ids.length < step.maxItems) ids.push(optionId);
        } else if (have > 0) {
          const at = ids.indexOf(optionId);
          if (at >= 0) ids.splice(at, 1);
        } else if (ids.length < step.maxItems) {
          ids.push(optionId);
        }
        next = patchBag(withNest, step.scope, (current) => ({
          ...current,
          selectedByGroup: {
            ...current.selectedByGroup,
            [step.group!.id]: ids,
          },
        }));
        const picked = step.items?.find((it) => it.menuItemId === optionId);
        if (picked && countOf(ids, optionId) > 0) {
          next = pinSingleVariation(next, step.scope, step.group, picked);
        }
        const before = countOf(
          bag.selectedByGroup[step.group.id] ?? [],
          optionId
        );
        const added = countOf(ids, optionId) > before;
        const reachedMax = step.maxItems > 0 && ids.length >= step.maxItems;
        const finishedLast =
          last &&
          ids.length >= step.minItems &&
          (step.minItems > 0 || ids.length > 0);
        if (added && (reachedMax || finishedLast)) return go(next, step.id);
        return next;
      } else if (step.kind === 'yes' && step.group && step.item) {
        const ids = [...(bag.selectedByGroup[step.group.id] ?? [])];
        const have = countOf(ids, step.item.menuItemId);
        if (step.stayUntilMin && have < step.maxItems) ids.push(step.item.menuItemId);
        else if (!ids.includes(step.item.menuItemId)) ids.push(step.item.menuItemId);
        next = patchBag(withNest, step.scope, (current) => ({
          ...current,
          selectedByGroup: { ...current.selectedByGroup, [step.group!.id]: ids },
        }));
        next = pinSingleVariation(next, step.scope, step.group, step.item);
        const count = (next.bags[step.scope]?.selectedByGroup[step.group.id] ?? [])
          .length;
        if (step.stayUntilMin && count < step.minItems) return next;
      } else if (step.kind === 'leave' && step.personalizeGroup && step.personalizeOptionId) {
        const cur = [...(bag.personalize[step.personalizeGroup.id] ?? [])];
        if (!cur.includes(step.personalizeOptionId) && cur.length < step.maxItems) {
          cur.push(step.personalizeOptionId);
        }
        next = patchBag(withNest, step.scope, (current) => ({
          ...current,
          personalize: { ...current.personalize, [step.personalizeGroup!.id]: cur },
        }));
      }
      return go(next, step.id);
    });
  }

  function skip() {
    if (!step || !step.allowSkip || busy) return;
    setDraft((prev) => {
      let next = prev;
      if ((step.kind === 'choose' || step.kind === 'pool') && step.group) {
        next = patchBag(prev, step.scope, (current) => ({
          ...current,
          selectedByGroup: { ...current.selectedByGroup, [step.group!.id]: [] },
        }));
      } else if (step.kind === 'yes' && step.group && step.item) {
        const ids = (bagOf(prev, step.scope).selectedByGroup[step.group.id] ?? []).filter(
          (id) => id !== step.item!.menuItemId
        );
        next = patchBag(prev, step.scope, (current) => ({
          ...current,
          selectedByGroup: { ...current.selectedByGroup, [step.group!.id]: ids },
        }));
      } else if (step.kind === 'leave' && step.personalizeGroup && step.personalizeOptionId) {
        const ids = (
          bagOf(prev, step.scope).personalize[step.personalizeGroup.id] ?? []
        ).filter((id) => id !== step.personalizeOptionId);
        next = patchBag(prev, step.scope, (current) => ({
          ...current,
          personalize: { ...current.personalize, [step.personalizeGroup!.id]: ids },
        }));
      }
      return go(next, step.id);
    });
  }

  function dropOne(optionId: string) {
    if (!step || step.kind !== 'pool' || !step.group || busy) return;
    setDraft((prev) => {
      const ids = [
        ...(bagOf(prev, step.scope).selectedByGroup[step.group!.id] ?? []),
      ];
      const at = ids.indexOf(optionId);
      if (at >= 0) ids.splice(at, 1);
      return patchBag(prev, step.scope, (current) => ({
        ...current,
        selectedByGroup: { ...current.selectedByGroup, [step.group!.id]: ids },
      }));
    });
  }

  function advance() {
    if (!step || step.kind !== 'pool' || !step.group || busy) return;
    const count = (
      bagOf(draft, step.scope).selectedByGroup[step.group.id] ?? []
    ).length;
    if (count < step.minItems) return;
    setDraft((prev) => go(prev, step.id));
  }

  function back() {
    if (index <= 0) {
      onClose();
      return;
    }
    setDraft((prev) => ({ ...prev, stepId: steps[index - 1]!.id, confirm: false }));
  }

  useEffect(() => {
    if (!ready || confirmedRef.current) return;
    if (!draft.confirm && steps.length > 0) return;
    confirmedRef.current = true;
    const root = bagOf(draft, ROOT);
    const parent = parentFrom(variations, root.variationId);
    const mods = modsForScope(
      attributeGroups,
      personalizeGroups,
      ROOT,
      parent,
      draft,
      lang,
      0
    );
    const selected = variations.find((v) => v.id === root.variationId) ?? null;
    const variation = selected
      ? {
          id: selected.id,
          name: selected.name,
          swatchHex: selected.swatchHex,
          priceDelta: productUnitPriceWithVariation(
            productBaseUnitPrice,
            selected.priceDelta,
            variations
          ),
        }
      : null;
    onConfirmRef.current(mods, variation, Math.max(1, draft.qty));
  }, [
    ready,
    draft,
    steps.length,
    attributeGroups,
    personalizeGroups,
    variations,
    lang,
    productBaseUnitPrice,
  ]);

  const rootBag = bagOf(draft, ROOT);
  const rootParent = parentFrom(variations, rootBag.variationId);
  const poolSelected =
    step?.kind === 'pool'
      ? (bagOf(draft, step.scope).selectedByGroup[step.group?.id ?? ''] ?? [])
      : [];

  return (
    <div className="kiosk-pick flex min-h-0 flex-1 flex-col bg-[#fffaf5]">
      <div className="flex items-center gap-3 border-b border-[#f1e6dc] px-4 py-3">
        <button type="button" className="kiosk-pick-back" onClick={back}>
          {t('back')}
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#9a3412]">
          {ready && step
            ? t('kioskPickProgress', {
                n: index + 1,
                total: steps.length,
                name: step.sidebar,
              })
            : t('kioskLoadingChoices')}
        </p>
      </div>

      {!ready || !step ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="kiosk-pick-layout min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="w-full max-w-[560px] shrink-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white p-3 shadow-sm">
                  <LazyMenuProductImage
                    src={productImageUrl}
                    hasImage={Boolean(productImageUrl)}
                    alt={productName}
                    className="aspect-square w-full rounded-lg"
                    emptyLabel={productName.slice(0, 1)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-extrabold leading-tight">{productName}</p>
                  {productDescription ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
                      {cleanDescription(productDescription)}
                    </p>
                  ) : null}
                </div>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">{step.title}</h1>
              <p className="mt-1 text-base text-[#57534e]">{step.hint}</p>
              {last ? (
                <div className="mt-4 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    className="kiosk-pick-stepper"
                    aria-label={t('kioskLess')}
                    disabled={draft.qty <= 1}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, qty: Math.max(1, prev.qty - 1) }))
                    }
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="min-w-8 text-center text-2xl font-extrabold">
                    {draft.qty}
                  </span>
                  <button
                    type="button"
                    className="kiosk-pick-stepper"
                    aria-label={t('kioskMore')}
                    disabled={draft.qty >= 10}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, qty: Math.min(10, prev.qty + 1) }))
                    }
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
              <div
                className={cn(
                  'mt-4',
                  step.kind === 'choose' ||
                    step.kind === 'variation' ||
                    step.kind === 'pool'
                    ? 'kiosk-pick-grid'
                    : 'flex justify-center',
                  step.kind === 'pool' && 'is-pool'
                )}
              >
                {step.kind === 'variation'
                  ? step.variations?.map((v) => {
                      const on = bagOf(draft, step.scope).variationId === v.id;
                      const price = productUnitPriceWithVariation(
                        step.priceBase ?? productBaseUnitPrice,
                        v.priceDelta,
                        step.variations
                      );
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={cn('kiosk-pick-card', on && 'is-on')}
                          onClick={() => void accept(v.id)}
                          disabled={busy}
                        >
                          <CardArt
                            imageUrl={v.imageUrl ?? productImageUrl}
                            name={v.name}
                          />
                          <span className="kiosk-pick-name">{v.name}</span>
                          <span className="kiosk-pick-price">
                            {formatMoney(price)}
                            {on ? '  ✓' : ''}
                          </span>
                        </button>
                      );
                    })
                  : null}
                {step.kind === 'choose'
                  ? step.items?.map((item) => {
                      const ids = bagOf(draft, step.scope).selectedByGroup[step.group?.id ?? ''] ?? [];
                      const on = ids.includes(item.menuItemId);
                      const price = step.group
                        ? itemPriceLabel(item, step.group, rootParent, ids, regional, formatMoney)
                        : null;
                      return (
                        <button
                          key={item.menuItemId}
                          type="button"
                          className={cn('kiosk-pick-card', on && 'is-on')}
                          onClick={() => void accept(item.menuItemId)}
                          disabled={busy}
                        >
                          <CardArt imageUrl={item.imageUrl} name={textOf(item.name, lang)} />
                          <span className="kiosk-pick-name">{textOf(item.name, lang)}</span>
                          {item.description ? (
                            <span className="kiosk-pick-desc">
                              {cleanDescription(textOf(item.description, lang))}
                            </span>
                          ) : null}
                          {price ? <span className="kiosk-pick-price">{price}</span> : null}
                        </button>
                      );
                    })
                  : null}
                {step.kind === 'pool'
                  ? step.items?.map((item) => {
                      const ids =
                        bagOf(draft, step.scope).selectedByGroup[
                          step.group?.id ?? ''
                        ] ?? [];
                      const count = countOf(ids, item.menuItemId);
                      const quantity = step.group?.multipleMode === 'QUANTITY';
                      const atMax = ids.length >= step.maxItems;
                      const price = step.group
                        ? itemPriceLabel(
                            item,
                            step.group,
                            rootParent,
                            ids,
                            regional,
                            formatMoney
                          )
                        : null;
                      const name = textOf(item.name, lang);
                      return (
                        <div
                          key={item.menuItemId}
                          className={cn('kiosk-pick-card', count > 0 && 'is-on')}
                        >
                          <button
                            type="button"
                            className="kiosk-pick-hit"
                            onClick={() => void accept(item.menuItemId)}
                            disabled={busy || (count === 0 && atMax)}
                          >
                            <CardArt imageUrl={item.imageUrl} name={name} />
                            <span className="kiosk-pick-name">{name}</span>
                            {item.description ? (
                              <span className="kiosk-pick-desc">
                                {cleanDescription(textOf(item.description, lang))}
                              </span>
                            ) : null}
                            {price ? (
                              <span className="kiosk-pick-price">{price}</span>
                            ) : null}
                          </button>
                          {quantity && count > 0 ? (
                            <div className="kiosk-pick-qty">
                              <button
                                type="button"
                                className="kiosk-pick-stepper"
                                aria-label={t('kioskLess')}
                                onClick={() => dropOne(item.menuItemId)}
                                disabled={busy}
                              >
                                <Minus className="h-5 w-5" />
                              </button>
                              <span className="min-w-6 text-center text-xl font-extrabold">
                                {count}
                              </span>
                              <button
                                type="button"
                                className="kiosk-pick-stepper"
                                aria-label={t('kioskMore')}
                                onClick={() => void accept(item.menuItemId)}
                                disabled={busy || atMax}
                              >
                                <Plus className="h-5 w-5" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  : null}
                {step.kind === 'yes' && step.item ? (
                  <button
                    type="button"
                    className={cn(
                      'kiosk-pick-card kiosk-pick-one',
                      chosen(step, draft) && 'is-on'
                    )}
                    onClick={() => void accept(step.item!.menuItemId)}
                    disabled={busy}
                  >
                    <CardArt
                      imageUrl={step.item.imageUrl}
                      name={textOf(step.item.name, lang)}
                    />
                    <span className="kiosk-pick-name">{textOf(step.item.name, lang)}</span>
                    {step.item.description ? (
                      <span className="kiosk-pick-desc">
                        {cleanDescription(textOf(step.item.description, lang))}
                      </span>
                    ) : null}
                    {step.group ? (
                      <PriceLine
                        label={itemPriceLabel(
                          step.item,
                          step.group,
                          rootParent,
                          bagOf(draft, step.scope).selectedByGroup[step.group.id] ?? [],
                          regional,
                          formatMoney
                        )}
                      />
                    ) : null}
                  </button>
                ) : null}
                {step.kind === 'leave' && step.personalizeGroup && step.personalizeOptionId ? (
                  <button
                    type="button"
                    className={cn(
                      'kiosk-pick-card kiosk-pick-one',
                      chosen(step, draft) && 'is-on'
                    )}
                    onClick={() => void accept(step.personalizeOptionId!)}
                    disabled={busy}
                  >
                    <CardArt
                      imageUrl={
                        step.personalizeGroup.options.find(
                          (o) => o.id === step.personalizeOptionId
                        )?.imageUrl
                      }
                      name={textOf(
                        step.personalizeGroup.options.find(
                          (o) => o.id === step.personalizeOptionId
                        )?.name ?? '',
                        lang
                      )}
                    />
                    <span className="kiosk-pick-name">
                      {textOf(
                        step.personalizeGroup.options.find(
                          (o) => o.id === step.personalizeOptionId
                        )?.name ?? '',
                        lang
                      )}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
            {step.kind === 'pool' ? (
              <div className="px-4 pb-4">
                {!last &&
                poolSelected.length >= step.minItems &&
                poolSelected.length < step.maxItems &&
                (poolSelected.length > 0 || step.minItems > 0) ? (
                  <button
                    type="button"
                    className="kiosk-pick-next"
                    onClick={advance}
                    disabled={busy}
                  >
                    {t('continue')}
                  </button>
                ) : null}
                {step.allowSkip && poolSelected.length === 0 ? (
                  <button
                    type="button"
                    className="kiosk-pick-skip"
                    onClick={skip}
                    disabled={busy}
                  >
                    {t('kioskNoThanks')}
                  </button>
                ) : null}
              </div>
            ) : step.allowSkip ? (
              <div className="px-4 pb-4">
                <button
                  type="button"
                  className="kiosk-pick-skip"
                  onClick={skip}
                  disabled={busy}
                >
                  {t('kioskNoThanks')}
                </button>
              </div>
            ) : null}
          </div>
          <aside
            ref={stepRailRef}
            className="kiosk-pick-side"
            aria-label={t('kioskChoiceList')}
          >
            <ul className="flex flex-col gap-1.5">
              {steps.map((row, rowIndex) => {
                const on = row.id === step.id;
                const done = chosen(row, draft) && !on;
                return (
                  <li
                    key={row.id}
                    data-now={on ? 'true' : undefined}
                    className={cn(
                      'kiosk-pick-row',
                      on && 'is-now',
                      done && 'is-done'
                    )}
                  >
                    <span className="kiosk-pick-mark" aria-hidden>
                      {done ? <Check className="h-3 w-3" /> : rowIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{row.sidebar}</span>
                    {!done && !on ? (
                      <span className="kiosk-pick-tag">
                        {row.required ? t('customizeRequired') : t('customizeOptional')}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}

function CardArt({
  imageUrl,
  name,
}: {
  imageUrl?: string | null;
  name: string;
}) {
  return (
    <span className="kiosk-pick-art">
      <LazyMenuProductImage
        src={imageUrl}
        hasImage={Boolean(imageUrl)}
        alt=""
        className="h-full w-full"
        emptyLabel={name.slice(0, 1) || '?'}
      />
    </span>
  );
}

function PriceLine({ label }: { label: string | null }) {
  if (!label) return null;
  return <span className="kiosk-pick-price">{label}</span>;
}
