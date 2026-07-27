-- AlterEnum
ALTER TYPE "CustomerPaymentProvider" ADD VALUE 'WALLETS';

-- CreateTable
CREATE TABLE "RestaurantJazzCashCredentials" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "integritySaltEnc" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantJazzCashCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantEasypaisaCredentials" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "hashKeyEnc" TEXT NOT NULL,
    "username" TEXT,
    "passwordEnc" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantEasypaisaCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantJazzCashCredentials_restaurantId_key" ON "RestaurantJazzCashCredentials"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantEasypaisaCredentials_restaurantId_key" ON "RestaurantEasypaisaCredentials"("restaurantId");

-- AddForeignKey
ALTER TABLE "RestaurantJazzCashCredentials" ADD CONSTRAINT "RestaurantJazzCashCredentials_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantEasypaisaCredentials" ADD CONSTRAINT "RestaurantEasypaisaCredentials_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
