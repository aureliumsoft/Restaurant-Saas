-- Monthly/yearly list prices + optional % discounts on SubscriptionCatalog
ALTER TABLE "SubscriptionCatalog"
  ADD COLUMN IF NOT EXISTS "monthlyDiscountEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "monthlyDiscountPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "yearlyPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "yearlyDiscountEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "yearlyDiscountPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paypalYearlyPlanId" TEXT;

-- Backfill yearly list as 12× monthly for paid plans that still have 0
UPDATE "SubscriptionCatalog"
SET "yearlyPrice" = "price" * 12
WHERE "yearlyPrice" = 0 AND "price" > 0;
