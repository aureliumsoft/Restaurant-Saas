import { normalizeCartModifiers } from '@/lib/cart-normalize';

/** Flat row ready for OrderItemModifier create (no parentSelectionKey column). */
export type FoldedOrderModifierRow = {
  menuItemId: string;
  name: string;
  groupName: string | null;
  unitPrice: number;
};

/**
 * Flatten cart modifier groups for DB write: nested groups (with
 * parentSelectionKey) merge into the parent selection name as
 * `Parent (child)` and are not inserted as sibling rows.
 */
export function flattenModifiersForOrderWrite(
  modifiers: unknown
): FoldedOrderModifierRow[] {
  const groups = normalizeCartModifiers(modifiers);
  const rows: FoldedOrderModifierRow[] = [];
  const indexBySelectionKey = new Map<string, number>();

  for (const group of groups) {
    const parentKey = group.parentSelectionKey?.trim() || '';
    if (parentKey) {
      const parentIdx = indexBySelectionKey.get(parentKey);
      if (parentIdx != null) {
        const parent = rows[parentIdx]!;
        for (const sel of group.selections) {
          const childName = sel.name.trim();
          if (childName) {
            parent.name = `${parent.name} (${childName})`;
          }
          parent.unitPrice += sel.unitPrice;
        }
        continue;
      }
    }

    for (const sel of group.selections) {
      const idx = rows.length;
      rows.push({
        menuItemId: sel.menuItemId,
        name: sel.name,
        groupName: group.groupName?.trim() || null,
        unitPrice: sel.unitPrice,
      });
      const groupId = group.attributeGroupId.trim();
      const optionId = sel.menuItemId.trim();
      if (groupId && optionId) {
        indexBySelectionKey.set(`${groupId}:${optionId}`, idx);
      }
    }
  }

  return rows;
}
