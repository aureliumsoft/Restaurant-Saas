-- Soft over-limit: plan quota locks for restaurant variation templates
ALTER TABLE "RestaurantVariation" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RestaurantVariation" ADD COLUMN IF NOT EXISTS "planQuotaLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "RestaurantVariation_restaurantId_isActive_idx" ON "RestaurantVariation"("restaurantId", "isActive");
CREATE INDEX IF NOT EXISTS "RestaurantVariation_restaurantId_planQuotaLocked_idx" ON "RestaurantVariation"("restaurantId", "planQuotaLocked");
