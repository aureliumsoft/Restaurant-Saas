-- AlterTable
ALTER TABLE "MenuItemAttributeGroup" ADD COLUMN "defaultLinkedMenuItemId" TEXT;

-- AddForeignKey
ALTER TABLE "MenuItemAttributeGroup" ADD CONSTRAINT "MenuItemAttributeGroup_defaultLinkedMenuItemId_fkey" FOREIGN KEY ("defaultLinkedMenuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "MenuItemAttributeGroup_defaultLinkedMenuItemId_idx" ON "MenuItemAttributeGroup"("defaultLinkedMenuItemId");
