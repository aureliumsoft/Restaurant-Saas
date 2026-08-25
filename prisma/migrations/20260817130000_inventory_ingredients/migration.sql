-- CreateEnum
CREATE TYPE "IngredientUnit" AS ENUM ('PCS', 'G', 'KG', 'ML', 'L');

-- CreateEnum
CREATE TYPE "IngredientStockEntrySource" AS ENUM ('MANUAL', 'ORDER');

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" "IngredientUnit" NOT NULL DEFAULT 'PCS',
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "sku" TEXT,
    "minQuantity" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemIngredient" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "menuItemVariationId" TEXT,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientStockEntry" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "menuItemVariationId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "IngredientStockEntrySource" NOT NULL DEFAULT 'MANUAL',
    "orderId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientStockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_restaurantId_name_key" ON "Ingredient"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "Ingredient_restaurantId_isMajor_idx" ON "Ingredient"("restaurantId", "isMajor");

-- CreateIndex
CREATE INDEX "Ingredient_restaurantId_isActive_idx" ON "Ingredient"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "MenuItemIngredient_menuItemId_idx" ON "MenuItemIngredient"("menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemIngredient_ingredientId_idx" ON "MenuItemIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "MenuItemIngredient_menuItemVariationId_idx" ON "MenuItemIngredient"("menuItemVariationId");

-- Unique recipe per product when no variation
CREATE UNIQUE INDEX "MenuItemIngredient_item_ingredient_simple_key"
  ON "MenuItemIngredient"("menuItemId", "ingredientId")
  WHERE "menuItemVariationId" IS NULL;

-- Unique recipe per product variation
CREATE UNIQUE INDEX "MenuItemIngredient_item_variation_ingredient_key"
  ON "MenuItemIngredient"("menuItemId", "menuItemVariationId", "ingredientId")
  WHERE "menuItemVariationId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "IngredientStockEntry_restaurantId_createdAt_idx" ON "IngredientStockEntry"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "IngredientStockEntry_ingredientId_createdAt_idx" ON "IngredientStockEntry"("ingredientId", "createdAt");

-- CreateIndex
CREATE INDEX "IngredientStockEntry_orderId_idx" ON "IngredientStockEntry"("orderId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItemIngredient" ADD CONSTRAINT "MenuItemIngredient_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItemIngredient" ADD CONSTRAINT "MenuItemIngredient_menuItemVariationId_fkey" FOREIGN KEY ("menuItemVariationId") REFERENCES "MenuItemVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItemIngredient" ADD CONSTRAINT "MenuItemIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngredientStockEntry" ADD CONSTRAINT "IngredientStockEntry_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngredientStockEntry" ADD CONSTRAINT "IngredientStockEntry_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngredientStockEntry" ADD CONSTRAINT "IngredientStockEntry_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IngredientStockEntry" ADD CONSTRAINT "IngredientStockEntry_menuItemVariationId_fkey" FOREIGN KEY ("menuItemVariationId") REFERENCES "MenuItemVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IngredientStockEntry" ADD CONSTRAINT "IngredientStockEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IngredientStockEntry" ADD CONSTRAINT "IngredientStockEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
