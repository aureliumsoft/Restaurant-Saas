export type PersonalizeGroupLike = {
  id: string;
  parentName: string;
  maxItems: number;
  options: Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
  }>;
};

export function buildPersonalizeModifierSelections(
  groups: PersonalizeGroupLike[],
  selectedByGroup: Record<string, string[]>
): {
  attributeGroupId: string;
  groupName: string;
  selections: {
    menuItemId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    unitPrice: number;
  }[];
}[] {
  const mods: {
    attributeGroupId: string;
    groupName: string;
    selections: {
      menuItemId: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      unitPrice: number;
    }[];
  }[] = [];

  for (const group of groups) {
    const ids = selectedByGroup[group.id] ?? [];
    if (ids.length === 0) continue;
    const selections = ids
      .map((id) => group.options.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .map((o) => ({
        menuItemId: `personalize:${o.id}`,
        name: o.name,
        description: null,
        imageUrl: o.imageUrl ?? null,
        unitPrice: 0,
      }));
    if (selections.length === 0) continue;
    mods.push({
      attributeGroupId: group.id,
      groupName: group.parentName,
      selections,
    });
  }

  return mods;
}

export function isPersonalizeModifierMenuItemId(menuItemId: string): boolean {
  return menuItemId.startsWith('personalize:');
}

export function normalizePersonalizeModifierMenuItemId(
  menuItemId: string
): string | null {
  return isPersonalizeModifierMenuItemId(menuItemId) ? null : menuItemId;
}
