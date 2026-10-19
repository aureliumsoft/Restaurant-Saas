-- Soft over-limit: plan quota locks for branches
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "planQuotaLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Branch_restaurantId_isActive_idx" ON "Branch"("restaurantId", "isActive");
CREATE INDEX IF NOT EXISTS "Branch_restaurantId_planQuotaLocked_idx" ON "Branch"("restaurantId", "planQuotaLocked");
