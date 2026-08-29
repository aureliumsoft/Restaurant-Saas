-- Branch-scoped ingredient inventory
CREATE TABLE "BranchIngredientStock" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQuantity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchIngredientStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchIngredientStock_branchId_ingredientId_key" ON "BranchIngredientStock"("branchId", "ingredientId");
CREATE INDEX "BranchIngredientStock_ingredientId_idx" ON "BranchIngredientStock"("ingredientId");
CREATE INDEX "BranchIngredientStock_branchId_idx" ON "BranchIngredientStock"("branchId");

ALTER TABLE "BranchIngredientStock" ADD CONSTRAINT "BranchIngredientStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchIngredientStock" ADD CONSTRAINT "BranchIngredientStock_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngredientStockEntry" ADD COLUMN "branchId" TEXT;
CREATE INDEX "IngredientStockEntry_branchId_createdAt_idx" ON "IngredientStockEntry"("branchId", "createdAt");
ALTER TABLE "IngredientStockEntry" ADD CONSTRAINT "IngredientStockEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed per-branch rows from current restaurant-wide Ingredient.quantity
INSERT INTO "BranchIngredientStock" ("id", "branchId", "ingredientId", "quantity", "minQuantity", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  b."id",
  i."id",
  i."quantity",
  i."minQuantity",
  NOW(),
  NOW()
FROM "Ingredient" i
INNER JOIN "Branch" b ON b."restaurantId" = i."restaurantId";
