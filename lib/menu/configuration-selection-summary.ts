import { buildModifierSelectionsForGroups } from '@/lib/menu/build-modifier-selections';
import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import { formatAddonDelta } from '@/lib/format-money';
import type { RestaurantRegionalSettings } from '@/lib/restaurant-regional';
import {
  productRecommendationVariationPriceLabel,
  productRecommendationVariationUnitPrice,
} from '@/lib/menu/recommendation-addon-price';
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
  unitPrice: number;
  /** Personalize picks — shown below the line name, not as indented sub-items. */
  personalize: ConfigurationSummaryLine[];
  nested: ConfigurationSummaryLine[];
};

export function formatSelectionPriceLabel(
  unitPrice: number,
  regional?: Partial<RestaurantRegionalSettings>
): string | null {
  return formatAddonDelta(unitPrice, regional);
}

function selectionToSummaryLine(
  sel: MenuOption,
  regional?: Partial<RestaurantRegionalSettings>
): ConfigurationSummaryLine {
  return {
    name: sel.name,
    priceLabel: formatSelectionPriceLabel(sel.unitPrice, regional),
    unitPrice: sel.unitPrice,
    personalize: [],
    nested: [],
  };
}

function isSizeLikeChild(parentName: string, childName: string) {
  const parent = parentName.trim().toLowerCase();
  const child = childName.trim().toLowerCase();
  if (!parent || !child || parent === child) return false;
  return (
    child.startsWith(`${parent} `) ||
    child.startsWith(`${parent}(`) ||
    child.startsWith(`${parent} (`) ||
    (child.startsWith(parent) && /\bxl\b/.test(child))
  );
}

/** Fold XL/size extras onto the wrap name so the form matches Belorder. */
export function foldConfigurationSummaryLine(
  line: ConfigurationSummaryLine,
  regional?: Partial<RestaurantRegionalSettings>
): ConfigurationSummaryLine {
  let name = line.name;
  let unitPrice = line.unitPrice ?? 0;
  const nested: ConfigurationSummaryLine[] = [];
  for (const child of line.nested) {
    if (isSizeLikeChild(name, child.name)) {
      name = child.name.trim();
      unitPrice += child.unitPrice ?? 0;
      continue;
    }
    nested.push(child);
  }
  return {
    ...line,
    name,
    unitPrice,
    priceLabel: formatSelectionPriceLabel(unitPrice, regional),
    nested,
  };
}

function splitModsToSummaryLines(
  mods: { selections: MenuOption[] }[],
  regional?: Partial<RestaurantRegionalSettings>
): {
  personalize: ConfigurationSummaryLine[];
  nested: ConfigurationSummaryLine[];
} {
  const personalize: ConfigurationSummaryLine[] = [];
  const nested: ConfigurationSummaryLine[] = [];
  for (const mod of mods) {
    for (const sel of mod.selections) {
      const line = selectionToSummaryLine(sel, regional);
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
  parentVariationShortLabel: string | null,
  regional?: Partial<RestaurantRegionalSettings>
): ConfigurationSummaryLine[] {
  if (selectedIds.length === 0) return [];

  const mainMods = buildModifierSelectionsForGroups(
    [group],
    { [group.id]: selectedIds },
    selectedNestedVariationByOption,
    parentVariation,
    parentVariationShortLabel
  );

  const lines: ConfigurationSummaryLine[] = [];
  for (const mod of mainMods) {
    for (const sel of mod.selections) {
      const key = optionSelectionKey(group.id, sel.menuItemId);
      const nestedConfigMods = nestedOptionConfigs[key]?.mods ?? [];
      const { personalize, nested } = splitModsToSummaryLines(
        nestedConfigMods,
        regional
      );
      lines.push(
        foldConfigurationSummaryLine(
          {
            name: sel.name,
            priceLabel: formatSelectionPriceLabel(sel.unitPrice, regional),
            unitPrice: sel.unitPrice,
            personalize,
            nested,
          },
          regional
        )
      );
    }
  }
  return lines;
}

export function buildProductRecSelectionSummary(
  group: AttributeGroup,
  config: NestedRecommendationResult | undefined,
  preselectedVariationId: string | undefined,
  parentVariation: ParentVariationContext | null,
  regional?: Partial<RestaurantRegionalSettings>
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
  const unitPrice = pvId
    ? productRecommendationVariationUnitPrice(item, pvId)
    : 0;
  const priceLabel =
    pv != null
      ? productRecommendationVariationPriceLabel(item, pv.priceDelta, regional)
      : formatSelectionPriceLabel(unitPrice, regional);

  const { personalize, nested } = splitModsToSummaryLines(
    config?.mods ?? [],
    regional
  );

  return [
    foldConfigurationSummaryLine(
      {
        name,
        priceLabel,
        unitPrice,
        personalize,
        nested,
      },
      regional
    ),
  ];
}
