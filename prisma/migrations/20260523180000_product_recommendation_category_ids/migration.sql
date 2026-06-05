-- AlterTable
ALTER TABLE "MenuItemAttributeGroup" ADD COLUMN "productCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
