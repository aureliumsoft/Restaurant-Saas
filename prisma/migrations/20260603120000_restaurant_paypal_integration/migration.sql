-- CreateTable
CREATE TABLE "RestaurantPayPalIntegration" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "paypalMerchantId" TEXT,
    "permissionsGranted" BOOLEAN NOT NULL DEFAULT false,
    "accountStatus" TEXT,
    "paymentsReceivable" BOOLEAN NOT NULL DEFAULT false,
    "primaryEmail" TEXT,
    "countryCode" TEXT,
    "currencyCode" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "lastStatusCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantPayPalIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantPayPalIntegration_restaurantId_key" ON "RestaurantPayPalIntegration"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantPayPalIntegration_trackingId_key" ON "RestaurantPayPalIntegration"("trackingId");

-- AddForeignKey
ALTER TABLE "RestaurantPayPalIntegration" ADD CONSTRAINT "RestaurantPayPalIntegration_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
