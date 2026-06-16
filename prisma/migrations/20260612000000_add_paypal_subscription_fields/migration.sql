-- AlterTable
ALTER TABLE "RestaurantSubscription" ADD COLUMN "paypalSubscriptionId" TEXT,
ADD COLUMN "paypalPlanId" TEXT;

-- AlterTable
ALTER TABLE "SubscriptionCatalog" ADD COLUMN "paypalProductId" TEXT,
ADD COLUMN "paypalPlanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSubscription_paypalSubscriptionId_key" ON "RestaurantSubscription"("paypalSubscriptionId");
