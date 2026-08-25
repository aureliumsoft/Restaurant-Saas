-- Allow deleting menu products that already appear on past orders.
-- Keep a name snapshot so order history / KDS still show the product.

ALTER TABLE "OrderItem" ADD COLUMN "productName" TEXT;
ALTER TABLE "OrderItem" ALTER COLUMN "menuItemId" DROP NOT NULL;

UPDATE "OrderItem" AS oi
SET "productName" = mi."name"
FROM "MenuItem" AS mi
WHERE oi."menuItemId" = mi."id"
  AND (oi."productName" IS NULL OR oi."productName" = '');

ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_menuItemId_fkey";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
