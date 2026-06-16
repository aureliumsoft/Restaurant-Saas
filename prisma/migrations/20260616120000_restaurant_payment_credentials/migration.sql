-- CreateEnum
CREATE TYPE "CustomerPaymentProvider" AS ENUM ('NONE', 'PAYPAL', 'STRIPE');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "customerPaymentProvider" "CustomerPaymentProvider" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "RestaurantPayPalCredentials" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "webhookId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantPayPalCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantStripeCredentials" (
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

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantPayPalCredentials_restaurantId_key" ON "RestaurantPayPalCredentials"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantStripeCredentials_restaurantId_key" ON "RestaurantStripeCredentials"("restaurantId");

-- AddForeignKey
ALTER TABLE "RestaurantPayPalCredentials" ADD CONSTRAINT "RestaurantPayPalCredentials_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantStripeCredentials" ADD CONSTRAINT "RestaurantStripeCredentials_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
