-- Per-channel flat service charges on Restaurant
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "posServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "posServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "kioskServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "kioskServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onlineServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onlineServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Snapshot on orders
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
