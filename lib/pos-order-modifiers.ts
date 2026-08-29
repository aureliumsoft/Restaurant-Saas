import type { Prisma } from '@prisma/client';

import { normalizeCartModifiers } from '@/lib/cart-normalize';
import { normalizePersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import type { NormalizedPosOrderLine } from '@/lib/pos-order-lines';

export async function createOrderItemsWithModifiers(
  tx: Pick<Prisma.TransactionClient, 'orderItem' | 'orderItemModifier'>,
  orderId: string,
  lines: NormalizedPosOrderLine[]
): Promise<void> {
  for (const line of lines) {
    const orderItem = await tx.orderItem.create({
      data: {
        orderId,
        menuItemId: line.menuItemId,
        productName: line.productName,
        quantity: line.quantity,
        price: line.price,
      },
    });

    const flatMods = normalizeCartModifiers(line.modifiers).flatMap(
      (group) => group.selections
    );
    if (flatMods.length === 0) continue;

    await tx.orderItemModifier.createMany({
      data: flatMods.map((selection) => ({
        orderItemId: orderItem.id,
        menuItemId: normalizePersonalizeModifierMenuItemId(
          selection.menuItemId
        ),
        name: selection.name,
        unitPrice: selection.unitPrice,
        quantity: 1,
      })),
    });
  }
}
