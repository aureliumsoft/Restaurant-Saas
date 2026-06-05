-- CreateEnum
CREATE TYPE "RecommendationSourceType" AS ENUM ('CATEGORY', 'PRODUCT');

-- CreateEnum
CREATE TYPE "RecommendationMultipleMode" AS ENUM ('CHECKBOX', 'QUANTITY');

-- AlterTable
ALTER TABLE "MenuItemAttributeGroup" ADD COLUMN     "sourceType" "RecommendationSourceType" NOT NULL DEFAULT 'CATEGORY',
ADD COLUMN     "multipleMode" "RecommendationMultipleMode",
ADD COLUMN     "freeQuantity" INTEGER,
ALTER COLUMN "linkedCategoryId" DROP NOT NULL,
ADD COLUMN     "linkedProductId" TEXT;

-- CreateTable
CREATE TABLE "MenuItemAttributeGroupVariationLimit" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "minItems" INTEGER NOT NULL,
    "maxItems" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemAttributeGroupVariationLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemAttributeGroup_linkedProductId_idx" ON "MenuItemAttributeGroup"("linkedProductId");

-- CreateIndex
CREATE INDEX "MenuItemAttributeGroupVariationLimit_groupId_idx" ON "MenuItemAttributeGroupVariationLimit"("groupId");

-- CreateIndex
CREATE INDEX "MenuItemAttributeGroupVariationLimit_variationId_idx" ON "MenuItemAttributeGroupVariationLimit"("variationId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemAttributeGroupVariationLimit_groupId_variationId_key" ON "MenuItemAttributeGroupVariationLimit"("groupId", "variationId");

-- AddForeignKey
ALTER TABLE "MenuItemAttributeGroup" ADD CONSTRAINT "MenuItemAttributeGroup_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemAttributeGroupVariationLimit" ADD CONSTRAINT "MenuItemAttributeGroupVariationLimit_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MenuItemAttributeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemAttributeGroupVariationLimit" ADD CONSTRAINT "MenuItemAttributeGroupVariationLimit_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "MenuItemVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
