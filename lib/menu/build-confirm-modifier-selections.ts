import { buildModifierSelectionsForGroups } from '@/lib/menu/build-modifier-selections';
import {
  buildPersonalizeModifierSelections,
  type PersonalizeGroupLike,
} from '@/lib/menu/personalize-modifiers';
import type { ParentVariationContext } from '@/lib/menu/configuration-variation-price';
import { productRecommendationVariationUnitPrice } from '@/lib/menu/recommendation-addon-price';
import {
  optionSelectionKey,
  recommendedProductNeedsSheet,
  resolveProductRecommendationVariationId,
} from '@/lib/menu/recommendation-option-utils';
import {
  orderedUniqueOptionIds,
  type ModifierGroupSelection,
} from '@/lib/menu/build-modifier-selections';
import {
  parseSelectionTimelineKey,
  selectionTimelineKeys,
} from '@/lib/menu/selection-timeline';
import type { AttributeGroup } from '@/components/order/product-customize-dialog';
import type { NestedRecommendationResult } from '@/components/order/nested-recommendation-sheet';
import {
  isConfigurationGroupVisibleForParentVariation,
  parentVariationFromItemVariation,
} from '@/lib/menu/configuration-variation-price';

export type { ModifierGroupSelection };

function resolveNestedOptionConfigMods(
  key: string,
  config: NestedRecommendationResult,
  allGroupsFlat: AttributeGroup[] | undefined,
  selectedNestedVariationByOption: Record<string, string>,
  parentVariation: ParentVariationContext | null,
  parentVariationShortLabel: string | null
): ModifierGroupSelection[] {
  if (config.mods.length > 0) return config.mods;
  if (!allGroupsFlat?.length) return [];

  const [groupId, optionId] = key.split(':');
  const parentGroup = allGroupsFlat.find((g) => g.id === groupId);
  const parentItem = parentGroup?.items.find((it) => it.menuItemId === optionId);
  const nestedGroups = (parentItem?.nestedAttributeGroups ?? []).filter((g) =>
    isConfigurationGroupVisibleForParentVariation(g, parentVariation)
  );
  if (nestedGroups.length === 0) return [];

  const optionParent =
    parentVariationFromItemVariation(
      parentItem?.variations,
      config.productVariationId || selectedNestedVariationByOption[key]
    ) ?? parentVariation;

  return buildConfirmModifierSelections({
    visibleCategoryGroups: nestedGroups,
    selectedByGroup: config.selectedByGroup,
    selectedNestedVariationByOption: config.selectedNestedVariationByOption,
    nestedOptionConfigs: {},
    visibleProductRecommendationGroups: [],
    nestedConfigs: {},
    preselectedRecommendationVariationByGroup: {},
    personalizeGroups: [],
    selectedPersonalizeByGroup: {},
    parentVariation: optionParent,
    parentVariationShortLabel,
    selectionTimeline: [],
    productRecChildGroupNamePrefix: false,
    allGroupsFlat,
  });
}

function buildProductRecModifiersForGroup(
  g: AttributeGroup,
  nestedConfigs: Record<string, NestedRecommendationResult>,
  preselectedRecommendationVariationByGroup: Record<string, string>,
  parentVariation: ParentVariationContext | null,
  childGroupNamePrefix?: string
): ModifierGroupSelection[] {
  const item = g.items[0];
  if (!item) return [];

  const config = nestedConfigs[g.id];
  const pvId = resolveProductRecommendationVariationId(item, g, {
    configProductVariationId: config?.productVariationId,
    preselectedVariationId: preselectedRecommendationVariationByGroup[g.id],
    parentVariation,
  });
  const pv = pvId
    ? (item.variations ?? []).find((v) => v.id === pvId)
    : undefined;
  const pvName = pv?.name ?? pv?.title;
  const selectionName = pvName ? `${item.name} (${pvName})` : item.name;

  const mods: ModifierGroupSelection[] = [
    {
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
    },
  ];

  for (const child of config?.mods ?? []) {
    mods.push({
      attributeGroupId: child.attributeGroupId,
      groupName: childGroupNamePrefix
        ? `${childGroupNamePrefix} — ${child.groupName}`
        : child.groupName,
      selections: child.selections,
    });
  }

  return mods;
}

function buildCategoryOptionModifiers(
  group: AttributeGroup,
  optionId: string,
  selectedByGroup: Record<string, string[]>,
  selectedNestedVariationByOption: Record<string, string>,
  parentVariation: ParentVariationContext | null,
  parentVariationShortLabel: string | null
): ModifierGroupSelection[] {
  const allIds = selectedByGroup[group.id] ?? [];
  const optionIds = allIds.filter((id) => id === optionId);
  if (optionIds.length === 0) return [];

  return buildModifierSelectionsForGroups(
    [group],
    { [group.id]: optionIds },
    selectedNestedVariationByOption,
    parentVariation,
    parentVariationShortLabel
  );
}

function appendFallbackCategoryOptions(
  mods: ModifierGroupSelection[],
  processedKeys: Set<string>,
  visibleCategoryGroups: AttributeGroup[],
  selectedByGroup: Record<string, string[]>,
  selectedNestedVariationByOption: Record<string, string>,
  nestedOptionConfigs: Record<string, NestedRecommendationResult>,
  parentVariation: ParentVariationContext | null,
  parentVariationShortLabel: string | null,
  allGroupsFlat?: AttributeGroup[]
) {
  for (const group of visibleCategoryGroups) {
    const ids = selectedByGroup[group.id] ?? [];
    for (const optionId of orderedUniqueOptionIds(ids, group.selectionType)) {
      const key = selectionTimelineKeys.categoryOption(group.id, optionId);
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);
      mods.push(
        ...buildCategoryOptionModifiers(
          group,
          optionId,
          selectedByGroup,
          selectedNestedVariationByOption,
          parentVariation,
          parentVariationShortLabel
        )
      );
      const nestedKey = optionSelectionKey(group.id, optionId);
      const nestedConfig = nestedOptionConfigs[nestedKey];
      if (nestedConfig) {
        mods.push(
          ...resolveNestedOptionConfigMods(
            nestedKey,
            nestedConfig,
            allGroupsFlat,
            selectedNestedVariationByOption,
            parentVariation,
            parentVariationShortLabel
          )
        );
      }
    }
  }
}

function appendFallbackProductRecs(
  mods: ModifierGroupSelection[],
  processedKeys: Set<string>,
  visibleProductRecommendationGroups: AttributeGroup[],
  nestedConfigs: Record<string, NestedRecommendationResult>,
  preselectedRecommendationVariationByGroup: Record<string, string>,
  parentVariation: ParentVariationContext | null,
  productRecChildGroupNamePrefix?: boolean
) {
  for (const g of visibleProductRecommendationGroups) {
    const key = selectionTimelineKeys.productRec(g.id);
    if (processedKeys.has(key)) continue;

    const item = g.items[0];
    if (!item) continue;
    const config = nestedConfigs[g.id];
    if (recommendedProductNeedsSheet(g) && !config) continue;

    processedKeys.add(key);
    mods.push(
      ...buildProductRecModifiersForGroup(
        g,
        nestedConfigs,
        preselectedRecommendationVariationByGroup,
        parentVariation,
        productRecChildGroupNamePrefix ? g.name : undefined
      )
    );
  }
}

function appendFallbackPersonalize(
  mods: ModifierGroupSelection[],
  processedKeys: Set<string>,
  personalizeGroups: PersonalizeGroupLike[],
  selectedPersonalizeByGroup: Record<string, string[]>
) {
  for (const group of personalizeGroups) {
    const ids = selectedPersonalizeByGroup[group.id] ?? [];
    for (const optionId of ids) {
      const key = selectionTimelineKeys.personalize(group.id, optionId);
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);
      mods.push(
        ...buildPersonalizeModifierSelections([group], {
          [group.id]: [optionId],
        })
      );
    }
  }
}

export function buildConfirmModifierSelections(params: {
  visibleCategoryGroups: AttributeGroup[];
  selectedByGroup: Record<string, string[]>;
  selectedNestedVariationByOption: Record<string, string>;
  nestedOptionConfigs: Record<string, NestedRecommendationResult>;
  visibleProductRecommendationGroups: AttributeGroup[];
  nestedConfigs: Record<string, NestedRecommendationResult>;
  preselectedRecommendationVariationByGroup: Record<string, string>;
  personalizeGroups: PersonalizeGroupLike[];
  selectedPersonalizeByGroup: Record<string, string[]>;
  parentVariation: ParentVariationContext | null;
  parentVariationShortLabel: string | null;
  selectionTimeline: string[];
  /** Prefix nested product-rec child groups with the parent product name. */
  productRecChildGroupNamePrefix?: boolean;
  allGroupsFlat?: AttributeGroup[];
}): ModifierGroupSelection[] {
  const {
    visibleCategoryGroups,
    selectedByGroup,
    selectedNestedVariationByOption,
    nestedOptionConfigs,
    visibleProductRecommendationGroups,
    nestedConfigs,
    preselectedRecommendationVariationByGroup,
    personalizeGroups,
    selectedPersonalizeByGroup,
    parentVariation,
    parentVariationShortLabel,
    selectionTimeline,
    productRecChildGroupNamePrefix = true,
    allGroupsFlat,
  } = params;

  const mods: ModifierGroupSelection[] = [];
  const processedKeys = new Set<string>();

  for (const timelineKey of selectionTimeline) {
    const parsed = parseSelectionTimelineKey(timelineKey);
    if (!parsed) continue;

    if (parsed.kind === 'category') {
      if (processedKeys.has(timelineKey)) continue;
      const group = visibleCategoryGroups.find((g) => g.id === parsed.groupId);
      if (!group) continue;
      processedKeys.add(timelineKey);
      mods.push(
        ...buildCategoryOptionModifiers(
          group,
          parsed.optionId,
          selectedByGroup,
          selectedNestedVariationByOption,
          parentVariation,
          parentVariationShortLabel
        )
      );
      const nestedKey = optionSelectionKey(parsed.groupId, parsed.optionId);
      const nestedConfig = nestedOptionConfigs[nestedKey];
      if (nestedConfig) {
        mods.push(
          ...resolveNestedOptionConfigMods(
            nestedKey,
            nestedConfig,
            allGroupsFlat,
            selectedNestedVariationByOption,
            parentVariation,
            parentVariationShortLabel
          )
        );
      }
      continue;
    }

    if (parsed.kind === 'productRec') {
      if (processedKeys.has(timelineKey)) continue;
      const group = visibleProductRecommendationGroups.find(
        (g) => g.id === parsed.groupId
      );
      if (!group) continue;
      processedKeys.add(timelineKey);
      mods.push(
        ...buildProductRecModifiersForGroup(
          group,
          nestedConfigs,
          preselectedRecommendationVariationByGroup,
          parentVariation,
          productRecChildGroupNamePrefix ? group.name : undefined
        )
      );
      continue;
    }

    if (parsed.kind === 'personalize') {
      if (processedKeys.has(timelineKey)) continue;
      const group = personalizeGroups.find((g) => g.id === parsed.groupId);
      if (!group) continue;
      const ids = selectedPersonalizeByGroup[group.id] ?? [];
      if (!ids.includes(parsed.optionId)) continue;
      processedKeys.add(timelineKey);
      mods.push(
        ...buildPersonalizeModifierSelections([group], {
          [group.id]: [parsed.optionId],
        })
      );
    }
  }

  appendFallbackCategoryOptions(
    mods,
    processedKeys,
    visibleCategoryGroups,
    selectedByGroup,
    selectedNestedVariationByOption,
    nestedOptionConfigs,
    parentVariation,
    parentVariationShortLabel,
    allGroupsFlat
  );
  appendFallbackProductRecs(
    mods,
    processedKeys,
    visibleProductRecommendationGroups,
    nestedConfigs,
    preselectedRecommendationVariationByGroup,
    parentVariation,
    productRecChildGroupNamePrefix
  );
  appendFallbackPersonalize(
    mods,
    processedKeys,
    personalizeGroups,
    selectedPersonalizeByGroup
  );

  return mods;
}
