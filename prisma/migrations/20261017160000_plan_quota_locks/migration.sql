-- Soft over-limit: plan quota locks for products and categories
ALTER TABLE "MenuCategory" ADD COLUMN IF NOT EXISTS "planQuotaLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "planQuotaLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "MenuCategory_restaurantId_planQuotaLocked_idx" ON "MenuCategory"("restaurantId", "planQuotaLocked");
CREATE INDEX IF NOT EXISTS "MenuItem_restaurantId_isActive_idx" ON "MenuItem"("restaurantId", "isActive");
CREATE INDEX IF NOT EXISTS "MenuItem_restaurantId_planQuotaLocked_idx" ON "MenuItem"("restaurantId", "planQuotaLocked");
