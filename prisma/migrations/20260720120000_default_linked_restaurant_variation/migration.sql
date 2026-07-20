-- AlterTable
ALTER TABLE "MenuItemAttributeGroup" ADD COLUMN "defaultLinkedRestaurantVariationId" TEXT;

-- CreateIndex
CREATE INDEX "MenuItemAttributeGroup_defaultLinkedRestaurantVariationId_idx" ON "MenuItemAttributeGroup"("defaultLinkedRestaurantVariationId");

-- AddForeignKey
ALTER TABLE "MenuItemAttributeGroup" ADD CONSTRAINT "MenuItemAttributeGroup_defaultLinkedRestaurantVariationId_fkey" FOREIGN KEY ("defaultLinkedRestaurantVariationId") REFERENCES "RestaurantVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
