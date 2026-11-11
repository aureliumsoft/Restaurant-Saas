-- Preserve cart / recommendation selection order on kitchen tickets.
ALTER TABLE "OrderItemModifier" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KitchenTicketItem" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "OrderItemModifier_orderItemId_idx";
CREATE INDEX IF NOT EXISTS "OrderItemModifier_orderItemId_sortOrder_idx" ON "OrderItemModifier"("orderItemId", "sortOrder");

DROP INDEX IF EXISTS "KitchenTicketItem_kitchenTicketId_idx";
CREATE INDEX IF NOT EXISTS "KitchenTicketItem_kitchenTicketId_sortOrder_idx" ON "KitchenTicketItem"("kitchenTicketId", "sortOrder");
