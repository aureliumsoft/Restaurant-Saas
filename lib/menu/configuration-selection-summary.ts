import { buildModifierSelectionsForGroups, orderedUniqueOptionIds } from '@/lib/menu/build-modifier-selections';
import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import { productRecommendationVariationPriceLabel } from '@/lib/menu/recommendation-addon-price';
import {
  optionSelectionKey,
  resolveProductRecommendationVariationId,
} from '@/lib/menu/recommendation-option-utils';
import type { ParentVariationContext } from '@/lib/menu/configuration-variation-price';

import type {
  AttributeGroup,
  MenuOption,
} from '@/components/order/product-customize-dialog';
import type { NestedRecommendationResult } from '@/components/order/nested-recommendation-sheet';

export type ConfigurationSummaryLine = {
  name: string;
  priceLabel: string | null;
  /** Personalize picks — shown below the line name, not as indented sub-items. */
  personalize: ConfigurationSummaryLine[];
  nested: ConfigurationSummaryLine[];
};

export function formatSelectionPriceLabel(unitPrice: number): string | null {
  if (unitPrice <= 0) return null;
  return `(+€${unitPrice.toFixed(2)})`;
}

function selectionToSummaryLine(sel: MenuOption): ConfigurationSummaryLine {
  return {
    name: sel.name,
    priceLabel: formatSelectionPriceLabel(sel.unitPrice),
    personalize: [],
    nested: [],
  };
}

function splitModsToSummaryLines(mods: { selections: MenuOption[] }[]): {
  personalize: ConfigurationSummaryLine[];
  nested: ConfigurationSummaryLine[];
} {
  const personalize: ConfigurationSummaryLine[] = [];
  const nested: ConfigurationSummaryLine[] = [];
  for (const mod of mods) {
    for (const sel of mod.selections) {
      const line = selectionToSummaryLine(sel);
      if (isPersonalizeModifierMenuItemId(sel.menuItemId)) {
        personalize.push(line);
      } else {
        nested.push(line);
      }
    }
  }
  return { personalize, nested };
}

export function buildCategoryGroupSelectionSummary(
  group: AttributeGroup,
  selectedIds: string[],
  selectedNestedVariationByOption: Record<string, string>,
  nestedOptionConfigs: Record<string, NestedRecommendationResult>,
  parentVariation: ParentVariationContext | null,
  parentVariationShortLabel: string | null
): ConfigurationSummaryLine[] {
  if (selectedIds.length === 0) return [];

  const lines: ConfigurationSummaryLine[] = [];
  for (const optionId of orderedUniqueOptionIds(selectedIds, group.selectionType)) {
    const mainMods = buildModifierSelectionsForGroups(
      [group],
      { [group.id]: selectedIds.filter((id) => id === optionId) },
      selectedNestedVariationByOption,
      parentVariation,
      parentVariationShortLabel
    );

    for (const mod of mainMods) {
      for (const sel of mod.selections) {
        const key = optionSelectionKey(group.id, sel.menuItemId);
        const nestedConfigMods = nestedOptionConfigs[key]?.mods ?? [];
        const { personalize, nested } = splitModsToSummaryLines(nestedConfigMods);
        lines.push({
          name: sel.name,
          priceLabel: formatSelectionPriceLabel(sel.unitPrice),
          personalize,
          nested,
        });
      }
    }
  }
  return lines;
}

export function buildProductRecSelectionSummary(
  group: AttributeGroup,
  config: NestedRecommendationResult | undefined,
  preselectedVariationId: string | undefined,
  parentVariation: ParentVariationContext | null
): ConfigurationSummaryLine[] {
  const item = group.items[0];
  if (!item) return [];

  const pvId =
    resolveProductRecommendationVariationId(item, group, {
      configProductVariationId: config?.productVariationId,
      preselectedVariationId,
      parentVariation,
    }) ?? undefined;
  if (!pvId && !config) return [];

  const pv = (item.variations ?? []).find((v) => v.id === pvId);
  const pvName = pv?.name ?? pv?.title;
  const name = pvName ? `${item.name} (${pvName})` : item.name;
  const priceLabel =
    pv != null
      ? productRecommendationVariationPriceLabel(item, pv.priceDelta)
      : null;

  const { personalize, nested } = splitModsToSummaryLines(config?.mods ?? []);

  return [
    {
      name,
      priceLabel,
      personalize,
      nested,
    },
  ];
}
