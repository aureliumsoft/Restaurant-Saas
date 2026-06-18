-- Sync schema for onboarding on databases created before newer columns/roles.

ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "slug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Role_restaurantId_slug_key"
  ON "Role"("restaurantId", "slug");

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "themePrimaryColor" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "menuBannerUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "logoKey" TEXT;

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "posServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "posServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "kioskServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "kioskServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onlineServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onlineServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE "CustomerPaymentProvider" AS ENUM ('NONE', 'PAYPAL', 'STRIPE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "customerPaymentProvider" "CustomerPaymentProvider" NOT NULL DEFAULT 'NONE';
