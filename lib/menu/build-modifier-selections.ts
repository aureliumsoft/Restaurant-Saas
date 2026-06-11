import {
  chargeableConfigurationItemUnitPrice,
  configurationDefaultListUnitPriceForSelection,
  configurationGroupDisplayTitle,
  configurationItemResolvedListUnit,
  filterConfigurationItemsForParentVariation,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import { chargeableUnitsForOption } from '@/lib/menu/recommendation-limits';
import { effectiveOptionVariationId } from '@/lib/menu/recommendation-option-utils';
import type {
  AttributeGroup,
  MenuOption,
} from '@/components/order/product-customize-dialog';

export function buildModifierSelectionsForGroups(
  groups: AttributeGroup[],
  selectedByGroup: Record<string, string[]>,
  selectedNestedVariationByOption: Record<string, string>,
  parentVariation?: ParentVariationContext | null,
  parentVariationShortLabel?: string | null
): {
  attributeGroupId: string;
  groupName: string;
  selections: MenuOption[];
}[] {
  const mods: {
    attributeGroupId: string;
    groupName: string;
    selections: MenuOption[];
  }[] = [];

  for (const g of groups) {
    const ids = selectedByGroup[g.id] ?? [];
    if (ids.length === 0) continue;

    const visibleItems = filterConfigurationItemsForParentVariation(
      g.items,
      parentVariation,
      g.useVariationPricing ?? false
    );
    const selectedItems = visibleItems
      .filter((it) => ids.includes(it.menuItemId))
      .map((it) => {
        const qty =
          g.selectionType === 'MULTIPLE'
            ? ids.filter((x) => x === it.menuItemId).length
            : 1;
        const key = `${g.id}:${it.menuItemId}`;
        const nestedVariationId = effectiveOptionVariationId(
          it,
          key,
          selectedNestedVariationByOption,
          {},
          { group: g, parentVariation }
        );
        const nestedVariation = nestedVariationId
          ? (it.variations ?? []).find((v) => v.id === nestedVariationId)
          : undefined;
        const nestedVariationName =
          nestedVariation?.name ?? nestedVariation?.title;
        const finalName = nestedVariationName
          ? `${it.name} (${nestedVariationName})`
          : it.name;
        const listUnit = configurationItemResolvedListUnit(
          it,
          parentVariation,
          g.useVariationPricing ?? false,
          nestedVariationId
        );
        const defaultListUnit = configurationDefaultListUnitPriceForSelection(
          g,
          parentVariation,
          visibleItems,
          nestedVariation ?? null
        );
        const unit = chargeableConfigurationItemUnitPrice(
          listUnit,
          defaultListUnit ?? null
        );
        const chargeable =
          g.selectionType === 'MULTIPLE' && g.multipleMode === 'QUANTITY'
            ? chargeableUnitsForOption(qty, g.freeQuantity)
            : qty;
        return {
          menuItemId: it.menuItemId,
          name: qty > 1 ? `${finalName} x${qty}` : finalName,
          description: it.description,
          imageUrl: it.imageUrl,
          unitPrice: unit * chargeable,
        };
      });

    if (selectedItems.length > 0) {
      mods.push({
        attributeGroupId: g.id,
        groupName: configurationGroupDisplayTitle(
          g.name,
          parentVariation,
          g.useVariationPricing ?? false,
          parentVariationShortLabel
        ),
        selections: selectedItems,
      });
    }
  }

  return mods;
}

export function modifierSelectionsUnitTotal(
  mods: { selections: MenuOption[] }[]
): number {
  return mods.reduce(
    (sum, m) =>
      sum + m.selections.reduce((inner, s) => inner + s.unitPrice, 0),
    0
  );
}
