-- Safe incremental sync for databases created before service-charge columns were added.
-- Uses IF NOT EXISTS so deploy works on both fresh and existing databases.

DO $$ BEGIN
  CREATE TYPE "CustomerPaymentProvider" AS ENUM ('NONE', 'PAYPAL', 'STRIPE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "posServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "posServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "kioskServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "kioskServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onlineServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onlineServiceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "customerPaymentProvider" "CustomerPaymentProvider" NOT NULL DEFAULT 'NONE';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "RestaurantPayPalCredentials" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "webhookId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "countryCode" TEXT NOT NULL DEFAULT 'DE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantPayPalCredentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RestaurantStripeCredentials" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "publishableKey" TEXT NOT NULL,
    "secretKeyEnc" TEXT NOT NULL,
    "webhookSecretEnc" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'test',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantStripeCredentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantPayPalCredentials_restaurantId_key" ON "RestaurantPayPalCredentials"("restaurantId");
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantStripeCredentials_restaurantId_key" ON "RestaurantStripeCredentials"("restaurantId");

DO $$ BEGIN
  ALTER TABLE "RestaurantPayPalCredentials" ADD CONSTRAINT "RestaurantPayPalCredentials_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RestaurantStripeCredentials" ADD CONSTRAINT "RestaurantStripeCredentials_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
