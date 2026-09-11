/*
  Warnings:

  - You are about to drop the `MenuCategoryHiddenBranch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MenuCategoryHiddenBranch" DROP CONSTRAINT "MenuCategoryHiddenBranch_branchId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategoryHiddenBranch" DROP CONSTRAINT "MenuCategoryHiddenBranch_categoryId_fkey";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- DropTable
DROP TABLE "MenuCategoryHiddenBranch";

-- CreateTable
CREATE TABLE "MenuItemDeal" (
    "id" TEXT NOT NULL,
    "baseItemId" TEXT NOT NULL,
    "dealItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemDeal_baseItemId_idx" ON "MenuItemDeal"("baseItemId");

-- CreateIndex
CREATE INDEX "MenuItemDeal_dealItemId_idx" ON "MenuItemDeal"("dealItemId");

-- AddForeignKey
ALTER TABLE "MenuItemDeal" ADD CONSTRAINT "MenuItemDeal_baseItemId_fkey" FOREIGN KEY ("baseItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemDeal" ADD CONSTRAINT "MenuItemDeal_dealItemId_fkey" FOREIGN KEY ("dealItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
