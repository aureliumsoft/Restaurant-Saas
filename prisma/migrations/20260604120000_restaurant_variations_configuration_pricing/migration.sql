-- Restaurant-wide variation templates + configuration variation pricing flag

CREATE TABLE "RestaurantVariation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantVariation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantVariation_restaurantId_name_key" ON "RestaurantVariation"("restaurantId", "name");
CREATE INDEX "RestaurantVariation_restaurantId_sortOrder_idx" ON "RestaurantVariation"("restaurantId", "sortOrder");

ALTER TABLE "RestaurantVariation" ADD CONSTRAINT "RestaurantVariation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItemVariation" ADD COLUMN "restaurantVariationId" TEXT;

CREATE INDEX "MenuItemVariation_restaurantVariationId_idx" ON "MenuItemVariation"("restaurantVariationId");

ALTER TABLE "MenuItemVariation" ADD CONSTRAINT "MenuItemVariation_restaurantVariationId_fkey" FOREIGN KEY ("restaurantVariationId") REFERENCES "RestaurantVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MenuItemAttributeGroup" ADD COLUMN "useVariationPricing" BOOLEAN NOT NULL DEFAULT false;
