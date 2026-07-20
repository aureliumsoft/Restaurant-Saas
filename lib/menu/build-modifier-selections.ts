import {
  chargeableConfigurationItemUnitPrice,
  configurationDefaultListUnitPriceForSelection,
  configurationGroupDisplayTitle,
  configurationItemListUnitPriceForGroup,
  configurationItemResolvedListUnit,
  filterConfigurationItemsForGroup,
  type ParentVariationContext,
} from '@/lib/menu/configuration-variation-price';
import { chargeableUnitsByOptionInGroup } from '@/lib/menu/recommendation-limits';
import { effectiveOptionVariationId } from '@/lib/menu/recommendation-option-utils';
import type {
  AttributeGroup,
  MenuOption,
} from '@/components/order/product-customize-dialog';

export type ModifierGroupSelection = {
  attributeGroupId: string;
  groupName: string;
  selections: MenuOption[];
};

export function orderedUniqueOptionIds(
  ids: string[],
  selectionType: 'SINGLE' | 'MULTIPLE'
): string[] {
  if (selectionType === 'SINGLE') {
    return ids.length > 0 ? [ids[0]!] : [];
  }
  const result: string[] = [];
  for (const id of ids) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

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

    const visibleItems = filterConfigurationItemsForGroup(g.items, {
      parentVariation,
      useVariationPricing: g.useVariationPricing ?? false,
      defaultLinkedRestaurantVariationId: g.defaultLinkedRestaurantVariationId,
    });
    const itemById = new Map(
      visibleItems.map((it) => [it.menuItemId, it] as const)
    );
    const chargeableByOption =
      g.selectionType === 'MULTIPLE' && g.multipleMode === 'QUANTITY'
        ? chargeableUnitsByOptionInGroup(ids, g.freeQuantity)
        : null;
    const selectedItems = orderedUniqueOptionIds(ids, g.selectionType)
      .map((optionId) => {
        const it = itemById.get(optionId);
        if (!it) return null;
        const qty =
          g.selectionType === 'MULTIPLE'
            ? ids.filter((x) => x === optionId).length
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
        const listUnit =
          g.defaultLinkedRestaurantVariationId &&
          !(g.useVariationPricing ?? false)
            ? configurationItemListUnitPriceForGroup(it, {
                defaultLinkedRestaurantVariationId:
                  g.defaultLinkedRestaurantVariationId,
              })
            : configurationItemResolvedListUnit(
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
        const chargeable = chargeableByOption
          ? (chargeableByOption.get(optionId) ?? 0)
          : qty;
        return {
          menuItemId: it.menuItemId,
          name: qty > 1 ? `${finalName} x${qty}` : finalName,
          description: it.description,
          imageUrl: it.imageUrl,
          unitPrice: unit * chargeable,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);

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
