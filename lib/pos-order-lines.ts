import type { Prisma } from '@prisma/client';

import type { CartModifierSelectionNormalized } from '@/lib/cart-normalize';
import { normalizeCartModifiers } from '@/lib/cart-normalize';

export type PosOrderLineModifier = CartModifierSelectionNormalized;

export type PosOrderLineInput = {
  productId: string;
  name?: string;
  qty: number;
  unitPrice: number;
  lineDiscPct: number;
  variationId?: string | null;
  modifiers?: PosOrderLineModifier[];
};

export type NormalizedPosOrderLine = {
  menuItemId: string;
  productName: string;
  quantity: number;
  price: number;
  variationId: string | null;
  modifiers: PosOrderLineModifier[];
};

export function paymentModeToMethodLabel(paymentMode: string): string {
  if (paymentMode === 'card') return 'Card';
  if (paymentMode === 'card_terminal') return 'Card Terminal';
  if (paymentMode === 'split') return 'Split';
  return 'Cash';
}

export function paymentMethodToMode(method: string | null | undefined): string {
  const normalized = String(method ?? '').toLowerCase();
  if (normalized.includes('terminal')) return 'card_terminal';
  if (normalized.includes('card')) return 'card';
  if (normalized.includes('split')) return 'split';
  return 'cash';
}

export async function normalizePosOrderLines(params: {
  restaurantId: string;
  items: PosOrderLineInput[];
  db: {
    menuItem: {
      findMany: (args: {
        where: { restaurantId: string; id: { in: string[] } };
        select: { id: true; name: true };
      }) => Promise<Array<{ id: string; name: string }>>;
    };
  };
}): Promise<NormalizedPosOrderLine[] | null> {
  const { restaurantId, items, db } = params;
  if (items.length === 0) return null;

  const baseProductIds = items.map(
    (line) => String(line.productId).split('::sw:')[0] ?? String(line.productId)
  );
  const menuItems = await db.menuItem.findMany({
    where: {
      restaurantId,
      id: { in: baseProductIds },
    },
    select: { id: true, name: true },
  });
  const menuMap = new Map(menuItems.map((m) => [m.id, m]));

  const normalized = items
    .map((line) => {
      const baseProductId =
        String(line.productId).split('::sw:')[0] ?? String(line.productId);
      const menu = menuMap.get(baseProductId);
      if (!menu) return null;

      const qty = Math.max(1, Math.floor(Number(line.qty) || 0));
      const unit = Number(line.unitPrice);
      const discPct = Math.min(100, Math.max(0, Number(line.lineDiscPct) || 0));
      if (Number.isNaN(unit)) return null;

      const unitAfterDisc = unit * (1 - discPct / 100);
      return {
        menuItemId: menu.id,
        productName:
          typeof line.name === 'string' && line.name.trim() !== ''
            ? line.name.trim()
            : menu.name,
        quantity: qty,
        price: unitAfterDisc,
        variationId:
          typeof line.variationId === 'string' && line.variationId.trim()
            ? line.variationId.trim()
            : null,
        modifiers: normalizeCartModifiers(line.modifiers),
      };
    })
    .filter((line): line is NormalizedPosOrderLine => line !== null);

  return normalized.length > 0 ? normalized : null;
}

export function posOrderItemCreateManyInput(
  orderId: string,
  lines: NormalizedPosOrderLine[]
): Prisma.OrderItemCreateManyInput[] {
  return lines.map((line) => ({
    orderId,
    menuItemId: line.menuItemId,
    productName: line.productName,
    quantity: line.quantity,
    price: line.price,
  }));
}
