import type { Prisma } from '@prisma/client';

import { normalizeCartModifiers } from '@/lib/cart-normalize';
import { normalizePersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import type { NormalizedPosOrderLine } from '@/lib/pos-order-lines';

/**
 * Insert every line and its modifiers in one statement.
 * A large ticket used to wait on two round trips per line.
 */
export async function createOrderItemsWithModifiers(
  tx: Prisma.TransactionClient,
  orderId: string,
  lines: Array<
    Omit<NormalizedPosOrderLine, 'menuItemId'> & { menuItemId: string | null }
  >
): Promise<void> {
  if (lines.length === 0) return;

  const linePayload = JSON.stringify(
    lines.map((line, idx) => ({
      idx,
      menuItemId: line.menuItemId,
      productName: line.productName,
      quantity: line.quantity,
      price: line.price,
    }))
  );
  const modifierPayload = JSON.stringify(
    lines.flatMap((line, lineIdx) =>
      normalizeCartModifiers(line.modifiers)
        .flatMap((group) =>
          group.selections.map((selection) => ({
            selection,
            groupName: group.groupName,
          }))
        )
        .map(({ selection, groupName }, sortOrder) => ({
          lineIdx,
          menuItemId: normalizePersonalizeModifierMenuItemId(
            selection.menuItemId
          ),
          name: selection.name,
          groupName: groupName?.trim() || null,
          unitPrice: selection.unitPrice,
          sortOrder,
        }))
    )
  );

  await tx.$queryRaw`
    WITH line_rows AS (
      SELECT
        gen_random_uuid() AS id,
        NULLIF(line->>'menuItemId', '') AS "menuItemId",
        line->>'productName' AS "productName",
        (line->>'quantity')::int AS quantity,
        (line->>'price')::double precision AS price,
        (line->>'idx')::int AS idx
      FROM jsonb_array_elements(${linePayload}::jsonb) AS line
    ),
    inserted_items AS (
      INSERT INTO "OrderItem" (
        id, "orderId", "menuItemId", "productName", quantity, price,
        "createdAt", "updatedAt"
      )
      SELECT
        l.id, ${orderId}, l."menuItemId", l."productName", l.quantity, l.price,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM line_rows l
      RETURNING id
    ),
    inserted_mods AS (
      INSERT INTO "OrderItemModifier" (
        id, "orderItemId", "menuItemId", name, "groupName",
        "unitPrice", quantity, "sortOrder", "createdAt", "updatedAt"
      )
      SELECT
        gen_random_uuid(),
        l.id,
        NULLIF(m->>'menuItemId', ''),
        m->>'name',
        NULLIF(m->>'groupName', ''),
        (m->>'unitPrice')::double precision,
        1,
        (m->>'sortOrder')::int,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM jsonb_array_elements(${modifierPayload}::jsonb) AS m
      JOIN line_rows l ON l.idx = (m->>'lineIdx')::int
      RETURNING id
    )
    SELECT
      (SELECT count(*) FROM inserted_items) AS item_count,
      (SELECT count(*) FROM inserted_mods) AS mod_count
  `;
}
